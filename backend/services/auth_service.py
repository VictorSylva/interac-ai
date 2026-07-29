from passlib.context import CryptContext
import os
from sqlalchemy.orm import Session
from sqlalchemy import select
from database.models.general import User, Business, BusinessSettings, Property, Role, UserInvitation, LoginAuditLog
import uuid
import logging
import secrets
from datetime import datetime, timedelta
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from services.email_service import email_service

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
logger = logging.getLogger(__name__)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    # PBKDF2 has no 72-byte limit, so we don't need manual truncation
    return pwd_context.hash(password)

async def authenticate_user(session: Session, email, password):
    from sqlalchemy.orm import joinedload
    from database.models.billing import BusinessSubscription
    
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        return False
    
    # Check business status via subscription
    if user.business_id:
        sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == user.business_id)
        sub_res = await session.execute(sub_stmt)
        sub = sub_res.scalar_one_or_none()
        if sub and sub.status == "suspended":
            raise ValueError("This account has been suspended by the platform administrator.")
            
    if user.status == "suspended":
        raise ValueError("Your account has been suspended.")
        
    if not verify_password(password, user.password_hash):
        logger.warning(f"[DIAGNOSTIC] Login verification failed for {email}: Password hash mismatch")
        return False
    
    logger.info(f"[DIAGNOSTIC] Login verification SUCCESS for {email}")
    return user

async def register_business(session, email, password, business_name):
    # Check if user exists
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    existing_user = result.scalars().first()
    
    if existing_user:
        raise ValueError("User with this email already exists")

    from database.models.billing import BusinessSubscription, TokenWallet
    
    business_id = str(uuid.uuid4())
    
    # 1. Create Business
    new_business = Business(
        id=business_id,
        name=business_name
    )
    session.add(new_business)
    logger.info(f"[DIAGNOSTIC] Added Business: {business_id}")
    
    # 2. Initialize Subscription (New Source of Truth)
    new_sub = BusinessSubscription(
        business_id=business_id,
        plan_id="starter",
        status="expired",  # Requires payment/activation
        billing_cycle_anchor=datetime.utcnow()
    )
    session.add(new_sub)
    
    # 3. Create User (Owner)
    hashed_pwd = get_password_hash(password)
    user_id = str(uuid.uuid4())
    
    new_user = User(
        id=user_id,
        business_id=business_id,
        email=email,
        password_hash=hashed_pwd,
        role="owner"
    )
    session.add(new_user)
    logger.info(f"[DIAGNOSTIC] Added User: {user_id} with email {email}")
    
    new_wallet = TokenWallet(
        business_id=business_id,
        sub_balance=0,
        payg_balance=0
    )
    session.add(new_wallet)
    logger.info(f"[DIAGNOSTIC] Added TokenWallet for business: {business_id}")
    
    # 5. Default Settings
    settings = BusinessSettings(
        business_id=business_id,
        description=f"Business profile for {business_name}",
        tone="professional"
    )
    session.add(settings)
    
    logger.info(f"[DIAGNOSTIC] Attempting session.commit() for atomic creation...")
    await session.commit()
    logger.info(f"[DIAGNOSTIC] Session committed successfully for user {email}")
    
    # 6. Auto-Provision Default Workflows
    try:
        from create_booking_workflow import get_booking_workflow_payload
        from services.workflow_engine import workflow_engine
        await workflow_engine.create_workflow(business_id, get_booking_workflow_payload(business_id))
        logger.info(f"[DIAGNOSTIC] Auto-provisioned default workflows for business {business_id}")
    except Exception as e:
        logger.error(f"[DIAGNOSTIC] Failed to auto-provision default workflows for business {business_id}: {e}")
    
    logger.info(f"[DIAGNOSTIC] Signup complete for {email}. Returning business_id: {business_id}")
    return {"business_id": business_id, "user_id": user_id, "email": email}

