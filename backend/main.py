from config import config
import logging

# Configure Logging based on environment
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

logger.info(f"--- INTERAC AI STARTUP ---")
logger.info(f"MODE: {config.ENV}")
logger.info(f"DEBUG: {config.DEBUG}")
logger.info(f"STRICT_PROD_MODE: {config.STRICT_PROD_MODE}")

from database.session import AsyncSessionLocal
from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Depends
from services.auth_service import get_current_user, require_permission
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, select, func
import os
import json
import re
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, ConfigDict
from services.ai_service import generate_response
from services.prompt_service import prompt_service
from services.db_service import (
    store_message, get_chat_history, get_recent_conversations, get_conversation_messages,
    add_knowledge_document, get_knowledge_documents, delete_knowledge_document, save_lead,
    get_business_profile, update_business_profile, get_learned_insights, update_conversation_stats,
    log_prompt_execution, get_whatsapp_config, update_whatsapp_config, update_lead,
    get_lead_activities, send_lead_message, resolve_business_id, get_lead_by_conversation
)
from services.whatsapp_service import router as whatsapp_router
from services.workflow_engine import workflow_engine
from services.file_service import extract_text_from_file, scrape_url
from celery_app import celery_app # Ensure Celery is loaded for task dispatch

app = FastAPI(title="Interact API", description="Backend for Interact AI Automation Platform (SQL + Workflow Engine)")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS if config.STRICT_PROD_MODE else ["*"],
    allow_origin_regex=".*" if not config.STRICT_PROD_MODE else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("startup")
async def ensure_special_admin_account():
    logger.info("[Startup] Verifying special admin account exists and has the correct business ID...")
    try:
        from database.session import AsyncSessionLocal
        from services.auth_service import get_password_hash
        from sqlalchemy import select, delete
        from database.models.general import User, Business, BusinessSettings
        from database.models.billing import BusinessSubscription, TokenWallet
        import uuid
        
        async with AsyncSessionLocal() as session:
            email = "interacai.int@gmail.com"
            special_bid = "0bbd48c4-b066-435a-be3d-c095b55897c6"
            pwd_hash = get_password_hash("Setecs@55")
            
            # Make sure the Business itself exists first (so foreign key constraint is satisfied)
            biz = await session.get(Business, special_bid)
            if not biz:
                biz = Business(id=special_bid, name="interacAi")
                session.add(biz)
                await session.flush()
                logger.info(f"[Startup] Created special Business: {special_bid}")
            
            # 1. Ensure the user exists, is linked to special_bid, and has the correct password/role
            stmt = select(User).where(User.email == email)
            res = await session.execute(stmt)
            users = res.scalars().all()
            
            needs_creation = True
            if users:
                # Keep the first user, update its business association, password, and role
                primary_user = users[0]
                primary_user.business_id = special_bid
                primary_user.password_hash = pwd_hash
                primary_user.role = "owner"
                session.add(primary_user)
                needs_creation = False
                
                # Clean up any duplicate user records if they exist
                for duplicate_user in users[1:]:
                    await session.delete(duplicate_user)
                logger.info(f"[Startup] Verified and updated existing user {email} to business {special_bid}")
            

            
            # 3. Make sure the Subscription exists and is Active
            sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == special_bid)
            sub_res = await session.execute(sub_stmt)
            sub = sub_res.scalar_one_or_none()
            if not sub:
                sub = BusinessSubscription(
                    business_id=special_bid,
                    plan_id="enterprise",
                    status="active"
                )
                session.add(sub)
                logger.info("[Startup] Created Enterprise subscription for special business")
            else:
                sub.plan_id = "enterprise"
                sub.status = "active"
                session.add(sub)
                
            # 4. Make sure the User exists
            if needs_creation:
                new_user = User(
                    id=str(uuid.uuid4()),
                    business_id=special_bid,
                    email=email,
                    password_hash=pwd_hash,
                    role="owner"
                )
                session.add(new_user)
                logger.info(f"[Startup] Created special User: {email} with business: {special_bid}")
                
            # 5. Make sure the TokenWallet exists
            wallet = await session.get(TokenWallet, special_bid)
            if not wallet:
                wallet = TokenWallet(
                    business_id=special_bid,
                    sub_balance=1000000,
                    payg_balance=0
                )
                session.add(wallet)
            else:
                wallet.sub_balance = 1000000
                session.add(wallet)
                
            # 6. Make sure default Settings exist
            settings_stmt = select(BusinessSettings).where(BusinessSettings.business_id == special_bid)
            settings_res = await session.execute(settings_stmt)
            settings = settings_res.scalar_one_or_none()
            if not settings:
                settings = BusinessSettings(
                    business_id=special_bid,
                    description="Default settings for special business",
                    tone="professional"
                )
                session.add(settings)
                
            await session.commit()
            logger.info("[Startup] Special admin account setup verified successfully.")
            
    except Exception as e:
        logger.error(f"[Startup] Failed to verify special admin account: {e}", exc_info=True)


from services.socket_manager import socket_manager
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/{business_id}")
async def websocket_endpoint(websocket: WebSocket, business_id: str):
    await socket_manager.connect(websocket, business_id)
    try:
        while True:
            # We don't expect messages from agent for now, just keep connection alive
            data = await websocket.receive_text()
            # Echo or heartbeat
            await websocket.send_text(f"Message received: {data}")
    except WebSocketDisconnect:
        socket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        socket_manager.disconnect(websocket)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    origin = request.headers.get("origin")
    path = request.url.path
    method = request.method
    prefix = f"[{config.ENV.upper()}] " if config.ENV != "production" else ""
    logger.info(f"{prefix}Incoming Request: {method} {path} | Origin: {origin}")
    response = await call_next(request)
    return response

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Interact API is running (PostgreSQL + Celery)"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/debug/business-id")
async def debug_business_id(business_id: str):
    """Diagnostic endpoint to check ID resolution and data counts for a business."""
    from services.db_service import resolve_business_id, get_all_possible_business_ids
    from database.session import AsyncSessionLocal
    from database.models.general import Business, KnowledgeDoc
    from database.models.chat import Conversation, Message
    from database.models.crm import Lead
    from database.models.billing import BusinessSubscription, SubscriptionPlan
    from sqlalchemy import func, select
    
    resolved_id = await resolve_business_id(business_id)
    possible_ids = await get_all_possible_business_ids(business_id)
    
    results = {
        "input_id": business_id,
        "resolved_uuid": resolved_id,
        "exists_in_businesses": False,
        "all_mapped_ids": possible_ids,
        "counts": {}
    }
    
    async with AsyncSessionLocal() as session:
        # Check if resolved ID is in Business table
        stmt = select(Business, BusinessSubscription, SubscriptionPlan).join(
            BusinessSubscription, Business.id == BusinessSubscription.business_id, isouter=True
        ).join(
            SubscriptionPlan, BusinessSubscription.plan_id == SubscriptionPlan.id, isouter=True
        ).where(Business.id == resolved_id)
        
        res = await session.execute(stmt)
        row = res.first()
        if row:
            biz, sub, plan = row
            results["exists_in_businesses"] = True
            results["business_name"] = biz.name
            results["plan"] = plan.id if plan else "starter"
            results["status"] = sub.status if sub else "expired"
        
        for bid in possible_ids:
            lead_count = (await session.execute(select(func.count(Lead.id)).where(Lead.business_id == bid))).scalar()
            convo_count = (await session.execute(select(func.count(Conversation.id)).where(Conversation.business_id == bid))).scalar()
            msg_count = (await session.execute(select(func.count(Message.id)).where(Message.business_id == bid))).scalar()
            doc_count = (await session.execute(select(func.count(KnowledgeDoc.id)).where(KnowledgeDoc.business_id == bid))).scalar()
            
            results["counts"][bid] = {
                "leads": lead_count,
                "conversations": convo_count,
                "messages": msg_count,
                "knowledge_docs": doc_count
            }
            
    return results

@app.get("/api/debug/config")
async def debug_config():
    """Temporary debug route to verify reload and config."""
    from config import config
    db_url = config.DATABASE_URL
    masked_db = db_url.split("@")[-1] if "@" in db_url else "no-user-pass-format"
    return {
        "env": config.ENV,
        "database_url_host": masked_db,
        "frontend_url": config.FRONTEND_URL,
        "allowed_origins": config.ALLOWED_ORIGINS,
        "current_time": datetime.utcnow().isoformat()
    }
