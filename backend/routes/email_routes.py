from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.db_service import get_email_config, resolve_business_id
from database.session import AsyncSessionLocal
from database.models.general import BusinessEmailConfig
from sqlalchemy import select
from backend.utils.encryption import encrypt_token
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class EmailConfigSchema(BaseModel):
    business_id: str
    provider: str = "resend"
    api_key: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    is_active: bool = False

@router.get("/config")
async def get_config(business_id: str):
    config = await get_email_config(business_id)
    if not config:
        return {"status": "success", "config": {"is_active": False, "provider": "resend"}}
    return {"status": "success", "config": config}

@router.post("/config")
async def save_config(data: EmailConfigSchema):
    async with AsyncSessionLocal() as session:
        try:
            # Resolve business_id to actual UUID (handles email inputs)
            real_business_id = await resolve_business_id(data.business_id)
            
            stmt = select(BusinessEmailConfig).where(BusinessEmailConfig.business_id == real_business_id)
            result = await session.execute(stmt)
            config = result.scalar_one_or_none()

            if not config:
                config = BusinessEmailConfig(business_id=real_business_id)
                session.add(config)

            config.provider = data.provider
            if data.api_key:
                config.api_key = encrypt_token(data.api_key)
            config.smtp_host = data.smtp_host
            config.smtp_port = data.smtp_port
            config.smtp_user = data.smtp_user
            if data.smtp_password:
                config.smtp_password = encrypt_token(data.smtp_password)
            
            config.from_email = data.from_email
            config.from_name = data.from_name
            config.reply_to = data.reply_to
            config.is_active = data.is_active

            await session.commit()
            return {"status": "success"}
        except Exception as e:
            logger.error(f"Error saving email config: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-email")
async def test_email(business_id: str, to: str):
    from services.email_service import email_service
    # Resolve business_id to actual UUID
    real_business_id = await resolve_business_id(business_id)
    
    success, message = await email_service.send_email(
        to=to,
        subject="InteracAI Email Test",
        html_content="<p>This is a test email from your InteracAI configuration.</p>",
        business_id=real_business_id,
        bypass_active=True
    )
    if success:
        return {"status": "success", "message": message}
    return {"status": "error", "detail": message}
