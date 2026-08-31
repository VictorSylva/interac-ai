from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from services.entitlement_service import entitlement_service
from services.admin_service import admin_service
from services.db_service import resolve_business_id
from services.auth_service import get_current_user
import logging

router = APIRouter(prefix="/api/entitlements", tags=["Entitlements & Commercial Configuration"])
logger = logging.getLogger(__name__)

class SignalAuditSubmission(BaseModel):
    business_name: str
    contact_name: str
    email: str
    phone: Optional[str] = None
    industry: str
    employee_count: Optional[str] = None
    primary_challenges: Optional[List[str]] = []
    current_systems: Optional[str] = None
    audit_scope: Optional[str] = None

@router.get("/my-configuration")
async def get_my_configuration(business_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Returns the authenticated tenant's live operating configuration, active modules,
    enabled capabilities, and real-time usage meters.
    """
    target_bid = business_id or current_user.get("business_id")
    if not target_bid:
        raise HTTPException(status_code=400, detail="Missing business context")
    
    # Non-superadmins can only access their own business
    if current_user.get("role") != "super_admin" and target_bid != current_user.get("business_id"):
        raise HTTPException(status_code=403, detail="Cross-tenant access forbidden")

    real_bid = await resolve_business_id(target_bid)
    bundle = await entitlement_service.get_business_entitlement_bundle(real_bid)
    if not bundle:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return bundle

@router.get("/check-feature")
async def check_feature_access(feature_key: str, business_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Endpoint for frontend to check access to a specific feature.
    """
    target_bid = business_id or current_user.get("business_id")
    real_bid = await resolve_business_id(target_bid)
    allowed = await entitlement_service.is_entitled(real_bid, feature_key)
    return {"feature_key": feature_key, "allowed": allowed}

@router.post("/request-audit")
async def submit_audit_request(req: SignalAuditSubmission):
    """
    Public inbound lead endpoint for prospects requesting a Business Signal Audit.
    """
    result = await admin_service.submit_signal_audit_lead(req.dict())
    if not result:
        raise HTTPException(status_code=500, detail="Failed to submit audit request")
    return {
        "status": "success",
        "message": "Your Business Signal Audit request has been received. An InteracAI Specialist will contact you to schedule your audit.",
        "data": result
    }