@app.on_event("startup")
async def startup_event():
    # Auto-create tables for MVP (replaces manually running alembic revision for now)
    from database.session import engine
    from database.base import Base
    from database.models import general, chat, crm, workflow, scheduling, behavior_analytics, sales, entitlement
    import asyncio
    
    max_retries = 20
    for attempt in range(max_retries):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                # One-time patches for existing tables (Dialect-agnostic)
                is_pg = "postgresql" in str(engine.url)
                
                statements = [
                    "ALTER TABLE users ADD COLUMN {ine} reset_token VARCHAR",
                    "ALTER TABLE users ADD COLUMN {ine} reset_token_expiry TIMESTAMP",
                    "ALTER TABLE sales_orders ADD COLUMN {ine} payment_mode VARCHAR DEFAULT 'test'",
                    "ALTER TABLE businesses ADD COLUMN {ine} is_deleted BOOLEAN DEFAULT FALSE",
                    "ALTER TABLE conversations ADD COLUMN {ine} mode VARCHAR DEFAULT 'ai'",
                    "ALTER TABLE conversations ADD COLUMN {ine} assigned_agent_id VARCHAR",
                    "ALTER TABLE conversations ADD COLUMN {ine} status VARCHAR DEFAULT 'active'",
                    "ALTER TABLE conversations ADD COLUMN {ine} last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                    "ALTER TABLE conversations ADD COLUMN {ine} conversation_start_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                    "ALTER TABLE conversations ADD COLUMN {ine} is_active BOOLEAN DEFAULT TRUE",
                    "ALTER TABLE subscription_plans ADD COLUMN {ine} is_public BOOLEAN DEFAULT TRUE",
                    "ALTER TABLE subscription_plans ADD COLUMN {ine} requires_contact BOOLEAN DEFAULT FALSE",
                    "ALTER TABLE business_settings ADD COLUMN {ine} auto_escalate_on_keyword BOOLEAN DEFAULT FALSE",
                    "ALTER TABLE conversations ADD COLUMN {ine} department VARCHAR",
                    "ALTER TABLE users ADD COLUMN {ine} department VARCHAR",
                    "ALTER TABLE users ADD COLUMN {ine} property_id VARCHAR",
                    "ALTER TABLE users ADD COLUMN {ine} status VARCHAR DEFAULT 'active'",
                    "ALTER TABLE users ADD COLUMN {ine} email_verified BOOLEAN DEFAULT FALSE",
                    "ALTER TABLE users ADD COLUMN {ine} verification_token VARCHAR",
                    "ALTER TABLE users ADD COLUMN {ine} role_id VARCHAR",
                    "ALTER TABLE users ADD COLUMN {ine} department_id VARCHAR",
                    "ALTER TABLE users ADD COLUMN {ine} phone VARCHAR",
                    "ALTER TABLE users ADD COLUMN {ine} receive_operational_alerts BOOLEAN DEFAULT TRUE",
                    "ALTER TABLE users ADD COLUMN {ine} notification_preference VARCHAR DEFAULT 'all'",
                    "ALTER TABLE user_invitations ADD COLUMN {ine} phone VARCHAR",
                    "ALTER TABLE business_settings ADD COLUMN {ine} notification_cooldown_minutes INTEGER DEFAULT 30"
                ]
                
                for stmt in statements:
                    query_text = stmt.format(ine="IF NOT EXISTS" if is_pg else "")
                    try:
                        await conn.execute(text(query_text))
                    except Exception as stmt_err:
                        logger.debug(f"Migration column patch skipped: {stmt_err}")
                
                if is_pg:
                    try:
                        await conn.execute(text("ALTER TABLE subscription_plans ALTER COLUMN price DROP NOT NULL"))
                    except Exception as drop_err:
                        logger.debug(f"Drop not null check skipped: {drop_err}")

                # Push Notifications
                if is_pg:
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS push_subscriptions (
                            id SERIAL PRIMARY KEY,
                            user_id VARCHAR REFERENCES users(id),
                            endpoint TEXT UNIQUE,
                            p256dh TEXT,
                            auth TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                else:
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS push_subscriptions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id VARCHAR REFERENCES users(id),
                            endpoint TEXT UNIQUE,
                            p256dh TEXT,
                            auth TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))

                # Fallback Tables for Investigations
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS investigations (
                        id VARCHAR PRIMARY KEY,
                        title VARCHAR,
                        entity_identifier VARCHAR,
                        description TEXT,
                        severity VARCHAR,
                        status VARCHAR DEFAULT 'open',
                        assigned_to VARCHAR,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                if is_pg:
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS investigation_notes (
                            id SERIAL PRIMARY KEY,
                            case_id VARCHAR REFERENCES investigations(id),
                            author VARCHAR,
                            text TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                else:
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS investigation_notes (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            case_id VARCHAR REFERENCES investigations(id),
                            author VARCHAR,
                            text TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))

            # One-off patches for installed_modules to prevent PostgreSQL InFailedSQLTransactionError
            try:
                async with engine.begin() as conn:
                    if "postgresql" in str(engine.url):
                        await conn.execute(text("ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS installed_modules TEXT DEFAULT '[]'"))
                    else:
                        await conn.execute(text("ALTER TABLE business_settings ADD COLUMN installed_modules TEXT DEFAULT '[]'"))
            except Exception as patch_err:
                logger.info(f"Optional patch installed_modules error ignored: {patch_err}")

            # 4. Seed Subscription Plans
            from seed_plans import seed_plans
            await seed_plans()
            
            logger.info("Database connection established, schema verified, and plans seeded.")
            
            # Start ARGUS OS Listener
            from services.argus_listener import argus_listener
            await argus_listener.start()
            
            # Load & Register InteracAI Industry Starter Modules
            from modules.loader import load_all_industry_modules
            await load_all_industry_modules()
            
            # Start Escalation Background Daemon
            async def escalation_daemon_loop():
                logger.info("[Startup] Escalation background daemon started.")
                while True:
                    try:
                        from services.routing_service import DepartmentRoutingService
                        await DepartmentRoutingService.check_and_trigger_escalations()
                    except Exception as daemon_err:
                        logger.error(f"[EscalationDaemon] Error running check: {daemon_err}")
                    await asyncio.sleep(60)
            
            asyncio.create_task(escalation_daemon_loop())
            
            break
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Database connection failed (Attempt {attempt + 1}/{max_retries}). Retrying in 3s... Error: {e}")
                await asyncio.sleep(3)
            else:
                logger.error("Could not connect to database after multiple attempts.")

@app.on_event("shutdown")
async def shutdown_event():
    from services.argus_listener import argus_listener
    await argus_listener.stop()

# --- API Routes ---
from routes import (
    admin_routes, 
    token_routes, 
    subscription_routes,
    sales_routes,
    email_routes,
    usage_routes,
    debug_routes,
    config_routes,
    entity_routes,
    observation_routes,
    module_routes,
    hotel_routes,
    copilot_fallback_routes,
    entitlement_routes
)

app.include_router(config_routes.router)
app.include_router(whatsapp_router, prefix="/whatsapp")
app.include_router(token_routes.router, prefix="/api/tokens", tags=["Tokens"])
app.include_router(subscription_routes.router, prefix="/api/subscriptions", tags=["Subscriptions"])
app.include_router(entitlement_routes.router)
app.include_router(email_routes.router, prefix="/api/email", tags=["Email"])
app.include_router(usage_routes.router, prefix="/api/usage", tags=["Usage"])
app.include_router(sales_routes.router, prefix="/api/sales", tags=["Sales"])
app.include_router(admin_routes.router, prefix="/api/super-admin", tags=["Super Admin"])
app.include_router(debug_routes.router, prefix="/api/debug", tags=["Debug"])
app.include_router(entity_routes.router)
app.include_router(observation_routes.router)
app.include_router(module_routes.router)
app.include_router(hotel_routes.router)
app.include_router(copilot_fallback_routes.router)


@app.get("/api/conversations")
async def read_conversations(business_id: str):
    """Get list of conversations for a business"""
    from services.db_service import resolve_business_id, get_recent_conversations
    bid = await resolve_business_id(business_id)
    return await get_recent_conversations(business_id=bid)

@app.get("/api/conversations/{user_id}/messages")
async def read_messages(user_id: str, business_id: str):
    """Get messages for a specific conversation in a business"""
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    return await get_conversation_messages(bid, user_id)

class ConversationReply(BaseModel):
    message: str
    business_id: str

@app.post("/api/conversations/{user_id}/reply")
async def reply_to_conversation(user_id: str, body: ConversationReply):
    """Send a manual reply as an agent"""
    from services.db_service import resolve_business_id, store_message, set_conversation_mode
    bid = await resolve_business_id(body.business_id)
    
    from database.models.chat import Conversation
    from database.session import AsyncSessionLocal
    
    platform = "web"
    async with AsyncSessionLocal() as session:
        # Find conversation to determine platform
        convo_id = f"{bid}:{user_id}"
        convo = await session.get(Conversation, convo_id)
        if not convo:
            from sqlalchemy import select
            stmt = select(Conversation).where(
                Conversation.business_id == bid,
                Conversation.id.like(f"%{user_id}%")
            ).limit(1)
            res = await session.execute(stmt)
            convo = res.scalar_one_or_none()
            
        if convo:
            platform = convo.platform
            
    # 1. Store the agent message
    await store_message(bid, user_id, body.message, sender="agent", platform=platform)
    
    # 2. Ensure mode is set to human (if not already)
    await set_conversation_mode(bid, user_id, mode="human", status="active")
    
    # 3. Platform specific sending (e.g., if WhatsApp)
    if platform == "whatsapp":
        from services.whatsapp_service import send_whatsapp_message
        phone_number = user_id.split(':')[-1] if ':' in user_id else user_id
        await send_whatsapp_message(phone_number, body.message, business_id=bid)
    
    return {"status": "sent"}

@app.post("/api/conversations/{user_id}/resolve")
async def resolve_conversation(user_id: str, body: dict):
    """Resolve conversation and return to AI mode"""
    from services.db_service import resolve_business_id, set_conversation_mode
    bid = await resolve_business_id(body.get("business_id", "default"))
    
    success = await set_conversation_mode(bid, user_id, mode="ai", status="closed")
    return {"status": "success" if success else "failed"}

from services.db_service import get_leads, get_analytics_summary

@app.get("/api/analytics")
async def read_analytics(business_id: str, days: int = 30):
    from services.db_service import resolve_business_id, get_analytics_summary
    bid = await resolve_business_id(business_id)
    return await get_analytics_summary(bid, days=days)

@app.get("/api/analytics/insights")
async def get_analytics_insights(business_id: str):
    from services.db_service import resolve_business_id
    from services.sales_intelligence_service import sales_intelligence_service
    bid = await resolve_business_id(business_id)
    return await sales_intelligence_service.get_ai_insights(bid)

# --- Authentication ---
from services.auth_service import register_business, authenticate_user, create_reset_token, reset_password
from database.session import get_db

class RegisterRequest(BaseModel):
    email: str
    password: str
    business_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class LeadCaptureRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: Optional[str] = None
    company_name: Optional[str] = None
    automation_goals: Optional[str] = None
    industry: str
    demo_type: str
    business_id: str = "0bbd48c4-b066-435a-be3d-c095b55897c6"

@app.post("/api/auth/register")
async def register_endpoint(body: RegisterRequest):
    logger.info(f"[DIAGNOSTIC] Signup request received for email: {body.email}")
    from database.session import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        try:
            result = await register_business(session, body.email, body.password, body.business_name)
            return {"status": "success", "data": result}
        except ValueError as e:
            logger.warning(f"[DIAGNOSTIC] Signup failed (ValueError): {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"[DIAGNOSTIC] Registration error: {e}")
            raise HTTPException(status_code=500, detail="Registration failed")

@app.post("/api/auth/login")
async def login_endpoint(body: LoginRequest, request: Request):
    logger.info(f"[DIAGNOSTIC] Login request received for email: {body.email}")
    from database.session import AsyncSessionLocal
    from database.models.general import LoginAuditLog
    from services.auth_service import create_access_token, get_user_permissions
    
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    async with AsyncSessionLocal() as session:
        try:
            user = await authenticate_user(session, body.email, body.password)
        except ValueError as e:
            logger.warning(f"[DIAGNOSTIC] Login failed (ValueError): {e}")
            audit = LoginAuditLog(
                email=body.email,
                ip_address=ip_address,
                user_agent=user_agent,
                status="failed",
                reason=str(e)
            )
            session.add(audit)
            await session.commit()
            raise HTTPException(status_code=403, detail=str(e))
        except Exception as e:
            logger.error(f"[DIAGNOSTIC] Login error: {e}")
            raise HTTPException(status_code=500, detail="Database connection error. Please check backend logs.")
        
        if not user:
             logger.warning(f"[DIAGNOSTIC] Login failed: Invalid credentials for {body.email}")
             audit = LoginAuditLog(
                 email=body.email,
                 ip_address=ip_address,
                 user_agent=user_agent,
                 status="failed",
                 reason="Invalid credentials"
             )
             session.add(audit)
             await session.commit()
             raise HTTPException(status_code=401, detail="Invalid credentials")
             
        # Success path
        permissions = await get_user_permissions(user, session)
        token = create_access_token({
            "user_id": user.id,
            "business_id": user.business_id,
            "email": user.email,
            "role": user.role,
            "department": getattr(user, 'department', 'general') or 'general',
            "property_id": getattr(user, 'property_id', None),
            "permissions": permissions
        })
        
        audit = LoginAuditLog(
            user_id=user.id,
            email=user.email,
            ip_address=ip_address,
            user_agent=user_agent,
            status="success"
        )
        session.add(audit)
        await session.commit()
    
    return {
        "status": "success",
        "user": {
            "id": user.id,
            "email": user.email,
            "business_id": user.business_id,
            "role": user.role,
            "department": getattr(user, 'department', 'general') or 'general',
            "property_id": getattr(user, 'property_id', None),
            "permissions": permissions
        },
        "token": token
    }

@app.post("/api/auth/forgot-password")
async def forgot_password_endpoint(body: ForgotPasswordRequest):
    from database.session import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        # Note: For security, usually return success even if email doesn't exist
        # to prevent user enumeration. But for MVP let's be explicit.
        success = await create_reset_token(session, body.email)
        if not success:
            # We'll still say success for security if desired, but for now:
            raise HTTPException(status_code=404, detail="Email not found")
        return {"status": "success", "message": "Reset link sent"}

@app.post("/api/auth/reset-password")
async def reset_password_endpoint(body: ResetPasswordRequest):
    from database.session import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        success = await reset_password(session, body.token, body.new_password)
        if not success:
            raise HTTPException(status_code=400, detail="Invalid or expired token")
        return {"status": "success", "message": "Password updated"}

def normalize_agent_phone(phone: str) -> str:
    if not phone:
        return ""
    clean = "".join(c for c in phone if c.isdigit())
    if clean.startswith("0") and len(clean) == 11:
        clean = "234" + clean[1:]
    return clean

class UpdateProfileRequest(BaseModel):
    user_id: str
    department: str
    role: str
    property_id: Optional[str] = None
    phone: Optional[str] = None
    receive_operational_alerts: Optional[bool] = None
    notification_preference: Optional[str] = None

@app.put("/api/auth/profile")
async def update_profile_endpoint(body: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    is_admin = current_user.get("role") in ["owner", "admin", "super_admin"]
    is_self = current_user.get("id") == body.user_id
    
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from database.session import AsyncSessionLocal
    from database.models.general import User
    from services.auth_service import get_user_permissions
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.id == body.user_id))
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        if is_admin:
            user.department = body.department
            user.role = body.role
            user.property_id = body.property_id
        else:
            user.property_id = body.property_id
            
        user.phone = normalize_agent_phone(body.phone) if body.phone is not None else user.phone
        if body.receive_operational_alerts is not None:
            user.receive_operational_alerts = body.receive_operational_alerts
        if body.notification_preference is not None:
            user.notification_preference = body.notification_preference
            
        await session.commit()
        await session.refresh(user)
        permissions = await get_user_permissions(user, session)
        
        return {
            "status": "success",
            "user": {
                "id": user.id,
                "email": user.email,
                "business_id": user.business_id,
                "role": user.role,
                "department": user.department,
                "property_id": user.property_id,
                "phone": user.phone,
                "receive_operational_alerts": user.receive_operational_alerts,
                "notification_preference": user.notification_preference,
                "permissions": permissions
            }
        }

class InviteRequest(BaseModel):
    email: str
    role: str
    department: str
    property_id: Optional[str] = None
    phone: Optional[str] = None

@app.post("/api/auth/invite")
async def invite_employee_endpoint(body: InviteRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only owners and administrators can invite employees")
        
    from database.session import AsyncSessionLocal
    from services.auth_service import create_employee_invitation
    
    async with AsyncSessionLocal() as session:
        invitation = await create_employee_invitation(
            session=session,
            business_id=current_user.get("business_id"),
            email=body.email,
            role_code=body.role,
            department=body.department,
            property_id=body.property_id,
            phone=body.phone
        )
        return {
            "status": "success",
            "message": "Invitation sent successfully",
            "invitation_id": invitation.id
        }

@app.get("/api/auth/invitations")
async def get_invitations_endpoint(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from database.session import AsyncSessionLocal
    from database.models.general import UserInvitation
    
    async with AsyncSessionLocal() as session:
        stmt = select(UserInvitation).where(
            UserInvitation.business_id == current_user.get("business_id"),
            UserInvitation.status == "pending"
        ).order_by(UserInvitation.created_at.desc())
        res = await session.execute(stmt)
        invites = res.scalars().all()
        return [
            {
                "id": invite.id,
                "email": invite.email,
                "role": invite.role,
                "department": invite.department,
                "property_id": invite.property_id,
                "created_at": invite.created_at
            } for invite in invites
        ]

@app.post("/api/auth/invitations/{invitation_id}/cancel")
async def cancel_invitation_endpoint(invitation_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from database.session import AsyncSessionLocal
    from database.models.general import UserInvitation
    
    async with AsyncSessionLocal() as session:
        stmt = select(UserInvitation).where(
            UserInvitation.id == invitation_id,
            UserInvitation.business_id == current_user.get("business_id")
        )
        res = await session.execute(stmt)
        invite = res.scalar_one_or_none()
        if not invite:
            raise HTTPException(status_code=404, detail="Invitation not found")
        invite.status = "expired"
        await session.commit()
        return {"status": "success", "message": "Invitation cancelled"}

@app.get("/api/auth/invitation-details")
async def get_invitation_details_endpoint(token: str):
    from database.session import AsyncSessionLocal
    from database.models.general import UserInvitation, Business
    
    async with AsyncSessionLocal() as session:
        stmt = select(UserInvitation, Business.name).join(
            Business, UserInvitation.business_id == Business.id
        ).where(UserInvitation.id == token, UserInvitation.status == "pending")
        res = await session.execute(stmt)
        row = res.first()
        if not row:
            raise HTTPException(status_code=400, detail="Invalid or expired invitation token")
        invite, biz_name = row
        return {
            "email": invite.email,
            "business_name": biz_name,
            "role": invite.role,
            "department": invite.department
        }

class AcceptInviteRequest(BaseModel):
    token: str
    password: str

@app.post("/api/auth/accept-invitation")
async def accept_invitation_endpoint(body: AcceptInviteRequest):
    from database.session import AsyncSessionLocal
    from services.auth_service import accept_employee_invitation, create_access_token, get_user_permissions
    
    async with AsyncSessionLocal() as session:
        user = await accept_employee_invitation(session, body.token, body.password)
        if not user:
            raise HTTPException(status_code=400, detail="Failed to accept invitation. Token might be expired or invalid.")
            
        permissions = await get_user_permissions(user, session)
        token = create_access_token({
            "user_id": user.id,
            "business_id": user.business_id,
            "email": user.email,
            "role": user.role,
            "department": getattr(user, 'department', 'general') or 'general',
            "property_id": getattr(user, 'property_id', None),
            "permissions": permissions
        })
        
        return {
            "status": "success",
            "user": {
                "id": user.id,
                "email": user.email,
                "business_id": user.business_id,
                "role": user.role,
                "department": getattr(user, 'department', 'general') or 'general',
                "property_id": getattr(user, 'property_id', None),
                "permissions": permissions
            },
            "token": token
        }

@app.get("/api/auth/users")
async def get_business_users_endpoint(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from database.session import AsyncSessionLocal
    from database.models.general import User
    
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(
            User.business_id == current_user.get("business_id")
        ).order_by(User.created_at.desc())
        res = await session.execute(stmt)
        users = res.scalars().all()
        return [
            {
                "id": u.id,
                "email": u.email,
                "role": u.role,
                "department": u.department or "general",
                "property_id": u.property_id,
                "phone": u.phone,
                "receive_operational_alerts": u.receive_operational_alerts,
                "notification_preference": u.notification_preference,
                "status": u.status or "active",
                "created_at": u.created_at
            } for u in users
        ]

class ToggleUserStatusRequest(BaseModel):
    status: str

@app.put("/api/auth/users/{user_id}/status")
async def toggle_user_status_endpoint(user_id: str, body: ToggleUserStatusRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")
        
    from database.session import AsyncSessionLocal
    from database.models.general import User
    
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.id == user_id, User.business_id == current_user.get("business_id"))
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        user.status = body.status
        await session.commit()
        return {"status": "success", "message": f"User status updated to {body.status}"}

@app.get("/api/auth/login-history")
async def get_login_history_endpoint(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from database.session import AsyncSessionLocal
    from database.models.general import LoginAuditLog, User
    
    async with AsyncSessionLocal() as session:
        stmt = select(LoginAuditLog).join(
            User, LoginAuditLog.user_id == User.id
        ).where(
            User.business_id == current_user.get("business_id")
        ).order_by(LoginAuditLog.created_at.desc()).limit(100)
        
        res = await session.execute(stmt)
        logs = res.scalars().all()
        return [
            {
                "id": log.id,
                "email": log.email,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "status": log.status,
                "reason": log.reason,
                "created_at": log.created_at
            } for log in logs
        ]

class PropertyCreateRequest(BaseModel):
    name: str

@app.post("/api/auth/properties")
async def create_property_endpoint(body: PropertyCreateRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from database.session import AsyncSessionLocal
    from database.models.general import Property
    import uuid
    
    async with AsyncSessionLocal() as session:
        prop = Property(
            id=str(uuid.uuid4()),
            business_id=current_user.get("business_id"),
            name=body.name
        )
        session.add(prop)
        await session.commit()
        return {"status": "success", "id": prop.id, "name": prop.name}

@app.get("/api/auth/properties")
async def get_properties_endpoint(current_user: dict = Depends(get_current_user)):
    from database.session import AsyncSessionLocal
    from database.models.general import Property
    
    async with AsyncSessionLocal() as session:
        stmt = select(Property).where(Property.business_id == current_user.get("business_id")).order_by(Property.created_at.desc())
        res = await session.execute(stmt)
        props = res.scalars().all()
        return [{"id": p.id, "name": p.name} for p in props]


class PushSubscribeRequest(BaseModel):
    user_id: str
    subscription: dict

@app.post("/api/notifications/subscribe")
async def subscribe_push(body: PushSubscribeRequest):
    from services.notification_service import notification_service
    success = await notification_service.save_subscription(body.user_id, body.subscription)
    return {"status": "success" if success else "failed"}

@app.get("/api/notifications/config")
async def get_push_config():
    import os
    return {
        "vapid_public_key": os.getenv("VAPID_PUBLIC_KEY")
    }

@app.post("/api/leads/capture")
async def capture_lead_endpoint(body: LeadCaptureRequest):
    """Captures a lead from the landing page demo funnel."""
    from services.db_service import save_lead, resolve_business_id
    
    # Resolve the business ID (usually the demo business)
    bid = await resolve_business_id(body.business_id)
    
    lead_data = {
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "source": "landing_demo",
        "tags": ["landing_demo", body.industry.lower(), body.demo_type],
        "custom_fields": {
            "role": body.role,
            "company_name": body.company_name,
            "automation_goals": body.automation_goals,
            "industry": body.industry,
            "demo_type": body.demo_type,
            "captured_at": datetime.utcnow().isoformat()
        },
        "status": "new"
    }
    
    logger.info(f"[LEAD_CAPTURE] New lead from landing page: {body.email} ({body.industry})")
    lead_id = await save_lead(bid, lead_data)
    
    if lead_id:
        return {"status": "success", "lead_id": lead_id}
    else:
        raise HTTPException(status_code=500, detail="Failed to capture lead")

# --- Web Chat & Automation ---

class WebMessage(BaseModel):
    user_id: str
    message: str
    business_id: str = "default"

class BusinessProfile(BaseModel):
    model_config = ConfigDict(extra='ignore')
    
    business_id: str
    name: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    services: Optional[str] = None
    tone: Optional[str] = None
    faq: Optional[str] = None
    custom_instructions: Optional[str] = None
    location: Optional[str] = None
    hours: Optional[str] = None
    auto_escalate_on_keyword: Optional[bool] = False
    departments: Optional[list] = []

class WhatsAppConfigRequest(BaseModel):
    business_id: str
    phone_number_id: str = None
    business_account_id: str = None
    app_id: str = None
    app_secret: str = None
    access_token: str = None
    is_active: bool = None

class AppointmentTypeRequest(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = 30
    color_code: str = "#3b82f6"

class AvailabilityRuleRequest(BaseModel):
    day_of_week: int # 0-6
    start_time: str # "HH:MM"
    end_time: str   # "HH:MM"
    is_active: bool = True

# --- Isolated Behavior Analytics (V2) ---
from services.behavior_analytics_service import behavior_analytics_service

class BAEventSchema(BaseModel):
    type: str
    path: str
    element_id: Optional[str] = None
    element_class: Optional[str] = None
    element_text: Optional[str] = None
    offer_id: Optional[int] = None
    funnel_id: Optional[str] = None
    properties: Optional[dict] = {}

class BABatchRequest(BaseModel):
    business_id: str
    session_id: str
    visitor_id: str
    metadata: dict
    events: list[BAEventSchema]

@app.post("/api/behavior-analytics/collect")
async def collect_behavior_analytics(req: BABatchRequest):
    """Isolated endpoint for Behavioral Analytics ingestion."""
    if not os.getenv("ENABLE_BEHAVIOR_ANALYTICS", "true").lower() == "true":
        return {"status": "disabled"}

    profile_id = await resolve_business_id(req.business_id)
    
    # 🚨 CRITICAL: Check if business actually exists before inserting (Prevents ForeignKeyViolationError)
    from services.db_service import get_business_status
    biz = await get_business_status(profile_id)
    if not biz:
        logger.warning(f"Analytics drop: Business {profile_id} (input: {req.business_id}) does not exist.")
        return {"status": "dropped", "reason": "invalid_business"}

    session = await behavior_analytics_service.get_or_create_session(
        business_id=profile_id,
        session_id=req.session_id,
        visitor_id=req.visitor_id,
        metadata=req.metadata
    )
    
    if not session:
        return {"status": "failed", "reason": "session_init_failure"}
    
    success = await behavior_analytics_service.track_batch(
        profile_id, session.id, [e.dict() for e in req.events]
    )
    return {"status": "success" if success else "failed"}

@app.get("/api/behavior-analytics/dashboard")
async def get_behavior_dashboard(business_id: str, days: int = 7, traffic_type: str = "visitors"):
    """Fetch data for the new isolated Behavioral Analytics dashboard with real-time support and filtering."""
    from database.models.behavior_analytics import BAAggregate, BASession, BAEvent
    from sqlalchemy import func, and_, not_, or_, text
    import traceback
    
    bid = await resolve_business_id(business_id)
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)

    exclude_paths = ["/dashboard", "/super-admin", "/login", "/reset-password", "/accept-invitation"]

    def apply_path_filter(query):
        if traffic_type == "dashboard":
            # Must start with one of the exclude paths
            return query.where(or_(*[BAEvent.path.like(f"{p}%") for p in exclude_paths]))
        else:
            # Must NOT start with any of the exclude paths
            return query.where(and_(*[not_(BAEvent.path.like(f"{p}%")) for p in exclude_paths]))

    async with AsyncSessionLocal() as session:
        try:
            # 1. Calculate dynamic chart data grouped by date
            chart_data = {}
            for i in range(days + 1):
                d = (now - timedelta(days=days - i)).strftime("%Y-%m-%d")
                chart_data[d] = {
                    "date": d,
                    "sessions": 0,
                    "pageviews": 0,
                    "unique_users": 0
                }

            # Query dynamic stats from BAEvent & BASession
            stmt = select(
                func.date(BAEvent.timestamp).label("date_label"),
                func.count(BAEvent.id).label("pageviews"),
                func.count(func.distinct(BAEvent.session_id)).label("sessions"),
                func.count(func.distinct(BASession.visitor_id)).label("unique_users")
            ).join(
                BASession, BASession.id == BAEvent.session_id
            ).where(
                BAEvent.business_id == bid,
                BAEvent.timestamp >= start_date
            )
            stmt = apply_path_filter(stmt)
            stmt = stmt.group_by(func.date(BAEvent.timestamp)).order_by(text("date_label ASC"))
            
            res = await session.execute(stmt)
            for row in res.all():
                d_val = row[0]
                if isinstance(d_val, datetime):
                    d_str = d_val.strftime("%Y-%m-%d")
                elif hasattr(d_val, "strftime"):
                    d_str = d_val.strftime("%Y-%m-%d")
                else:
                    d_str = str(d_val)
                
                if d_str in chart_data:
                    chart_data[d_str] = {
                        "date": d_str,
                        "pageviews": row[1] or 0,
                        "sessions": row[2] or 0,
                        "unique_users": row[3] or 0
                    }

            # 2. Top Pages
            pages_stmt = select(BAEvent.path, func.count(BAEvent.id).label("c")).where(
                BAEvent.business_id == bid,
                BAEvent.event_type == "pageview",
                BAEvent.timestamp >= start_date
            )
            pages_stmt = apply_path_filter(pages_stmt)
            pages_stmt = pages_stmt.group_by(BAEvent.path).order_by(text("c DESC")).limit(10)
            top_pages = (await session.execute(pages_stmt)).all()

            # 3. Top Clicks
            clicks_stmt = select(BAEvent.element_text, func.count(BAEvent.id).label("c")).where(
                BAEvent.business_id == bid,
                BAEvent.event_type == "click",
                BAEvent.timestamp >= start_date
            )
            clicks_stmt = apply_path_filter(clicks_stmt)
            clicks_stmt = clicks_stmt.group_by(BAEvent.element_text).order_by(text("c DESC")).limit(10)
            top_clicks = (await session.execute(clicks_stmt)).all()

            # 4. Journey Sequences
            journey_stmt = select(BASession.id, BAEvent.path, BAEvent.timestamp).join(BAEvent).where(
                BAEvent.business_id == bid,
                BAEvent.event_type == "pageview",
                BAEvent.timestamp >= start_date
            )
            journey_stmt = apply_path_filter(journey_stmt)
            journey_stmt = journey_stmt.order_by(BASession.id, BAEvent.timestamp)
            rows = (await session.execute(journey_stmt)).all()
            
            sessions_map = {}
            for sid, path, ts in rows:
                if sid not in sessions_map: sessions_map[sid] = []
                if not sessions_map[sid] or sessions_map[sid][-1] != path:
                    sessions_map[sid].append(path)
            
            sequences = {}
            dropoffs = {}
            for sid, paths in sessions_map.items():
                if len(paths) >= 2:
                    for i in range(len(paths) - 1):
                        seq = f"{paths[i]} -> {paths[i+1]}"
                        sequences[seq] = sequences.get(seq, 0) + 1
                
                if paths:
                    last_path = paths[-1]
                    dropoffs[last_path] = dropoffs.get(last_path, 0) + 1
            
            top_sequences = sorted([{"seq": k, "count": v} for k, v in sequences.items()], key=lambda x: x["count"], reverse=True)[:5]
            top_dropoffs = sorted([{"path": k, "count": v} for k, v in dropoffs.items()], key=lambda x: x["count"], reverse=True)[:5]

            # 5. Offer Funnel Stats
            offer_funnels = {}
            if traffic_type == "visitors":
                offer_stats_stmt = select(
                    BAEvent.offer_id, 
                    BAEvent.event_type, 
                    func.count(BAEvent.id)
                ).where(
                    BAEvent.business_id == bid,
                    BAEvent.offer_id.isnot(None),
                    BAEvent.timestamp >= start_date
                )
                offer_stats_stmt = offer_stats_stmt.group_by(BAEvent.offer_id, BAEvent.event_type)
                offer_rows = (await session.execute(offer_stats_stmt)).all()
                for oid, etype, count in offer_rows:
                    if oid not in offer_funnels: offer_funnels[oid] = {"offer_id": oid, "views": 0, "clicks": 0, "conversions": 0}
                    if etype == "pageview": offer_funnels[oid]["views"] += count
                    elif etype == "click": offer_funnels[oid]["clicks"] += count
                    elif etype == "conversion": offer_funnels[oid]["conversions"] += count

            return {
                "chart_data": sorted(chart_data.values(), key=lambda x: x["date"]),
                "top_pages": [{"path": p[0], "count": p[1]} for p in top_pages],
                "top_clicks": [{"text": c[0], "count": c[1]} for c in top_clicks if c[0]],
                "top_sequences": top_sequences,
                "top_dropoffs": top_dropoffs,
                "offer_funnels": list(offer_funnels.values()),
                "summary": {
                    "total_sessions": sum([d.get("sessions", 0) for d in chart_data.values()]),
                    "total_pageviews": sum([d.get("pageviews", 0) for d in chart_data.values()]),
                    "unique_users": sum([d.get("unique_users", 0) for d in chart_data.values()])
                }
            }
        except Exception as e:
            logger.error(f"Error BA Dashboard: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail="BA Dashboard fetch failed")

@app.get("/api/business-status")
async def read_business_status(business_id: str):
    from services.db_service import resolve_business_id, get_business_status
    bid = await resolve_business_id(business_id)
    status = await get_business_status(bid)
    if not status:
        raise HTTPException(status_code=404, detail="Business not found")
    return status

@app.get("/api/business-profile")
async def get_profile(business_id: str):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    return await get_business_profile(bid)

@app.post("/api/business-profile")
async def update_profile(profile: BusinessProfile):
    from services.db_service import resolve_business_id
    try:
        data = profile.dict(exclude_unset=True)
        bid = data.pop('business_id', None)
        if not bid:
            raise HTTPException(status_code=400, detail="business_id is required in the request body")
            
        real_bid = await resolve_business_id(bid)
        
        result = await update_business_profile(real_bid, data)
        if result is None:
            raise HTTPException(status_code=400, detail="Could not update business profile. Ensure the business exists.")
            
        return {"status": "updated", "business_id": real_bid}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in update_profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class SaveRoutingConfigRequest(BaseModel):
    department: str
    display_name: Optional[str] = None
    notification_phone: Optional[str] = None
    notification_email: Optional[str] = None
    primary_user_id: Optional[str] = None
    routing_enabled: Optional[bool] = True
    whatsapp_enabled: Optional[bool] = True
    email_enabled: Optional[bool] = True
    escalation_enabled: Optional[bool] = False
    escalation_timeout_minutes: Optional[int] = 30
    escalation_user_id: Optional[str] = None
    escalation_level2_user_id: Optional[str] = None
    property_id: Optional[str] = None

@app.get("/api/business/routing-configs")
async def get_routing_configs_endpoint(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from database.session import AsyncSessionLocal
    from database.models.general import DepartmentConfig
    
    async with AsyncSessionLocal() as session:
        stmt = select(DepartmentConfig).where(DepartmentConfig.business_id == current_user.get("business_id"))
        res = await session.execute(stmt)
        configs = res.scalars().all()
        return [
            {
                "id": c.id,
                "department": c.department,
                "display_name": c.display_name,
                "notification_phone": c.notification_phone,
                "notification_email": c.notification_email,
                "primary_user_id": c.primary_user_id,
                "routing_enabled": c.routing_enabled,
                "whatsapp_enabled": c.whatsapp_enabled,
                "email_enabled": c.email_enabled,
                "escalation_enabled": c.escalation_enabled,
                "escalation_timeout_minutes": c.escalation_timeout_minutes,
                "escalation_user_id": c.escalation_user_id,
                "escalation_level2_user_id": c.escalation_level2_user_id,
                "property_id": c.property_id
            } for c in configs
        ]

@app.post("/api/business/routing-configs")
async def save_routing_config_endpoint(body: SaveRoutingConfigRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from database.session import AsyncSessionLocal
    from database.models.general import DepartmentConfig
    
    bid = current_user.get("business_id")
    
    async with AsyncSessionLocal() as session:
        stmt = select(DepartmentConfig).where(
            DepartmentConfig.business_id == bid,
            DepartmentConfig.department == body.department
        )
        if body.property_id:
            stmt = stmt.where(DepartmentConfig.property_id == body.property_id)
        else:
            stmt = stmt.where(DepartmentConfig.property_id.is_(None))
            
        res = await session.execute(stmt)
        config_obj = res.scalar_one_or_none()
        
        # Clean phone
        phone_normalized = normalize_agent_phone(body.notification_phone) if body.notification_phone else None
        
        if config_obj:
            # Update
            config_obj.display_name = body.display_name
            config_obj.notification_phone = phone_normalized
            config_obj.notification_email = body.notification_email
            config_obj.primary_user_id = body.primary_user_id
            config_obj.routing_enabled = body.routing_enabled if body.routing_enabled is not None else config_obj.routing_enabled
            config_obj.whatsapp_enabled = body.whatsapp_enabled if body.whatsapp_enabled is not None else config_obj.whatsapp_enabled
            config_obj.email_enabled = body.email_enabled if body.email_enabled is not None else config_obj.email_enabled
            config_obj.escalation_enabled = body.escalation_enabled if body.escalation_enabled is not None else config_obj.escalation_enabled
            config_obj.escalation_timeout_minutes = body.escalation_timeout_minutes if body.escalation_timeout_minutes is not None else config_obj.escalation_timeout_minutes
            config_obj.escalation_user_id = body.escalation_user_id
            config_obj.escalation_level2_user_id = body.escalation_level2_user_id
        else:
            # Create
            config_obj = DepartmentConfig(
                business_id=bid,
                department=body.department,
                display_name=body.display_name,
                notification_phone=phone_normalized,
                notification_email=body.notification_email,
                primary_user_id=body.primary_user_id,
                routing_enabled=body.routing_enabled if body.routing_enabled is not None else True,
                whatsapp_enabled=body.whatsapp_enabled if body.whatsapp_enabled is not None else True,
                email_enabled=body.email_enabled if body.email_enabled is not None else True,
                escalation_enabled=body.escalation_enabled if body.escalation_enabled is not None else False,
                escalation_timeout_minutes=body.escalation_timeout_minutes if body.escalation_timeout_minutes is not None else 30,
                escalation_user_id=body.escalation_user_id,
                escalation_level2_user_id=body.escalation_level2_user_id,
                property_id=body.property_id
            )
            session.add(config_obj)
            
        await session.commit()
        return {"status": "success", "config_id": config_obj.id}

@app.post("/api/notifications/{event_id}/acknowledge")
async def acknowledge_notification_endpoint(event_id: str, current_user: dict = Depends(get_current_user)):
    from database.session import AsyncSessionLocal
    from database.models.general import NotificationEvent
    
    async with AsyncSessionLocal() as session:
        event = await session.get(NotificationEvent, event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Notification event not found")
            
        # Verify tenant isolation
        if event.business_id != current_user.get("business_id"):
            raise HTTPException(status_code=403, detail="Permission denied")
            
        event.status = "acknowledged"
        event.acknowledged_at = datetime.utcnow()
        event.acknowledged_by = current_user.get("id")
        
        await session.commit()
        return {"status": "success", "message": "Notification acknowledged"}

@app.post("/api/notifications/{event_id}/assign")
async def assign_escalation_endpoint(event_id: str, current_user: dict = Depends(get_current_user)):
    from database.session import AsyncSessionLocal
    from database.models.general import NotificationEvent
    from database.models.chat import Conversation
    
    async with AsyncSessionLocal() as session:
        event = await session.get(NotificationEvent, event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Notification event not found")
            
        # Verify tenant isolation
        if event.business_id != current_user.get("business_id"):
            raise HTTPException(status_code=403, detail="Permission denied")
            
        # Acknowledge event
        event.status = "acknowledged"
        event.acknowledged_at = datetime.utcnow()
        event.acknowledged_by = current_user.get("id")
        
        # Assign conversation
        if event.conversation_id:
            convo = await session.get(Conversation, event.conversation_id)
            if convo:
                convo.assigned_agent_id = current_user.get("id")
                convo.mode = "human" # Assign to human
                session.add(convo)
                
        await session.commit()
        return {"status": "success", "message": "Conversation assigned and notification acknowledged"}

@app.get("/api/whatsapp/config")
async def get_whatsapp_config_endpoint(business_id: str):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    config = await get_whatsapp_config(bid)
    if not config:
        return {"status": "not_configured"}
    return {"status": "success", "config": config}

@app.post("/api/whatsapp/config")
async def update_whatsapp_config_endpoint(req: WhatsAppConfigRequest):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(req.business_id)
    data = req.dict(exclude_unset=True)
    data.pop('business_id')
    logger.info(f"[WHATSAPP_ONBOARDING] Saving credentials/config for {bid}")
    if "is_active" in data:
        logger.info(f"[WHATSAPP_ONBOARDING] Activation toggled for {bid} to {data['is_active']}")
    success = await update_whatsapp_config(bid, data)
    return {"status": "success" if success else "failed", "success": success}

@app.post("/api/whatsapp/test-message")
async def test_whatsapp_message(business_id: str, phone: str):
    from services.db_service import resolve_business_id, get_whatsapp_config, update_whatsapp_config
    from services.whatsapp_service import normalize_phone_number
    import httpx
    
    bid = await resolve_business_id(business_id)
    logger.info(f"[WHATSAPP_ONBOARDING] Starting connection test for business: {bid}")
    config = await get_whatsapp_config(bid)
    
    if not config or not config.get("access_token") or not config.get("phone_number_id"):
        logger.error(f"[WHATSAPP_ONBOARDING] Configuration missing for business: {bid}")
        raise HTTPException(status_code=400, detail="WhatsApp configuration missing.")
        
    api_token = config.get("access_token")
    phone_id = config.get("phone_number_id")
    to_number = normalize_phone_number(phone)
    
    if not to_number:
        logger.error(f"[WHATSAPP_ONBOARDING] Invalid phone number provided: '{phone}'")
        raise HTTPException(status_code=400, detail="Invalid phone number. Please enter digits only (e.g., 2348000000000).")
    
    url = f"https://graph.facebook.com/v17.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "text": {"body": "Hello! This is a test message from your InteracAI dashboard. Your setup is complete!"}
    }
    
    logger.info(f"[WHATSAPP_ONBOARDING] Sending test message via API to {to_number}")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code in [200, 201]:
                logger.info(f"[WHATSAPP_ONBOARDING] Test successful. Marking is_active=True for {bid}")
                await update_whatsapp_config(bid, {"is_active": True})
                return {"status": "success", "success": True, "is_active": True, "message": "Test message sent and connection activated!"}
            else:
                logger.error(f"[WHATSAPP_ONBOARDING] WhatsApp Test Failed: {response.text}")
                raise HTTPException(status_code=400, detail=f"Failed to send test message: {response.text}")
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"[WHATSAPP_ONBOARDING] Error calling WhatsApp API for test: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/train/{business_id}")
async def train_business_ai(business_id: str):
    # Retrieve current profile and knowledge to "simulate" training or fine-tune
    # For now, we just ensure knowledge is indexed (if using vector db later)
    return {"status": "trained", "message": "Business AI updated with latest knowledge."}

@app.post("/api/web-chat")
async def web_chat(body: WebMessage):
    from services.scheduling_service import scheduling_service
    try:
        profile_id = await resolve_business_id(body.business_id)
        # real_business_id is now consistently the UUID if user found
        real_business_id = profile_id 
        
        if "@" in body.business_id and profile_id == body.business_id:
            # Fallback for when resolve_business_id didn't find a user but it IS an email
            logger.warning(f"Could not resolve business_id from email {body.business_id}")

        # Global Access Enforcement
        from services.subscription_service import check_access, track_conversation
        access = await check_access(real_business_id)
        if not access["allowed"]:
            logger.warning(f"[WebChat] Access Denied for {real_business_id}: {access['reason']}")
            return {"reply": f"Access Denied: {access['reason']}. Please upgrade your plan to continue.", "status": "blocked", "code": access["code"]}

        # 0. Check Conversation State (Arbitration Phase 0)
        from database.models.chat import Conversation
        from database.session import AsyncSessionLocal
        
        async with AsyncSessionLocal() as session:
            convo_id = f"{real_business_id}:{body.user_id}"
            convo = await session.get(Conversation, convo_id)
            if convo and convo.mode == "human":
                logger.info(f"[WebChat] Conversation {convo_id} is in HUMAN mode. Storing message and skipping AI.")
                await store_message(real_business_id, body.user_id, body.message, "customer", platform="web")
                return {"reply": None, "status": "human_mode"}

        # Store User Message (Persistence)
        await store_message(real_business_id, body.user_id, body.message, "customer", platform="web")

        # Track Conversation (24h window)
        await track_conversation(real_business_id, body.user_id)

        # 1. Fetch Chat History BEFORE storing new message (Clean Context)
        raw_history = await get_chat_history(real_business_id, body.user_id, limit=5)
        
        # Pre-resolve Lead for CRM linking
        from services.db_service import get_lead_by_conversation, get_active_offers_intelligence, get_lead_by_contact, save_lead
        lead_obj = await get_lead_by_conversation(real_business_id, f"{real_business_id}:{body.user_id}")
        
        if not lead_obj:
            # Auto-create a 'Visitor' lead if it doesn't exist
            new_lead_id = await save_lead(real_business_id, {
                "name": f"Visitor {body.user_id[:8]}",
                "conversation_id": f"{real_business_id}:{body.user_id}",
                "status": "new",
                "custom_fields": {"captured_via": "web_chat_auto"}
            })
            lead_obj = await get_lead_by_conversation(real_business_id, f"{real_business_id}:{body.user_id}")

        lead_id = lead_obj.id if lead_obj else None # Ensure lead_id is defined and is numeric
        
        if not lead_id:
            # Fallback: Try to resolve by email/phone from history or current message
            # Quick regex for email/phone
            email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', body.message)
            # Match digits 7-15 for phone
            phone_match = re.search(r'\d{7,15}', body.message)
            
            extracted_email = email_match.group(0) if email_match else None
            extracted_phone = phone_match.group(0) if phone_match else None
            
            # Scan history if current message missing info
            if not extracted_email or not extracted_phone:
                for msg in reversed(raw_history):
                    if not extracted_email:
                        m = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', msg['text'])
                        if m: extracted_email = m.group(0)
                    if not extracted_phone:
                        m = re.search(r'\d{7,15}', msg['text'])
                        if m: extracted_phone = m.group(0)
            
            if extracted_email or extracted_phone:
                lead_id = await get_lead_by_contact(real_business_id, email=extracted_email, phone=extracted_phone)
        
        formatted_history = []
        for msg in raw_history:
            role = "user" if msg['sender'] == 'customer' else "assistant"
            formatted_history.append({"role": role, "content": msg['text']})

        # 3. Detect Intent & Sentiment (Prompt Service)
        from services.prompt_service import prompt_service
        from services.db_service import get_business_profile
        
        detected_intent = await prompt_service.detect_intent(body.message)
        sentiment_data = await prompt_service.analyze_sentiment(body.message)
        sentiment = sentiment_data.get("sentiment", "Neutral")
        
        # Keyword Detection (Business Configurable)
        biz_profile = await get_business_profile(real_business_id)
        auto_escalate = biz_profile.get("auto_escalate_on_keyword", False)
        handover_keywords = ["human", "agent", "support", "representative", "person", "talk to someone"]
        
        keyword_match = False
        for kw in handover_keywords:
            if kw in body.message.lower():
                keyword_match = True
                break
        
        if auto_escalate and keyword_match:
            logger.info(f"[WebChat] AUTO-ESCALATE triggered for {body.user_id} due to keyword match.")
            from services.db_service import set_conversation_mode
            await set_conversation_mode(real_business_id, body.user_id, mode="human", status="waiting")
            return {"reply": "I'm transferring you to a human agent now. Please wait...", "status": "auto_escalated"}

        # 4. Check Workflow Automations
        # Trigger event data
        trigger_data = {
            "message": body.message,
            "message_body": body.message, # ALIAS for engine compatibility
            "intent": detected_intent,
            "sentiment": sentiment_data.get("sentiment", "neutral"),
            "sentiment_score": sentiment_data.get("score", 0.5),
            "keywords": [kw for kw in handover_keywords if kw in body.message.lower()],
            "user_id": body.user_id,
            "platform": "web",
            "business_id": body.business_id # CRITICAL: Include in context for nodes
        }
        
        # 3.1 Fire and Forget Workflow Trigger
        executions, takes_over_chat = await workflow_engine.trigger_workflow(real_business_id, "message_created", trigger_data)
        
        if executions and takes_over_chat:
            return {"reply": None, "status": "workflow_processing", "executions": executions}
        
        # 3.2 Dynamic Context injection (Scheduling)
        extra_context = ""
        
        # Check if we should inject booking context (e.g., booking, scheduling, talking/meeting with a team)
        is_booking_intent = (
            detected_intent == "booking" or 
            "book" in body.message.lower() or 
            "schedule" in body.message.lower() or
            "appointment" in body.message.lower() or
            "slot" in body.message.lower() or
            "talk to" in body.message.lower() or
            "speak to" in body.message.lower() or
            "meet with" in body.message.lower() or
            "call with" in body.message.lower() or
            ("billing" in body.message.lower() and ("team" in body.message.lower() or "talk" in body.message.lower() or "connect" in body.message.lower()))
        )
        
        # Also check history: if the last human message was booking, or AI just sent slots
        in_booking_flow = is_booking_intent
        if not in_booking_flow and formatted_history:
            # Check last 3 messages for "booking" markers robustly
            booking_keywords = ["book", "schedule", "appointment", "meeting", "call", "slot", "reserve", "availability", "available"]
            for h in formatted_history[-3:]:
                content_lower = h['content'].lower()
                if any(k in content_lower for k in booking_keywords):
                    in_booking_flow = True
                    break

        if in_booking_flow:
            from services.scheduling_service import scheduling_service
            # Resolve query context from current message and recent history
            context_search_text = body.message
            if formatted_history:
                context_search_text += " " + " ".join([m.get("content", "") for m in formatted_history[-5:]])
            availability_data = await scheduling_service.get_upcoming_available_slots(real_business_id, query_context=context_search_text)
            
            now = datetime.utcnow()
            extra_context = f"\n*** LIVE AVAILABILITY ***\n"
            extra_context += f"IMPORTANT: Today is {now.strftime('%A, %B %d, %Y')}. The current time is {now.strftime('%H:%M')} UTC.\n"

            if availability_data and availability_data.get("slots"):
                extra_context += f"Available Slots for {availability_data['appointment_type']} (ID: {availability_data['appointment_type_id']}):\n"
                for date, slots in availability_data['slots'].items():
                    extra_context += f"- {date}: {', '.join(slots)}\n"
                
                extra_context += "\nINSTRUCTIONS:\n"
                has_email = lead_obj and getattr(lead_obj, 'email', None)
                has_name = lead_obj and getattr(lead_obj, 'name', None) and not lead_obj.name.startswith('Visitor')
                
                if not (has_email and has_name):
                    extra_context += "1. CRITICAL: We need the user's name and email to send the calendar invite. You MUST ask for their full name and email address BEFORE confirming any booking.\n"
                    extra_context += "2. Do NOT use the [ACTION: BOOKING] tag until the user has provided their name and email.\n"
                    extra_context += "3. Once they provide their details and pick a time, use the [ACTION: BOOKING | {...}] tag to schedule it. You must also include the [ACTION: LEAD_CAPTURE | {\"name\": \"...\", \"email\": \"...\"}] tag in your response to save their contact info.\n"
                else:
                    extra_context += "1. If the user picks a slot or confirms a time, you MUST include the [ACTION: BOOKING | {...}] tag in your response. This is the ONLY way the system records the appointment.\n"
                
                extra_context += "4. Ensure the year is 2026.\n"
                extra_context += "5. The appointment_type_id MUST be exactly as shown above.\n"
                extra_context += "6. Do not just confirm verbally; the [ACTION: BOOKING] tag is mandatory for the booking to be successful.\n"
            else:
                # No slots found. Explain why to the AI so it can explain to the user.
                extra_context += "STATUS: NO SLOTS AVAILABLE.\n"
                extra_context += "REASON: Either no Appointment Types are active or no Availability Rules (working hours) have been set up in the dashboard.\n"
                extra_context += "INSTRUCTION: Politely inform the user that online booking is currently unavailable for this business. If you think the user IS the business owner, suggest they check their 'Scheduling' settings in the dashboard to set up their availability rules.\n"
                
            # CHECK FOR EXISTING FUTURE APPOINTMENTS FOR THIS USER
            if lead_id:
                try:
                    existing_future_apts = await scheduling_service.get_business_appointments(
                        business_id=real_business_id,
                        lead_id=lead_id,
                        start_date=now
                    )
                    # Filter for only scheduled/confirmed
                    active_future_apts = [a for a in existing_future_apts if a.status in ('scheduled', 'confirmed')]
                    
                    if active_future_apts:
                        extra_context += "\nCRITICAL CONTEXT: EXISTING BOOKINGS DETECTED\n"
                        extra_context += "The user ALREADY has the following future appointment(s):\n"
                        for apt in active_future_apts:
                            extra_context += f"- {apt.start_at.strftime('%A, %B %d at %H:%M')}\n"
                        extra_context += "INSTRUCTION: Before offering new slots, you MUST inform the user they already have this booking. Ask if they want to keep it, cancel it, or book an additional one.\n"
                except Exception as e:
                    logger.error(f"[Chat] Error fetching existing appointments for context: {e}")

        # Resolve Phase 3 Context
        lead_context = {
            "status": lead_obj.status if lead_obj else "new",
            "custom_fields": lead_obj.custom_fields if lead_obj else {}
        } if lead_obj else None
        
        offers_context = await get_active_offers_intelligence(real_business_id)
        
        profile = await get_business_profile(profile_id)
        knowledge_docs = await get_knowledge_documents(profile_id)
        if knowledge_docs:
            profile['knowledge_docs'] = knowledge_docs

        system_instruction = prompt_service.build_system_prompt(profile, lead_context=lead_context, offers_context=offers_context)
        if extra_context:
            system_instruction += extra_context
        
        ai_reply = await generate_response(
            body.message, 
            formatted_history, 
            body.user_id, 
            system_instruction=system_instruction,
            business_id=real_business_id
        )

        # 5. Post-Processing (Action Parsers)
        
        # [ACTION: LEAD_CAPTURE | JSON]
        lead_match = re.search(r'\[ACTION: LEAD_CAPTURE\s*\|\s*(?P<json>\{.*?\})\]', ai_reply, re.IGNORECASE | re.DOTALL)
        if lead_match:
            try:
                lead_json_str = lead_match.group('json')
                # Clean up potential markdown formatting from AI
                lead_json_str = lead_json_str.strip()
                if lead_json_str.startswith("```json"):
                    lead_json_str = lead_json_str.replace("```json", "", 1)
                if lead_json_str.endswith("```"):
                    lead_json_str = lead_json_str.rsplit("```", 1)[0]
                
                lead_data = json.loads(lead_json_str)
                
                # Field Mapping (AI might use 'contact' instead of 'email'/'phone')
                if "contact" in lead_data and not lead_data.get("email") and not lead_data.get("phone"):
                    contact = str(lead_data["contact"])
                    if "@" in contact:
                        lead_data["email"] = contact
                    else:
                        lead_data["phone"] = contact
                    del lead_data["contact"]

                # Inject matching conversation_id for CRM linking (Composite ID)
                lead_data["conversation_id"] = f"{real_business_id}:{body.user_id}"
                
                lead_id = await save_lead(real_business_id, lead_data)
                ai_reply = ai_reply.replace(lead_match.group(0), "").strip()
            except Exception as e:
                logger.error(f"[Chat] Error parsing lead capture: {e}")

        # [ACTION: FUNNEL_PROGRESS | JSON] (Phase 3)
        funnel_match = re.search(r'\[ACTION: FUNNEL_PROGRESS\s*\|\s*(?P<json>\{.*?\})\]', ai_reply, re.IGNORECASE | re.DOTALL)
        if funnel_match:
            try:
                from services.behavior_analytics_service import behavior_analytics_service
                funnel_json_str = funnel_match.group('json').strip()
                if funnel_json_str.startswith("```json"):
                    funnel_json_str = funnel_json_str.replace("```json", "", 1)
                if funnel_json_str.endswith("```"):
                    funnel_json_str = funnel_json_str[:-3].strip()
                
                funnel_data = json.loads(funnel_json_str)
                
                await behavior_analytics_service.track_event(real_business_id, body.user_id, {
                    "type": "funnel_progression",
                    "offer_id": funnel_data.get("offer_id"),
                    "funnel_id": funnel_data.get("funnel_id"),
                    "properties": {"step": funnel_data.get("step"), "platform": "web"}
                })
                ai_reply = ai_reply.replace(funnel_match.group(0), "").strip()
            except Exception as e:
                logger.error(f"[Chat] Error parsing funnel progression: {e}")

        # 5.1 Parse ANALYSIS tag for better Intent/Sentiment
        analysis_match = re.search(r'\[ANALYSIS:\s*(?P<intent>.*?)\s*\|\s*(?P<sentiment>.*?)\s*\]', ai_reply, re.IGNORECASE)
        if analysis_match:
            ai_intent = analysis_match.group('intent').strip().lower()
            ai_sentiment = analysis_match.group('sentiment').strip()
            if ai_intent in ["booking", "enquiry", "pricing", "support", "greeting", "features", "integration", "complaint", "feedback", "human"]:
                detected_intent = ai_intent
                sentiment = ai_sentiment
            
            # Remove internal [ANALYSIS: ...] tag
            ai_reply = ai_reply.replace(analysis_match.group(0), "").strip()

        # 5.2 Parse BOOKING action
        # More robust regex to handle potential markdown or formatting quirks
        booking_match = re.search(r'\[ACTION: BOOKING\s*\|\s*(?P<json>\{.*?\})\]', ai_reply, re.IGNORECASE | re.DOTALL)
        if booking_match:
            try:
                booking_json_str = booking_match.group('json').strip()
                
                # Clean up potential markdown code blocks robustly
                booking_json_str = re.sub(r'^```(?:json)?\s*', '', booking_json_str)
                booking_json_str = re.sub(r'\s*```$', '', booking_json_str)
                booking_json_str = booking_json_str.strip()
                
                try:
                    booking_data = json.loads(booking_json_str)
                except json.JSONDecodeError:
                    import ast
                    try:
                        booking_data = ast.literal_eval(booking_json_str)
                    except Exception:
                        raise ValueError(f"Invalid booking JSON format: {booking_json_str}")
                
                # Normalize keys (lowercase and remove underscores) for robustness
                normalized_data = {}
                for k, v in booking_data.items():
                    norm_k = k.lower().replace("_", "").replace("-", "")
                    normalized_data[norm_k] = v
                
                apt_type_id = normalized_data.get('appointmenttypeid')
                start_at_str = normalized_data.get('startat')
                
                if not apt_type_id or not start_at_str:
                    raise KeyError(f"Missing required booking fields (appointment_type_id/start_at) in normalized keys: {normalized_data}")
                
                # Verify and resolve appointment_type_id fuzzy match
                is_valid_uuid = False
                try:
                    import uuid
                    uuid.UUID(str(apt_type_id))
                    is_valid_uuid = True
                except ValueError:
                    pass
                
                from database.models.scheduling import AppointmentType
                async with AsyncSessionLocal() as session:
                    type_stmt = select(AppointmentType).where(AppointmentType.business_id == real_business_id, AppointmentType.is_active == True)
                    type_res = await session.execute(type_stmt)
                    active_types = type_res.scalars().all()
                
                if active_types:
                    resolved_type = None
                    if is_valid_uuid:
                        for at in active_types:
                            if str(at.id) == str(apt_type_id):
                                resolved_type = at
                                break
                    
                    if not resolved_type:
                        apt_type_id_lower = str(apt_type_id).lower()
                        for at in active_types:
                            at_name_lower = at.name.lower()
                            if at_name_lower in apt_type_id_lower or apt_type_id_lower in at_name_lower:
                                resolved_type = at
                                break
                        if not resolved_type:
                            resolved_type = active_types[0]
                    
                    apt_type_id = resolved_type.id
                
                start_at_str = str(start_at_str).strip()
                # Strip trailing 'Z' or 'z' for Python 3.9 compatibility
                if start_at_str.endswith('Z') or start_at_str.endswith('z'):
                    start_at_str = start_at_str[:-1]
                
                start_at = None
                # Try common formats first
                for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M"):
                    try:
                        start_at = datetime.strptime(start_at_str[:19], fmt)
                        break
                    except ValueError:
                        continue
                
                if not start_at:
                    start_at = datetime.fromisoformat(start_at_str)
                    if start_at.tzinfo is not None:
                        start_at = start_at.replace(tzinfo=None)
                
                # Correct date if year is wrong or date is in the past
                today_date = datetime.utcnow().date()
                if start_at.date() < today_date or start_at.year < 2026:
                    msg_lower = body.message.lower()
                    target_date = today_date
                    if "tomorrow" in msg_lower:
                        target_date = today_date + timedelta(days=1)
                    else:
                        day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                        for day_name in day_names:
                            if day_name in msg_lower:
                                for i in range(4):
                                    d = today_date + timedelta(days=i)
                                    if d.strftime("%A").lower() == day_name:
                                        target_date = d
                                        break
                                break
                    start_at = datetime.combine(target_date, start_at.time())
                
                # Attempt booking
                book_res = await scheduling_service.book_appointment(
                    business_id=real_business_id,
                    appointment_type_id=apt_type_id,
                    start_at=start_at,
                    lead_id=lead_id,
                    conversation_id=f"{real_business_id}:{body.user_id}",
                    notes=f"Booked via AI Chat"
                )
                
                if book_res['success']:
                    # 1. Generate Calendar Links for AI reply and Automation
                    from services.calendar_service import calendar_service
                    
                    profile = await get_business_profile(real_business_id)
                    biz_name = profile.get('name', 'Copac Group')
                    
                    cal_link = calendar_service.generate_google_calendar_link(
                        title=f"{biz_name} Call",
                        start_at=start_at,
                        duration_minutes=30, # Defaulting to 30 for now
                        description=f"Automated booking via InteracAI for {biz_name}."
                    )
                    
                    # 2. Trigger Workflow (Email Automation)
                    # We try to be very aggressive about finding the email for the automated confirmation
                    customer_email = body.message if "@" in body.message else None
                    customer_name = "Valued Customer"
                    
                    # If we have a real lead, that's our best source
                    if lead_id:
                        from database.models.crm import Lead
                        async with AsyncSessionLocal() as session:
                            lead = await session.get(Lead, lead_id)
                            if lead:
                                if lead.email: customer_email = lead.email
                                if lead.name: customer_name = lead.name

                    # Last fallback: search history if we still don't have it
                    if not customer_email:
                        # Extract from recent history (search for any email pattern)
                        all_text = " ".join([m.get("content", "") for m in (formatted_history or [])])
                        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', all_text)
                        if email_match:
                            customer_email = email_match.group(0)

                    trigger_data = {
                        "user_id": body.user_id,
                        "appointment_time": start_at.strftime("%A, %B %d at %I:%M %p"),
                        "calendar_link": cal_link,
                        "business_name": biz_name,
                        "customer_email": customer_email,
                        "email": customer_email, # For nodes that use 'email'
                        "customer_name": customer_name,
                        "business_id": real_business_id
                    }
                    
                    logger.info(f"[Chat] Triggering 'appointment_booked' for email: {customer_email}")
                    await workflow_engine.trigger_workflow(real_business_id, "appointment_booked", trigger_data)
                    
                    # Direct Email Send to Customer with Google Calendar link
                    if customer_email:
                        from services.email_service import EmailService
                        email_subject = f"Appointment Confirmed: {biz_name} Call"
                        email_html = f"""
                        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
                            <h2 style="color: #4f46e5; margin-top: 0;">Appointment Confirmed!</h2>
                            <p>Hi {customer_name},</p>
                            <p>Your appointment with <strong>{biz_name}</strong> has been successfully scheduled.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p><strong>Time:</strong> {start_at.strftime('%A, %B %d, %Y at %I:%M %p')} UTC</p>
                            <p>Please click the button below to add this call to your Google Calendar:</p>
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="{cal_link}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Add to Google Calendar</a>
                            </p>
                            <p style="color: #666; font-size: 12px; margin-bottom: 0;">Automated booking via InteracAI.</p>
                        </div>
                        """
                        logger.info(f"[Chat] Sending direct confirmation email to {customer_email}")
                        import asyncio
                        async def send_and_log():
                            try:
                                success, err = await EmailService.send_email(
                                    to=customer_email,
                                    subject=email_subject,
                                    html_content=email_html,
                                    business_id=real_business_id,
                                    bypass_active=True
                                )
                                with open("email_debug.txt", "a") as f:
                                    f.write(f"[{datetime.utcnow().isoformat()}] Sent to {customer_email}. Success: {success}, Error: {err}\n")
                            except Exception as e:
                                with open("email_debug.txt", "a") as f:
                                    f.write(f"[{datetime.utcnow().isoformat()}] Exception sending to {customer_email}: {str(e)}\n")
                        asyncio.create_task(send_and_log())
                    
                    # 3. Inform AI response
                    ai_reply = ai_reply.replace(booking_match.group(0), "").strip()
                    
                    # If the AI was optimistic but we failed, it's better to replace the message entirely
                    if not book_res['success']:
                        ai_reply = "I'm sorry, I tried to book that time but it just became unavailable. Could we try another slot?"
                    else:
                        # Append the calendar link
                        ai_reply += f"\n\n📅 [Add to Google Calendar]({cal_link})"
                else:
                    # Clear optimistic reply and replace with failure
                    ai_reply = "I'm sorry, I tried to book that time but it just became unavailable. Could we try another slot?"
            except Exception as e:
                import traceback
                error_tb = traceback.format_exc()
                logger.error(f"[Chat] Booking processing error: {e}\n{error_tb}")
                try:
                    with open("booking_error_debug.txt", "w") as f:
                        f.write(f"Timestamp: {datetime.utcnow().isoformat()}\n")
                        f.write(f"Exception: {str(e)}\n")
                        f.write(f"Traceback:\n{error_tb}\n")
                        f.write(f"AI Reply: {ai_reply}\n")
                        if 'booking_match' in locals() and booking_match:
                            f.write(f"Booking Match: {booking_match.group(0)}\n")
                except Exception as write_err:
                    logger.error(f"Failed to write booking debug file: {write_err}")
                ai_reply = "I encountered an error processing the booking. Please try again or contact support."

        # Final cleanup of any remaining internal markers
        ai_reply = re.sub(r'\[ACTION:.*?\]', '', ai_reply).strip()
        ai_reply = re.sub(r'\[ANALYSIS:.*?\]', '', ai_reply).strip()

        await store_message(real_business_id, body.user_id, ai_reply, "bot", platform="web", intent=detected_intent, sentiment=sentiment)
        
        return {"reply": ai_reply}
    except Exception as e:
        import traceback
        logger.error(f"FATAL ERROR IN WEB CHAT ROUTE: {e}\n{traceback.format_exc()}")
        return {"reply": f"Sorry, I'm having trouble connecting right now. (Error: {str(e)})", "status": "error"}

@app.get("/api/web-chat/history")
async def get_chat_history_endpoint(business_id: str, user_id: str):
    from services.db_service import resolve_business_id
    real_bid = await resolve_business_id(business_id)
    history = await get_chat_history(real_bid, user_id, limit=50)
    # Return in chronological order (Oldest -> Newest) which get_chat_history already does
    return {"messages": history}

# --- Knowledge Base endpoints ---

@app.post("/api/knowledge/upload")
async def upload_knowledge(business_id: str, file: UploadFile = File(...)):
    if not file.filename.endswith(('.docx', '.txt')):
        raise HTTPException(status_code=400, detail="Only .docx and .txt files are supported")
    
    content = await file.read()
    text = await extract_text_from_file(content, file.filename)
    
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from file")
        
    doc_data = {
        "title": file.filename,
        "type": "file",
        "content": text
    }
    
    doc_id = await add_knowledge_document(business_id, doc_data)
    return {"status": "success", "id": doc_id, "text_preview": text[:200]}

class ScrapeRequest(BaseModel):
    url: str
    business_id: str

@app.post("/api/knowledge/scrape")
async def scrape_knowledge(req: ScrapeRequest):
    text = await scrape_url(req.url)
    
    if "Error" in text and len(text) < 100:
         raise HTTPException(status_code=400, detail=text)
         
    doc_data = {
        "title": req.url,
        "type": "url",
        "content": text
    }
    
    doc_id = await add_knowledge_document(req.business_id, doc_data)
    return {"status": "success", "id": doc_id, "text_preview": text[:200]}

@app.get("/api/knowledge")
async def list_knowledge(business_id: str):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    return await get_knowledge_documents(bid)

@app.delete("/api/knowledge/{doc_id}")
async def delete_knowledge(doc_id: str, business_id: str):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    success = await delete_knowledge_document(bid, doc_id)
    return {"status": "success" if success else "failed"}

# --- Workflow Management API ---

@app.post("/api/workflows")
async def create_workflow_endpoint(workflow_data: dict):
    from services.db_service import resolve_business_id
    bid = workflow_data.get("business_id", "default")
    real_bid = await resolve_business_id(bid)
    result = await workflow_engine.create_workflow(real_bid, workflow_data)
    return result

@app.get("/api/workflows")
async def list_workflows(business_id: str = "default"):
    from services.db_service import resolve_business_id
    real_bid = await resolve_business_id(business_id)
    wfs = await workflow_engine.get_workflows(real_bid)
    return wfs

@app.delete("/api/workflows/{workflow_id}")
async def delete_workflow_endpoint(workflow_id: str, business_id: str = "default"):
    from services.db_service import resolve_business_id
    real_bid = await resolve_business_id(business_id)
    success = await workflow_engine.delete_workflow(real_bid, workflow_id)
    if success:
        return {"status": "deleted", "id": workflow_id}
    else:
        raise HTTPException(status_code=404, detail="Workflow not found or access denied")

@app.post("/api/workflows/{workflow_id}/trigger")
async def trigger_workflow_manual(workflow_id: str, payload: dict):
    from services.db_service import resolve_business_id
    bid = payload.get("business_id", "default")
    real_bid = await resolve_business_id(bid)
    execution_id = await workflow_engine.trigger_specific_workflow(real_bid, workflow_id, payload)
    if execution_id:
        return {"status": "triggered", "execution_id": execution_id}
    else:
        raise HTTPException(status_code=400, detail="Failed to trigger workflow")

@app.get("/api/executions")
async def list_executions(business_id: str = "default", workflow_id: str = None):
    from services.db_service import resolve_business_id
    real_bid = await resolve_business_id(business_id)
    return await workflow_engine.get_executions(real_bid, workflow_id)

# --- Super Admin API moved to routes/admin_routes.py ---

# --- CRM API ---
from services.db_service import get_leads

@app.get("/api/leads")
async def list_leads(business_id: str):
    """Get all leads for a business"""
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    from services.db_service import get_leads
    return await get_leads(bid)

class LeadUpdate(BaseModel):
    status: str = None
    value: int = None
    tags: list = None

@app.patch("/api/leads/{lead_id}")
async def update_lead_endpoint(lead_id: int, update: LeadUpdate, business_id: str, user_id: str = "system"):
    """Update lead and log activity"""
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    updates = {k: v for k, v in update.dict().items() if v is not None}
    result = await update_lead(bid, lead_id, updates, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Lead not found")
    return result

@app.get("/api/leads/{lead_id}/activity")
async def get_lead_activity(lead_id: int, business_id: str):
    """Get activity timeline for a lead"""
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    return await get_lead_activities(bid, lead_id)

class MessageRequest(BaseModel):
    message: str
    user_id: str = "system"

@app.post("/api/leads/{lead_id}/message")
async def send_message_to_lead(lead_id: int, req: MessageRequest, business_id: str):
    """Send a message to a lead"""
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    result = await send_lead_message(bid, lead_id, req.message, req.user_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to send message"))
    return result

@app.post("/api/leads/{lead_id}/insights")
async def generate_lead_insights(lead_id: int, business_id: str):
    """Generate AI insights for a lead and log as activity"""
    from services.crm_intelligence import crm_intelligence
    from services.db_service import get_lead_activities, resolve_business_id
    from database.session import AsyncSessionLocal
    from database.models.crm import Lead, LeadActivity
    from sqlalchemy import select
    
    bid = await resolve_business_id(business_id)
    
    async with AsyncSessionLocal() as session:
        # Get lead
        lead = await session.get(Lead, lead_id)
        if not lead or lead.business_id != bid:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Calculate score
        lead_dict = {
            "email": lead.email,
            "phone": lead.phone,
            "value": lead.value,
            "tags": lead.tags,
            "status": lead.status,
            "last_interaction_at": lead.last_interaction_at
        }
        score_data = crm_intelligence.calculate_lead_score(lead_dict)
        
        # Log as activity
        activity = LeadActivity(
            lead_id=lead.id,
            business_id=bid,
            type="ai_insight",
            content={
                "insight_type": "lead_score",
                "score": score_data["score"],
                "tier": score_data["tier"],
                "factors": score_data["factors"]
            },
            created_by="ai",
            created_at=datetime.utcnow()
        )
        session.add(activity)
        await session.commit()
        
        return {
            "success": True,
            "insights": score_data
        }

# --- Scheduling API ---
from services.scheduling_service import scheduling_service
from database.models.scheduling import AppointmentType, AvailabilityRule
from sqlalchemy import select, delete

@app.get("/api/scheduling/types")
async def get_appointment_types(business_id: str):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    async with AsyncSessionLocal() as session:
        stmt = select(AppointmentType).where(AppointmentType.business_id == bid)
        res = await session.execute(stmt)
        return res.scalars().all()

@app.post("/api/scheduling/types")
async def create_appointment_type(business_id: str, req: AppointmentTypeRequest):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    async with AsyncSessionLocal() as session:
        apt_type = AppointmentType(
            business_id=bid,
            name=req.name,
            description=req.description,
            duration_minutes=req.duration_minutes,
            color_code=req.color_code
        )
        session.add(apt_type)
        await session.commit()
        await session.refresh(apt_type)
        return apt_type

@app.delete("/api/scheduling/types/{type_id}")
async def delete_appointment_type(type_id: str, business_id: str):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    async with AsyncSessionLocal() as session:
        await session.execute(delete(AppointmentType).where(AppointmentType.id == type_id, AppointmentType.business_id == bid))
        await session.commit()
        return {"status": "success"}

@app.get("/api/scheduling/availability")
async def get_availability(business_id: str):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    async with AsyncSessionLocal() as session:
        stmt = select(AvailabilityRule).where(AvailabilityRule.business_id == bid)
        res = await session.execute(stmt)
        return res.scalars().all()

@app.post("/api/scheduling/availability")
async def update_availability(business_id: str, rules: list[AvailabilityRuleRequest]):
    from services.db_service import resolve_business_id
    try:
        bid = await resolve_business_id(business_id)
        async with AsyncSessionLocal() as session:
            # Simple implementation: Clear and Replace
            await session.execute(delete(AvailabilityRule).where(AvailabilityRule.business_id == bid))
            
            for r in rules:
                from datetime import time as py_time
                import re
                
                # Robust time parsing
                # Supports "HH:MM", "HH:MM:SS", "HH:MM AM/PM"
                def parse_time_str(t_str):
                    t_str = t_str.strip().upper()
                    # Check for AM/PM
                    is_pm = "PM" in t_str
                    is_am = "AM" in t_str
                    
                    # Remove non-numeric/non-colon parts for basic splitting
                    clean_t = re.sub(r'[^0-9:]', '', t_str)
                    parts = list(map(int, clean_t.split(':')))
                    
                    hour = parts[0]
                    minute = parts[1] if len(parts) > 1 else 0
                    
                    if is_pm and hour < 12:
                        hour += 12
                    elif is_am and hour == 12:
                        hour = 0
                        
                    return py_time(hour % 24, minute % 60)

                rule = AvailabilityRule(
                    business_id=bid,
                    day_of_week=r.day_of_week,
                    start_time=parse_time_str(r.start_time),
                    end_time=parse_time_str(r.end_time),
                    is_active=r.is_active
                )
                session.add(rule)
            
            await session.commit()
            return {"status": "success"}
    except Exception as e:
        logger.error(f"Error updating availability for business {business_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


class SeedDataRequest(BaseModel):
    admin_key: str
    businesses: Optional[list[dict]] = None
    workflows: Optional[list[dict]] = None
    appointment_types: Optional[list[dict]] = None
    availability_rules: Optional[list[dict]] = None
    email_configs: Optional[list[dict]] = None
    settings: Optional[list[dict]] = None
    users: Optional[list[dict]] = None
    plans: Optional[list[dict]] = None
    subscriptions: Optional[list[dict]] = None
    wallets: Optional[list[dict]] = None

@app.post("/api/admin/seed-data")
async def seed_data_endpoint(req: SeedDataRequest):
    if req.admin_key != "interact_secret_2026":
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    from database.session import AsyncSessionLocal
    from database.models.general import Business, BusinessEmailConfig, BusinessSettings
    from database.models.workflow import Workflow
    from database.models.scheduling import AppointmentType, AvailabilityRule
    from datetime import datetime, time
    from backend.utils.encryption import encrypt_token
    import traceback
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Import Businesses (Parent Entity)
            if req.businesses:
                for b_data in req.businesses:
                    # Convert date strings back to datetime objects
                    for date_field in ['subscription_end_at', 'created_at']:
                        if date_field in b_data and isinstance(b_data[date_field], str):
                            try:
                                b_data[date_field] = datetime.fromisoformat(b_data[date_field].replace(' ', 'T'))
                            except:
                                b_data[date_field] = None
                    
                    res = await session.execute(select(Business).where(Business.id == b_data['id']))
                    if not res.scalars().first():
                        new_biz = Business(**b_data)
                        session.add(new_biz)
                await session.commit()

            # 2. Import Email Configs
            if req.email_configs:
                for ec_data in req.email_configs:
                    # Convert date strings
                    for date_field in ['created_at', 'updated_at']:
                        if date_field in ec_data and isinstance(ec_data[date_field], str):
                            try:
                                ec_data[date_field] = datetime.fromisoformat(ec_data[date_field].replace(' ', 'T'))
                            except:
                                ec_data[date_field] = None

                    for secret_field in ['api_key', 'smtp_password']:
                        if ec_data.get(secret_field):
                            ec_data[secret_field] = encrypt_token(str(ec_data[secret_field]))
                    
                    res = await session.execute(select(BusinessEmailConfig).where(BusinessEmailConfig.business_id == ec_data['business_id']))
                    existing = res.scalars().first()
                    if existing:
                        for k, v in ec_data.items(): setattr(existing, k, v)
                    else:
                        new_ec = BusinessEmailConfig(**ec_data)
                        session.add(new_ec)
                await session.commit()

            # 3. Import Business Settings
            if req.settings:
                for s_data in req.settings:
                    for date_field in ['created_at', 'updated_at']:
                        if date_field in s_data and isinstance(s_data[date_field], str):
                            try:
                                s_data[date_field] = datetime.fromisoformat(s_data[date_field].replace(' ', 'T'))
                            except:
                                s_data[date_field] = None
                    
                    res = await session.execute(select(BusinessSettings).where(BusinessSettings.business_id == s_data['business_id']))
                    existing = res.scalars().first()
                    if existing:
                        for k, v in s_data.items(): setattr(existing, k, v)
                    else:
                        new_s = BusinessSettings(**s_data)
                        session.add(new_s)
                await session.commit()

            # 4. Import Workflows
            if req.workflows:
                for w_data in req.workflows:
                    for date_field in ['created_at', 'updated_at']:
                        if date_field in w_data and isinstance(w_data[date_field], str):
                            try:
                                w_data[date_field] = datetime.fromisoformat(w_data[date_field].replace(' ', 'T'))
                            except:
                                w_data[date_field] = None
                    
                    res = await session.execute(select(Workflow).where(Workflow.id == w_data['id']))
                    if not res.scalars().first():
                        new_wf = Workflow(**w_data)
                        session.add(new_wf)
                await session.commit()
                
            # 5. Import Appointment Types
            if req.appointment_types:
                for at_data in req.appointment_types:
                    res = await session.execute(select(AppointmentType).where(AppointmentType.id == at_data['id']))
                    if not res.scalars().first():
                        new_at = AppointmentType(**at_data)
                        session.add(new_at)
                await session.commit()
                
            # 6. Import Availability Rules
            if req.availability_rules:
                for ar_data in req.availability_rules:
                    for time_field in ['start_time', 'end_time']:
                        if time_field in ar_data and isinstance(ar_data[time_field], str):
                            try:
                                t_str = ar_data[time_field]
                                parts = t_str.split(':')
                                ar_data[time_field] = time(int(parts[0]), int(parts[1]), int(parts[2][:2]))
                            except:
                                ar_data[time_field] = None
                                
                    res = await session.execute(select(AvailabilityRule).where(AvailabilityRule.id == ar_data['id']))
                    if not res.scalars().first():
                        new_ar = AvailabilityRule(**ar_data)
                        session.add(new_ar)
                await session.commit()

            # 7. Import Users
            if req.users:
                try:
                    from database.models.general import User
                    for u_data in req.users:
                        # Convert date strings
                        for date_field in ['created_at']:
                            if date_field in u_data and isinstance(u_data[date_field], str):
                                try:
                                    u_data[date_field] = datetime.fromisoformat(u_data[date_field].replace(' ', 'T'))
                                except:
                                    u_data[date_field] = None

                        res = await session.execute(select(User).where(User.email == u_data['email']))
                        existing = res.scalars().first()
                        if not existing:
                            new_user = User(**u_data)
                            session.add(new_user)
                        else:
                            existing.business_id = u_data.get('business_id', existing.business_id)
                    await session.commit()
                except Exception as e:
                    logger.error(f"User import error: {e}")

            # 8. Import Subscription Plans
            if req.plans:
                from database.models.billing import SubscriptionPlan
                for p_data in req.plans:
                    # Convert date strings
                    for date_field in ['created_at']:
                        if date_field in p_data and isinstance(p_data[date_field], str):
                            try:
                                p_data[date_field] = datetime.fromisoformat(p_data[date_field].replace(' ', 'T'))
                            except:
                                p_data[date_field] = None

                    res = await session.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == p_data['id']))
                    existing = res.scalars().first()
                    if existing:
                        for k, v in p_data.items(): setattr(existing, k, v)
                    else:
                        session.add(SubscriptionPlan(**p_data))
                await session.commit()

            # 9. Import Business Subscriptions
            if req.subscriptions:
                from database.models.billing import BusinessSubscription
                for s_data in req.subscriptions:
                    for date_field in ['billing_cycle_anchor', 'current_period_start', 'current_period_end', 'created_at', 'updated_at']:
                        if date_field in s_data and isinstance(s_data[date_field], str):
                            try:
                                s_data[date_field] = datetime.fromisoformat(s_data[date_field].replace(' ', 'T'))
                            except:
                                s_data[date_field] = None
                    
                    res = await session.execute(select(BusinessSubscription).where(BusinessSubscription.business_id == s_data['business_id']))
                    existing = res.scalars().first()
                    if existing:
                        for k, v in s_data.items(): setattr(existing, k, v)
                    else:
                        session.add(BusinessSubscription(**s_data))
                await session.commit()

            # 10. Import Token Wallets
            if req.wallets:
                from database.models.billing import TokenWallet
                for w_data in req.wallets:
                    for date_field in ['last_refill_at', 'created_at', 'updated_at']:
                        if date_field in w_data and isinstance(w_data[date_field], str):
                            try:
                                w_data[date_field] = datetime.fromisoformat(w_data[date_field].replace(' ', 'T'))
                            except:
                                w_data[date_field] = None
                                
                    res = await session.execute(select(TokenWallet).where(TokenWallet.business_id == w_data['business_id']))
                    existing = res.scalars().first()
                    if existing:
                        for k, v in w_data.items(): setattr(existing, k, v)
                    else:
                        session.add(TokenWallet(**w_data))
                await session.commit()
                
        except Exception as e:
            logger.error(f"Sync error: {e}")
            logger.error(traceback.format_exc())
            return {"status": "failed", "error": str(e), "traceback": traceback.format_exc()}
            
    # Also run the general seeding logic
    from seed_all_businesses import seed_all_businesses
    try:
        await seed_all_businesses()
        return {"status": "success", "message": "Seeding and sync complete"}
    except Exception as e:
        logger.error(f"Seeding error: {e}")
        return {"status": "partial_success", "error": f"Sync worked but seeding failed: {str(e)}"}

@app.get("/api/scheduling/appointments")

async def get_appointments(business_id: str, start: str = None, end: str = None, lead_id: int = None):
    from services.db_service import resolve_business_id
    bid = await resolve_business_id(business_id)
    
    start_dt = datetime.fromisoformat(start) if start else None
    end_dt = datetime.fromisoformat(end) if end else None
    
    apts = await scheduling_service.get_business_appointments(bid, start_dt, end_dt, lead_id)
    return apts


@app.post("/api/admin/maintenance")
async def maintenance_endpoint(req: dict):
    if req.get("admin_key") != "interact_secret_2026":
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    action = req.get("action")
    from sqlalchemy import text
    
    async with AsyncSessionLocal() as session:
        if action == "check_schema":
            table = req.get("table", "leads")
            try:
                # Check columns in PostgreSQL
                stmt = text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
                res = await session.execute(stmt)
                columns = [{"name": row[0], "type": row[1]} for row in res.fetchall()]
                return {"status": "success", "table": table, "columns": columns}
            except Exception as e:
                return {"status": "error", "error": str(e)}
        
        elif action == "migrate_leads":
            try:
                # Add missing columns to leads table
                queries = [
                    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS emails JSONB DEFAULT '[]'",
                    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]'",
                    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_rule VARCHAR"
                ]
                for q in queries:
                    try:
                        await session.execute(text(q))
                    except Exception as inner_e:
                        logger.warning(f"Migration step failed: {inner_e}")
                
                await session.commit()
                return {"status": "success", "message": "Lead table migrated successfully"}
            except Exception as e:
                return {"status": "error", "error": str(e)}

        elif action == "migrate_departments":
            try:
                # Add departments column to business_settings
                await session.execute(text("ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS departments JSONB DEFAULT '[]'::jsonb"))
                await session.commit()
                return {"status": "success", "message": "Departments column added successfully"}
            except Exception as e:
                return {"status": "error", "error": str(e)}

        elif action == "wipe_db":
            try:
                # Wipes the DB by dropping all tables.
                from database.base import Base
                from database.session import engine
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.drop_all)
                    await conn.run_sync(Base.metadata.create_all)
                # Apply base migrations manually
                async with engine.begin() as conn:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR"))
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP"))
                return {"status": "success", "message": "Database wiped and recreated"}
            except Exception as e:
                logger.error(f"Wipe error: {e}")
                return {"status": "error", "error": str(e)}

        elif action == "delete_business":
            biz_id = req.get("business_id")
            if not biz_id: return {"status": "error", "message": "Missing business_id"}
            from database.models.general import Business, User
            from database.models.chat import Conversation, Message
            
            # Cascade delete usually handles this, but let's be safe
            await session.execute(delete(Message).where(Message.business_id == biz_id))
            await session.execute(delete(Conversation).where(Conversation.business_id == biz_id))
            await session.execute(delete(User).where(User.business_id == biz_id))
            await session.execute(delete(Business).where(Business.id == biz_id))
            await session.commit()
            return {"status": "success", "message": f"Business {biz_id} and all related data deleted"}

        elif action == "deduplicate_businesses":
            from database.models.general import Business
            from database.models.billing import BusinessSubscription
            # Find all INTERAC_HQ
            stmt = select(Business).where(Business.id == "INTERAC_HQ")
            bizs = (await session.execute(stmt)).scalars().all()
            if len(bizs) > 1:
                # Keep the first one, delete others
                for b in bizs[1:]:
                    await session.delete(b)
                await session.commit()
                return {"status": "success", "message": f"Removed {len(bizs)-1} duplicate HQ businesses"}
            return {"status": "success", "message": "No duplicates found"}

        elif action == "reset_user_password":
            email = req.get("email")
            new_pwd = req.get("password")
            if not email or not new_pwd: return {"status": "error", "message": "Missing email or password"}
            
            from services.auth_service import get_password_hash
            from database.models.general import User
            
            stmt = select(User).where(User.email == email)
            user = (await session.execute(stmt)).scalar_one_or_none()
            if user:
                user.password_hash = get_password_hash(new_pwd)
                await session.commit()
                return {"status": "success", "message": f"Password reset for {email}"}
            return {"status": "error", "message": "User not found"}

        elif action == "list_businesses":
            from database.models.general import Business
            stmt = select(Business)
            res = await session.execute(stmt)
            bizs = [{"id": b.id, "name": b.name, "is_deleted": b.is_deleted} for b in res.scalars().all()]
            return {"status": "success", "businesses": bizs}
            
        elif action == "fix_admin_role":
            email = req.get("email")
            if not email: return {"status": "error", "message": "Missing email"}
            from database.models.general import User
            stmt = select(User).where(User.email == email)
            user = (await session.execute(stmt)).scalar_one_or_none()
            if user:
                user.role = "super_admin"
                user.business_id = "INTERAC_HQ" # Ensure it's HQ
                await session.commit()
                return {"status": "success", "message": f"User {email} is now super_admin"}
            return {"status": "error", "message": "User not found"}
            
        elif action == "lifetime_subscription":
            biz_id = req.get("business_id")
            if not biz_id: return {"status": "error", "message": "Missing business_id"}
            from database.models.general import Business
            from database.models.billing import BusinessSubscription, TokenWallet
            from services.db_service import resolve_business_id
            
            real_bid = await resolve_business_id(biz_id)
            
            # 1. Update Business Subscription
            sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == real_bid)
            sub = (await session.execute(sub_stmt)).scalar_one_or_none()
            if not sub:
                sub = BusinessSubscription(business_id=real_bid)
                session.add(sub)
            
            sub.plan_id = "enterprise"
            sub.status = "active"
            sub.current_period_end = datetime(2099, 1, 1)
            
            # 2. Update Token Wallet
            wallet_stmt = select(TokenWallet).where(TokenWallet.business_id == real_bid)
            wallet = (await session.execute(wallet_stmt)).scalar_one_or_none()
            if not wallet:
                wallet = TokenWallet(business_id=real_bid, sub_balance=1000000, payg_balance=0)
                session.add(wallet)
            else:
                wallet.sub_balance = 1000000
                wallet.payg_balance = 0
            
            # 3. Legacy Sync to Business Table
            biz_stmt = select(Business).where(Business.id == real_bid)
            biz = (await session.execute(biz_stmt)).scalar_one_or_none()
            if biz:
                biz.plan_id = "enterprise"
                biz.subscription_status = "active"
            
            await session.commit()
            return {"status": "success", "message": f"Lifetime Enterprise plan and 1M tokens granted to {real_bid}"}


    return {"status": "unknown_action"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
