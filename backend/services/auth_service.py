from passlib.context import CryptContext
import os
from sqlalchemy.orm import Session
from sqlalchemy import select
from database.models.general import User, Business, BusinessSettings
import uuid
import logging
import secrets
from datetime import datetime, timedelta
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