async def create_reset_token(session, email: str):
    """Generates a reset token, saves it, and sends it via email."""
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        return False
        
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    # Token valid for 15 minutes as per requirements
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=15)
    
    await session.commit()
    
    # Send real email
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/reset-password?token={token}"
    
    # Send via email service
    await email_service.send_reset_email(email, reset_link)
    
    logger.info(f"PASSWORD RESET REQUEST: User {email} requested reset. Link sent to email.")
    
    return True

async def reset_password(session, token: str, new_password: str):
    """Verifies the token and updates the password if valid."""
    stmt = select(User).where(User.reset_token == token)
    result = await session.execute(stmt)
    user = result.scalars().first()
    
    if not user or not user.reset_token_expiry:
        return False
        
    if user.reset_token_expiry < datetime.utcnow():
        # Token expired
        user.reset_token = None
        user.reset_token_expiry = None
        await session.commit()
        return False
        
    # Valid token
    user.password_hash = get_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    
    await session.commit()
    return True

# --- JWT Constants & Configuration ---
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-in-prod-1234567890")
JWT_ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

# --- Permission Engine & RBAC Defaults ---
DEFAULT_ROLE_PERMISSIONS = {
    "owner": [
        "hotel.reservations.read", "hotel.reservations.create", "hotel.reservations.update",
        "hotel.rooms.manage", "hotel.housekeeping.assign", "hotel.finance.read", "hotel.finance.export",
        "hotel.analytics.view", "security.cameras.view", "security.events.resolve",
        "workflow.manage", "conversation.reply", "customer.delete", "billing.manage", "module.install"
    ],
    "admin": [
        "hotel.reservations.read", "hotel.reservations.create", "hotel.reservations.update",
        "hotel.rooms.manage", "hotel.housekeeping.assign", "hotel.finance.read", "hotel.finance.export",
        "hotel.analytics.view", "security.cameras.view", "security.events.resolve",
        "workflow.manage", "conversation.reply", "billing.manage", "module.install"
    ],
    "general_manager": [
        "hotel.reservations.read", "hotel.reservations.create", "hotel.reservations.update",
        "hotel.rooms.manage", "hotel.housekeeping.assign", "hotel.finance.read", "hotel.finance.export",
        "hotel.analytics.view", "security.cameras.view", "security.events.resolve",
        "workflow.manage", "conversation.reply"
    ],
    "frontdesk": [
        "hotel.reservations.read", "hotel.reservations.create", "hotel.reservations.update",
        "hotel.rooms.manage", "hotel.finance.read", "conversation.reply"
    ],
    "reception": [
        "hotel.reservations.read", "hotel.reservations.create", "hotel.reservations.update",
        "hotel.rooms.manage", "hotel.finance.read", "conversation.reply"
    ],
    "housekeeping": [
        "hotel.rooms.manage", "hotel.housekeeping.assign"
    ],
    "security": [
        "security.cameras.view", "security.events.resolve"
    ],
    "restaurant": [
        "hotel.finance.read"
    ],
    "kitchen": [
        "hotel.finance.read"
    ],
    "bar": [
        "hotel.finance.read"
    ],
    "finance": [
        "hotel.finance.read", "hotel.finance.export", "billing.manage"
    ],
    "accounts": [
        "hotel.finance.read", "hotel.finance.export", "billing.manage"
    ],
    "agent": [
        "conversation.reply"
    ],
    "viewer": [
        "hotel.reservations.read", "security.cameras.view"
    ]
}

async def get_user_permissions(user: User, session: Session) -> List[str]:
    # 1. Resolve role code
    role_code = (user.role or "agent").lower()
    
    # 2. Check if custom role is assigned in DB
    if user.role_id:
        stmt = select(Role).where(Role.id == user.role_id)
        res = await session.execute(stmt)
        custom_role = res.scalar_one_or_none()
        if custom_role and custom_role.permissions:
            return list(custom_role.permissions)
            
    # 3. Fallback: Check department-specific defaults
    dept = (user.department or "").lower()
    if dept and dept in DEFAULT_ROLE_PERMISSIONS:
        return DEFAULT_ROLE_PERMISSIONS[dept]
        
    # 4. Fallback to standard role defaults
    if role_code in DEFAULT_ROLE_PERMISSIONS:
        return DEFAULT_ROLE_PERMISSIONS[role_code]
        
    return DEFAULT_ROLE_PERMISSIONS["agent"]

