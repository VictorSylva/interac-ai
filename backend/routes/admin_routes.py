from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from services.admin_service import admin_service
from services.auth_service import authenticate_user # For admin context if needed
from database.models.admin import SystemLog, WebhookLog
import logging

router = APIRouter(tags=["super-admin"])
logger = logging.getLogger(__name__)

class StatusUpdate(BaseModel):
    status: str
    admin_id: Optional[str] = None

class TokenCreditRequest(BaseModel):
    amount: int
    admin_id: Optional[str] = None

@router.get("/stats")
async def get_admin_stats(user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await admin_service.get_platform_stats()

@router.get("/businesses")
async def get_admin_businesses(user_id: str, include_deleted: bool = False):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await admin_service.get_all_businesses(include_deleted=include_deleted)

@router.patch("/businesses/{business_id}/status")
async def update_business_status(business_id: str, update: StatusUpdate, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    success = await admin_service.update_business_status(business_id, update.status, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"status": "success"}

@router.delete("/businesses/{business_id}")
async def soft_delete_business(business_id: str, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    success = await admin_service.soft_delete_business(business_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"status": "success"}

@router.post("/businesses/{business_id}/reactivate")
async def reactivate_business(business_id: str, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    success = await admin_service.reactivate_business(business_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"status": "success"}

@router.get("/payments")
async def list_payments(user_id: str, limit: int = 50):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await admin_service.get_all_payments(limit=limit)

@router.get("/logs/system")
async def list_system_logs(user_id: str, limit: int = 50):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await admin_service.get_system_logs(limit=limit)

@router.get("/logs/webhooks")
async def list_webhook_logs(user_id: str, limit: int = 50):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await admin_service.get_webhook_logs(limit=limit)

@router.post("/businesses/{business_id}/credit-tokens")
async def manual_credit_tokens(business_id: str, req: TokenCreditRequest, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    success = await admin_service.manual_token_credit(business_id, req.amount, user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to credit tokens")
    return {"status": "success"}
