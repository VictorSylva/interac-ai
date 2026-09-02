"""
InteracAI Industry Module REST API Routes.
Exposes endpoints for discovering, installing, and managing active Industry Modules per organization.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import logging

from database.session import get_db
from services.module_registry import module_registry
from services.auth_service import require_permission, get_current_user


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/modules", tags=["Industry Modules"])


@router.get("")
def list_available_modules():
    """List all available Industry Modules in the InteracAI platform."""
    return module_registry.list_available_modules()


@router.get("/installed")
async def list_installed_modules(
    request: Request,
    org_id: str = Query(..., description="Organization/Business ID"),
    db: Session = Depends(get_db)
):
    """List Industry Modules currently installed/active for an organization."""
    from services.db_service import resolve_business_id
    real_org_id = await resolve_business_id(org_id)
    
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from services.auth_service import decode_access_token
            token = auth_header.split(" ")[1]
            payload = decode_access_token(token)
            if payload and payload.get("role") not in ["super_admin"]:
                user_bid = await resolve_business_id(payload.get("business_id", ""))
                if user_bid and user_bid != real_org_id:
                    raise HTTPException(status_code=403, detail="Tenant mismatch")
        except HTTPException:
            raise
        except Exception:
            pass

    return await module_registry.get_installed_modules_for_org(real_org_id, db)



@router.post("/install")
async def install_module(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("module.install"))
):
    """Install/enable an Industry Module for an organization."""
    org_id = payload.get("org_id")
    module_id = payload.get("module_id")

    if current_user.get("role") not in ["super_admin"] and current_user.get("business_id") != org_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    if not org_id or not module_id:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id' and 'module_id'")

    try:
        success = await module_registry.install_module_for_org(org_id, module_id, db)
        return {"success": success, "org_id": org_id, "module_id": module_id, "message": "Module installed successfully"}
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.post("/uninstall")
async def uninstall_module(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("module.install"))
):
    """Uninstall/disable an Industry Module for an organization."""
    org_id = payload.get("org_id")
    module_id = payload.get("module_id")

    if current_user.get("role") not in ["super_admin"] and current_user.get("business_id") != org_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    if not org_id or not module_id:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id' and 'module_id'")

    success = await module_registry.uninstall_module_for_org(org_id, module_id, db)
    return {"success": success, "org_id": org_id, "module_id": module_id, "message": "Module uninstalled successfully"}


@router.post("/skills/execute")
async def execute_copilot_skill(payload: Dict[str, Any]):
    """Execute an Industry Module Copilot Skill dynamically."""
    from services.copilot_skill_registry import copilot_skill_registry
    skill_key = payload.get("skill_id") or payload.get("skill_key")
    params = payload.get("params", {})
    if not skill_key:
        raise HTTPException(status_code=400, detail="Missing required parameter: 'skill_id'")
    try:
        result = await copilot_skill_registry.execute_skill(skill_key, params)
        return {"success": True, "skill_id": skill_key, "result": result}
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except Exception as err:
        logger.error(f"Error executing skill {skill_key}: {err}")
        raise HTTPException(status_code=500, detail=str(err))

