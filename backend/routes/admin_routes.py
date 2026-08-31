from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from services.admin_service import admin_service
from services.entitlement_service import entitlement_service
from services.provisioning_service import provision_tenant
from services.auth_service import get_password_hash
from database.session import AsyncSessionLocal
import logging

router = APIRouter(tags=["super-admin"])
logger = logging.getLogger(__name__)

# --- Pydantic Schemas ---
class StatusUpdate(BaseModel):
    status: str
    admin_id: Optional[str] = None
    reason: Optional[str] = None

class TokenCreditRequest(BaseModel):
    amount: int
    admin_id: Optional[str] = None
    reason: Optional[str] = None

class CommercialProfileUpdate(BaseModel):
    commercial_status: Optional[str] = None
    billing_interval: Optional[str] = None
    account_manager_name: Optional[str] = None
    business_size: Optional[str] = None
    num_employees: Optional[int] = None
    num_branches: Optional[int] = None
    pilot_enabled: Optional[bool] = None
    pilot_start_date: Optional[str] = None
    pilot_end_date: Optional[str] = None
    pilot_notes: Optional[str] = None

class BatchEntitlementUpdate(BaseModel):
    entitlements: List[Dict[str, Any]]
    reason: Optional[str] = None

class EntitlementOverrideRequest(BaseModel):
    entitlement_key: str
    override_type: str = "grant_access"
    override_value: Dict[str, Any]
    reason: str
    expires_at: str # ISO string

class CreateInvoiceRequest(BaseModel):
    business_id: str
    title: Optional[str] = "InteracAI Custom Operating System Agreement"
    currency: Optional[str] = "NGN"
    items: List[Dict[str, Any]]
    notes: Optional[str] = None
    entitlements_snapshot: Optional[Dict[str, Any]] = None

class ProvisionEnterpriseBusinessRequest(BaseModel):
    business_name: str
    email: str
    password: str
    industry: str
    business_size: Optional[str] = "Medium"
    country: Optional[str] = "Nigeria"
    commercial_status: Optional[str] = "customer_active"
    billing_interval: Optional[str] = "monthly"
    account_manager_name: Optional[str] = "Victor Sylva"
    pilot_enabled: bool = False
    pilot_days: int = 30
    custom_modules: Optional[List[str]] = None
    custom_limits: Optional[Dict[str, int]] = None
    custom_entitlements: Optional[List[Dict[str, Any]]] = None
    initial_tokens: int = 10000000

class LeadStatusUpdate(BaseModel):
    status: str

# --- Endpoints ---

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

@router.get("/businesses/{business_id}/detail")
async def get_business_detail(business_id: str, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    detail = await admin_service.get_business_detail(business_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Business not found")
    return detail

@router.post("/provision-business")
async def provision_enterprise_business(req: ProvisionEnterpriseBusinessRequest, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    pwd_hash = get_password_hash(req.password)
    async with AsyncSessionLocal() as session:
        try:
            result = await provision_tenant(
                db_session=session,
                email=req.email,
                password_hash=pwd_hash,
                business_name=req.business_name,
                industry=req.industry,
                business_size=req.business_size,
                country=req.country,
                commercial_status=req.commercial_status,
                billing_interval=req.billing_interval,
                account_manager_name=req.account_manager_name,
                pilot_enabled=req.pilot_enabled,
                pilot_days=req.pilot_days,
                custom_limits=req.custom_limits,
                custom_modules=req.custom_modules,
                custom_entitlements=req.custom_entitlements,
                initial_tokens=req.initial_tokens,
                admin_id=user_id
            )
            return {"status": "success", "data": result}
        except Exception as e:
            logger.error(f"Error provisioning enterprise business: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

@router.put("/businesses/{business_id}/entitlements")
async def update_business_entitlements(business_id: str, req: BatchEntitlementUpdate, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    success = await entitlement_service.set_entitlements_for_business(
        business_id=business_id,
        entitlements_list=req.entitlements,
        admin_id=user_id,
        reason=req.reason
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update entitlements")
    return {"status": "success"}

@router.post("/businesses/{business_id}/overrides")
async def create_business_override(business_id: str, req: EntitlementOverrideRequest, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    try:
        exp_dt = datetime.fromisoformat(req.expires_at)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ISO format for expires_at")

    override_id = await entitlement_service.create_override(
        business_id=business_id,
        entitlement_key=req.entitlement_key,
        override_type=req.override_type,
        override_value=req.override_value,
        reason=req.reason,
        approved_by=user_id,
        expires_at=exp_dt
    )
    if not override_id:
        raise HTTPException(status_code=500, detail="Failed to create override")
    return {"status": "success", "override_id": override_id}

@router.patch("/businesses/{business_id}/commercial-profile")
async def update_commercial_profile(business_id: str, req: CommercialProfileUpdate, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    success = await admin_service.update_commercial_profile(
        business_id=business_id,
        profile_data=req.dict(exclude_unset=True),
        admin_id=user_id
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update commercial profile")
    return {"status": "success"}

@router.patch("/businesses/{business_id}/status")
async def update_business_status(business_id: str, update: StatusUpdate, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    success = await admin_service.update_business_status(business_id, update.status, user_id, reason=update.reason)
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

@router.post("/businesses/{business_id}/credit-tokens")
async def manual_credit_tokens(business_id: str, req: TokenCreditRequest, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    success = await admin_service.manual_token_credit(business_id, req.amount, user_id, reason=req.reason)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to credit tokens")
    return {"status": "success"}

# --- Invoicing Routes ---

@router.get("/invoices")
async def list_invoices(user_id: str, business_id: Optional[str] = None):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await admin_service.list_custom_invoices(business_id=business_id)

@router.post("/invoices")
async def create_invoice(req: CreateInvoiceRequest, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    result = await admin_service.create_custom_invoice(req.dict(), admin_id=user_id)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate invoice")
    return result

@router.post("/invoices/{invoice_id}/approve")
async def approve_invoice(invoice_id: str, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    success = await admin_service.approve_and_provision_invoice(invoice_id, admin_id=user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to approve invoice")
    return {"status": "success"}

# --- Compliance Audit Logs ---

@router.get("/audit-logs")
async def get_audit_logs(user_id: str, business_id: Optional[str] = None, limit: int = 100):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await admin_service.get_admin_audit_logs(business_id=business_id, limit=limit)

# --- Signal Audit Leads ---

@router.get("/leads/audits")
async def list_signal_audit_leads(user_id: str, limit: int = 50):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await admin_service.list_signal_audit_leads(limit=limit)

@router.patch("/leads/audits/{lead_id}/status")
async def update_signal_audit_lead_status(lead_id: str, req: LeadStatusUpdate, user_id: str):
    if not user_id or not await admin_service.check_is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    success = await admin_service.update_signal_audit_lead_status(lead_id, req.status, admin_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Lead not found")
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