# --- Employee Onboarding & User Invitations ---
async def create_employee_invitation(
    session: Session,
    business_id: str,
    email: str,
    role_code: str,
    department: str,
    property_id: Optional[str] = None,
    expires_in_hours: int = 48
) -> UserInvitation:
    # Expire any legacy pending invitations for this email under this business
    stmt = select(UserInvitation).where(
        UserInvitation.business_id == business_id,
        UserInvitation.email == email,
        UserInvitation.status == "pending"
    )
    res = await session.execute(stmt)
    existing = res.scalars().all()
    for invite in existing:
        invite.status = "expired"
        
    invitation_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)
    
    new_invite = UserInvitation(
        id=invitation_id,
        business_id=business_id,
        email=email,
        role=role_code,
        department=department,
        property_id=property_id,
        status="pending",
        expires_at=expires_at
    )
    session.add(new_invite)
    await session.commit()
    await session.refresh(new_invite)
    
    # Send email
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    invitation_link = f"{frontend_url}/accept-invitation?token={invitation_id}"
    
    subject = "You've been invited to join InteracAI"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #6366f1;">Join Your Business on InteracAI</h2>
        <p>Hello,</p>
        <p>You have been invited to join InteracAI as a <strong>{role_code.upper()}</strong> in the <strong>{department.upper()}</strong> department.</p>
        <p>To accept your invitation and set up your password, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{invitation_link}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
        </div>
        <p style="font-size: 12px; color: #888888;">This invitation will expire in {expires_in_hours} hours. If you did not expect this invitation, please ignore this email.</p>
    </div>
    """
    
    try:
        await email_service.send_email(email, subject, html_content)
    except Exception as e:
        logger.error(f"Failed to send invitation email: {e}")
        
    return new_invite

async def accept_employee_invitation(session: Session, token: str, password: str) -> Optional[User]:
    stmt = select(UserInvitation).where(UserInvitation.id == token, UserInvitation.status == "pending")
    res = await session.execute(stmt)
    invite = res.scalar_one_or_none()
    
    if not invite or invite.expires_at < datetime.utcnow():
        if invite:
            invite.status = "expired"
            await session.commit()
        return None
        
    # Check if user already exists
    stmt_user = select(User).where(User.email == invite.email)
    res_user = await session.execute(stmt_user)
    existing_user = res_user.scalar_one_or_none()
    
    hashed_pwd = get_password_hash(password)
    
    if existing_user:
        existing_user.business_id = invite.business_id
        existing_user.role = invite.role
        existing_user.department = invite.department
        existing_user.property_id = invite.property_id
        existing_user.password_hash = hashed_pwd
        existing_user.status = "active"
        existing_user.email_verified = True
        user = existing_user
    else:
        user = User(
            id=str(uuid.uuid4()),
            business_id=invite.business_id,
            email=invite.email,
            password_hash=hashed_pwd,
            role=invite.role,
            department=invite.department,
            property_id=invite.property_id,
            status="active",
            email_verified=True
        )
        session.add(user)
        
    invite.status = "accepted"
    await session.commit()
    await session.refresh(user)
    return user

# --- FastAPI Security Dependencies ---
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token or session expired")
    
    from database.session import AsyncSessionLocal
    user_id = payload.get("user_id")
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.id == user_id)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User account not found")
        if user.status == "suspended":
            raise HTTPException(status_code=403, detail="Your account has been suspended")
        
        permissions = await get_user_permissions(user, session)
        
        return {
            "id": user.id,
            "business_id": user.business_id,
            "email": user.email,
            "role": user.role,
            "department": user.department or "general",
            "property_id": user.property_id,
            "permissions": permissions
        }

def require_permission(permission: str):
    async def dependency(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") in ["owner", "super_admin"]:
            return current_user
        if permission not in current_user.get("permissions", []):
            raise HTTPException(status_code=403, detail=f"Permission denied: Requires {permission}")
        return current_user
    return dependency
