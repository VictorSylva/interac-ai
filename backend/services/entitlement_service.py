"""
InteracAI Centralized Entitlement & Capability Management Service.
Provides audit-first, tenant-specific, typed capability evaluation and quota enforcement.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy import select, update, delete, and_, or_
from database.session import AsyncSessionLocal
from database.models.entitlement import BusinessEntitlement, EntitlementOverride, AdminAuditLog, CommercialProfile
from database.models.general import Business, BusinessSettings, User
from database.models.billing import BusinessSubscription, TokenWallet, BusinessUsageMetrics

logger = logging.getLogger(__name__)

# Standard Default Industry Capabilities Catalog
INDUSTRY_CAPABILITIES_CATALOG = {
    "hotel": {
        "module_id": "module_hotels",
        "name": "Hotels & Hospitality",
        "features": [
            {"key": "hotel.reservations", "name": "Reservations Management", "type": "boolean", "default": True},
            {"key": "hotel.frontdesk", "name": "Front Desk Check-in / Folio", "type": "boolean", "default": True},
            {"key": "hotel.guest_management", "name": "Guest CRM & Profiles", "type": "boolean", "default": True},
            {"key": "hotel.housekeeping", "name": "Housekeeping Dispatch", "type": "boolean", "default": True},
            {"key": "hotel.maintenance", "name": "Work Orders & Maintenance", "type": "boolean", "default": True},
            {"key": "hotel.restaurant", "name": "Restaurant & Room Service POS", "type": "boolean", "default": True},
            {"key": "hotel.inventory", "name": "Hospitality Inventory", "type": "boolean", "default": True},
            {"key": "hotel.finance", "name": "Folio Billing & Night Audit", "type": "boolean", "default": True},
            {"key": "hotel.security", "name": "Perimeter & Access Security", "type": "boolean", "default": True},
            {"key": "argus.core", "name": "ARGUS Intelligence Engine", "type": "boolean", "default": True},
            {"key": "argus.cctv", "name": "CCTV & Computer Vision Streams", "type": "boolean", "default": False},
            {"key": "argus.risk_engine", "name": "Predictive Risk & Anomaly Alerts", "type": "boolean", "default": True},
            {"key": "ai.copilot", "name": "AI Operational Copilot", "type": "boolean", "default": True},
            {"key": "integrations.whatsapp", "name": "WhatsApp Guest Concierge", "type": "boolean", "default": True},
            {"key": "integrations.website_bot", "name": "Web Chat Booking Agent", "type": "boolean", "default": True},
            {"key": "integrations.opera_pms", "name": "Oracle Opera PMS Sync", "type": "boolean", "default": False},
            {"key": "integrations.mews_pms", "name": "Mews Cloud PMS Sync", "type": "boolean", "default": False},
            {"key": "integrations.simphony_pos", "name": "Simphony POS Integration", "type": "boolean", "default": False},
        ],
        "default_limits": {
            "ai.conversations": {"limit": 5000, "unit": "monthly_conversations"},
            "ai.tokens": {"limit": 10000000, "unit": "monthly_tokens"},
            "platform.seats": {"limit": 25, "unit": "seats"},
            "platform.properties": {"limit": 2, "unit": "properties"},
            "argus.cameras": {"limit": 8, "unit": "cameras"},
            "automation.workflows": {"limit": 50, "unit": "workflows"},
        }
    },
    "hospital": {
        "module_id": "module_hospital",
        "name": "Healthcare & Hospitals",
        "features": [
            {"key": "hospital.patients", "name": "Patient Records & EMR", "type": "boolean", "default": True},
            {"key": "hospital.triage", "name": "Clinical Triage & Vitals", "type": "boolean", "default": True},
            {"key": "hospital.wards", "name": "Bed & Ward Management", "type": "boolean", "default": True},
            {"key": "hospital.pharmacy", "name": "Medication & Dispensary", "type": "boolean", "default": True},
            {"key": "hospital.appointments", "name": "Doctor Scheduling", "type": "boolean", "default": True},
            {"key": "hospital.billing", "name": "Medical Invoicing & Insurance", "type": "boolean", "default": True},
            {"key": "argus.core", "name": "ARGUS Clinical Safety Signals", "type": "boolean", "default": True},
            {"key": "ai.copilot", "name": "Medical Knowledge Assistant", "type": "boolean", "default": True},
            {"key": "integrations.whatsapp", "name": "WhatsApp Patient Triage", "type": "boolean", "default": True},
        ],
        "default_limits": {
            "ai.conversations": {"limit": 10000, "unit": "monthly_conversations"},
            "ai.tokens": {"limit": 20000000, "unit": "monthly_tokens"},
            "platform.seats": {"limit": 50, "unit": "seats"},
            "platform.properties": {"limit": 1, "unit": "properties"},
            "automation.workflows": {"limit": 100, "unit": "workflows"},
        }
    },
    "retail": {
        "module_id": "module_retail",
        "name": "Retail & Supermarkets",
        "features": [
            {"key": "retail.catalog", "name": "Product Catalog & SKU", "type": "boolean", "default": True},
            {"key": "retail.pos", "name": "Point of Sale & Checkout", "type": "boolean", "default": True},
            {"key": "retail.inventory", "name": "Stock Levels & Reorders", "type": "boolean", "default": True},
            {"key": "retail.promotions", "name": "Offers & Dynamic Pricing", "type": "boolean", "default": True},
            {"key": "argus.core", "name": "ARGUS Shrinkage & Loss Prevention", "type": "boolean", "default": True},
            {"key": "argus.cctv", "name": "Queue & Shelf Monitoring", "type": "boolean", "default": False},
            {"key": "ai.copilot", "name": "Retail Copilot", "type": "boolean", "default": True},
            {"key": "integrations.whatsapp", "name": "WhatsApp Conversational Commerce", "type": "boolean", "default": True},
        ],
        "default_limits": {
            "ai.conversations": {"limit": 5000, "unit": "monthly_conversations"},
            "ai.tokens": {"limit": 10000000, "unit": "monthly_tokens"},
            "platform.seats": {"limit": 15, "unit": "seats"},
            "platform.properties": {"limit": 3, "unit": "properties"},
            "automation.workflows": {"limit": 50, "unit": "workflows"},
        }
    },
    "school": {
        "module_id": "module_education",
        "name": "Education & Academic Institutions",
        "features": [
            {"key": "school.students", "name": "Student Information System", "type": "boolean", "default": True},
            {"key": "school.attendance", "name": "Class Attendance & Roll Call", "type": "boolean", "default": True},
            {"key": "school.grades", "name": "Gradebook & Report Cards", "type": "boolean", "default": True},
            {"key": "school.fees", "name": "Tuition & Fee Collection", "type": "boolean", "default": True},
            {"key": "argus.core", "name": "ARGUS Campus Safety Signals", "type": "boolean", "default": True},
            {"key": "ai.copilot", "name": "Academic Tutor & Assistant", "type": "boolean", "default": True},
            {"key": "integrations.whatsapp", "name": "Parent Notification Channel", "type": "boolean", "default": True},
        ],
        "default_limits": {
            "ai.conversations": {"limit": 8000, "unit": "monthly_conversations"},
            "ai.tokens": {"limit": 15000000, "unit": "monthly_tokens"},
            "platform.seats": {"limit": 40, "unit": "seats"},
            "platform.properties": {"limit": 1, "unit": "properties"},
            "automation.workflows": {"limit": 60, "unit": "workflows"},
        }
    },
    "general": {
        "module_id": "module_general",
        "name": "General Enterprise",
        "features": [
            {"key": "crm.core", "name": "Customer Relationship Management", "type": "boolean", "default": True},
            {"key": "scheduling.core", "name": "Appointment Scheduling", "type": "boolean", "default": True},
            {"key": "workflow.manage", "name": "Workflow Automation Engine", "type": "boolean", "default": True},
            {"key": "analytics.view", "name": "Business Analytics & Signals", "type": "boolean", "default": True},
            {"key": "ai.copilot", "name": "AI Copilot & Prompts", "type": "boolean", "default": True},
            {"key": "integrations.whatsapp", "name": "WhatsApp Automation", "type": "boolean", "default": True},
            {"key": "integrations.email", "name": "Email Notifications", "type": "boolean", "default": True},
        ],
        "default_limits": {
            "ai.conversations": {"limit": 3000, "unit": "monthly_conversations"},
            "ai.tokens": {"limit": 5000000, "unit": "monthly_tokens"},
            "platform.seats": {"limit": 10, "unit": "seats"},
            "platform.properties": {"limit": 1, "unit": "properties"},
            "automation.workflows": {"limit": 25, "unit": "workflows"},
        }
    }
}


class EntitlementService:
    @staticmethod
    async def is_entitled(business_id: str, capability_key: str) -> bool:
        """
        Evaluates whether a tenant is permitted to execute a capability.
        Hierarchy:
        1. Special SuperAdmin / Platform owner bypass.
        2. Business existence & active status.
        3. Active, unexpired Entitlement Override (grants or restricts).
        4. Specific BusinessEntitlement record for the tenant.
        5. Fallback check on installed modules.
        """
        if not business_id:
            return False

        # Platform Super Admin bypass
        if business_id in ["interacai.int@gmail.com", "0bbd48c4-b066-435a-be3d-c095b55897c6", "INTERAC_HQ"]:
            return True

        async with AsyncSessionLocal() as session:
            try:
                # 1. Check Business is not soft-deleted or suspended
                biz_stmt = select(Business).where(Business.id == business_id)
                biz_res = await session.execute(biz_stmt)
                biz = biz_res.scalar_one_or_none()
                if not biz or biz.is_deleted:
                    return False

                # 2. Check Commercial / Pilot status
                prof_stmt = select(CommercialProfile).where(CommercialProfile.business_id == business_id)
                prof_res = await session.execute(prof_stmt)
                profile = prof_res.scalar_one_or_none()

                now = datetime.utcnow()
                if profile:
                    if profile.commercial_status == "suspended":
                        return False
                    if profile.pilot_enabled and profile.pilot_end_date and profile.pilot_end_date < now:
                        # Pilot has expired
                        logger.warning(f"[Entitlement] Business {business_id} pilot expired on {profile.pilot_end_date}")
                        # If commercial status is still marked as pilot_active, treat as expired
                        if profile.commercial_status in ["pilot_active", "prospect"]:
                            return False

                # 3. Check Active Entitlement Overrides
                override_stmt = select(EntitlementOverride).where(
                    EntitlementOverride.business_id == business_id,
                    EntitlementOverride.entitlement_key == capability_key,
                    EntitlementOverride.is_active == True,
                    EntitlementOverride.starts_at <= now,
                    EntitlementOverride.expires_at >= now
                )
                override_res = await session.execute(override_stmt)
                override = override_res.scalar_one_or_none()

                if override:
                    val = override.override_value or {}
                    if "enabled" in val:
                        return bool(val["enabled"])

                # 4. Check Explicit Business Entitlement
                ent_stmt = select(BusinessEntitlement).where(
                    BusinessEntitlement.business_id == business_id,
                    BusinessEntitlement.entitlement_key == capability_key
                )
                ent_res = await session.execute(ent_stmt)
                entitlement = ent_res.scalar_one_or_none()

                if entitlement:
                    if not entitlement.enabled:
                        return False
                    if entitlement.effective_until and entitlement.effective_until < now:
                        return False
                    return True

                # 5. Fallback for industry modules (if capability belongs to an installed module)
                settings_stmt = select(BusinessSettings).where(BusinessSettings.business_id == business_id)
                settings_res = await session.execute(settings_stmt)
                settings = settings_res.scalar_one_or_none()

                if settings and settings.installed_modules:
                    installed = settings.installed_modules
                    # If capability starts with hotel and module_hotels is installed
                    if capability_key.startswith("hotel.") and "module_hotels" in installed:
                        return True
                    if capability_key.startswith("hospital.") and "module_hospital" in installed:
                        return True
                    if capability_key.startswith("retail.") and "module_retail" in installed:
                        return True
                    if capability_key.startswith("school.") and "module_education" in installed:
                        return True
                    if capability_key.startswith("argus.core"):
                        return True
                    if capability_key in ["ai.copilot", "integrations.whatsapp", "integrations.website_bot"]:
                        return True

                # Default to True for core features during gradual rollout if not explicitly restricted
                if capability_key in ["crm.core", "workflow.manage", "scheduling.core", "analytics.view"]:
                    return True

                return False
            except Exception as e:
                logger.error(f"[Entitlement] Error checking {capability_key} for {business_id}: {e}")
                return False

    @staticmethod
    async def get_limit(business_id: str, limit_key: str) -> Optional[int]:
        """
        Resolves the effective numeric limit for a metric (factoring in overrides).
        Returns -1 for unlimited, or an integer limit.
        """
        if business_id in ["interacai.int@gmail.com", "0bbd48c4-b066-435a-be3d-c095b55897c6", "INTERAC_HQ"]:
            return -1

        async with AsyncSessionLocal() as session:
            try:
                now = datetime.utcnow()
                # 1. Check override
                ov_stmt = select(EntitlementOverride).where(
                    EntitlementOverride.business_id == business_id,
                    EntitlementOverride.entitlement_key == limit_key,
                    EntitlementOverride.is_active == True,
                    EntitlementOverride.starts_at <= now,
                    EntitlementOverride.expires_at >= now
                )
                ov_res = await session.execute(ov_stmt)
                override = ov_res.scalar_one_or_none()
                if override and override.override_value:
                    if "limit" in override.override_value:
                        return int(override.override_value["limit"])

                # 2. Check entitlement
                ent_stmt = select(BusinessEntitlement).where(
                    BusinessEntitlement.business_id == business_id,
                    BusinessEntitlement.entitlement_key == limit_key
                )
                ent_res = await session.execute(ent_stmt)
                ent = ent_res.scalar_one_or_none()
                if ent and ent.numeric_limit is not None:
                    return ent.numeric_limit

                # 3. Fallback defaults based on industry or legacy subscription
                sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == business_id)
                sub_res = await session.execute(sub_stmt)
                sub = sub_res.scalar_one_or_none()
                
                if limit_key == "ai.conversations":
                    return 5000
                elif limit_key == "ai.tokens":
                    return 10000000
                elif limit_key == "platform.seats":
                    return 25
                elif limit_key == "argus.cameras":
                    return 8

                return None
            except Exception as e:
                logger.error(f"[Entitlement] Error getting limit {limit_key} for {business_id}: {e}")
                return None

    @staticmethod
    async def check_usage_quota(business_id: str, metric_key: str, required_amount: int = 1) -> Dict[str, Any]:
        """
        Validates if the business has available quota for a metric.
        Returns: {"allowed": bool, "current": int, "limit": int, "reason": str}
        """
        limit = await EntitlementService.get_limit(business_id, metric_key)
        if limit == -1: # Unlimited
            return {"allowed": True, "current": 0, "limit": -1, "reason": "Unlimited access"}

        async with AsyncSessionLocal() as session:
            try:
                if metric_key == "ai.conversations":
                    sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == business_id)
                    sub_res = await session.execute(sub_stmt)
                    sub = sub_res.scalar_one_or_none()
                    current = sub.conversations_used if sub else 0
                    if limit is not None and current + required_amount > limit:
                        return {
                            "allowed": False,
                            "current": current,
                            "limit": limit,
                            "reason": f"Monthly conversation allowance reached ({current}/{limit}). Contact your account specialist to expand."
                        }
                    return {"allowed": True, "current": current, "limit": limit, "reason": "Within conversation quota"}

                elif metric_key == "ai.tokens":
                    from services.token_service import token_service
                    wallet = await token_service.get_wallet(business_id)
                    total_balance = (wallet.sub_balance or 0) + (wallet.payg_balance or 0) if wallet else 0
                    if total_balance < required_amount:
                        return {
                            "allowed": False,
                            "current": total_balance,
                            "limit": limit or 0,
                            "reason": f"Insufficient AI tokens ({total_balance} available, {required_amount} requested)."
                        }
                    return {"allowed": True, "current": total_balance, "limit": limit or 0, "reason": "Within token balance"}

                elif metric_key == "platform.seats":
                    user_count_stmt = select(Business).where(Business.id == business_id)
                    # Count users
                    from database.models.general import User
                    cnt_stmt = select(User).where(User.business_id == business_id, User.status == "active")
                    cnt_res = await session.execute(cnt_stmt)
                    current_seats = len(cnt_res.scalars().all())
                    if limit is not None and current_seats >= limit:
                        return {
                            "allowed": False,
                            "current": current_seats,
                            "limit": limit,
                            "reason": f"Staff seat limit reached ({current_seats}/{limit})."
                        }
                    return {"allowed": True, "current": current_seats, "limit": limit, "reason": "Seat quota available"}

                return {"allowed": True, "current": 0, "limit": limit, "reason": "Quota OK"}
            except Exception as e:
                logger.error(f"[Entitlement] Error checking quota for {business_id}: {e}")
                return {"allowed": True, "current": 0, "limit": -1, "reason": "Fallback allowed"}

    @staticmethod
    async def get_business_entitlement_bundle(business_id: str) -> Dict[str, Any]:
        """
        Compiles the complete operational configuration, entitlements matrix,
        usage metrics, and commercial status for a tenant.
        Used by both the Admin Control Center and the Customer Configuration Hub.
        """
        async with AsyncSessionLocal() as session:
            try:
                # 1. Fetch Business & Settings
                biz_stmt = select(Business, BusinessSettings).join(
                    BusinessSettings, Business.id == BusinessSettings.business_id, isouter=True
                ).where(Business.id == business_id)
                biz_res = await session.execute(biz_stmt)
                biz_row = biz_res.first()
                
                if not biz_row:
                    return {}
                biz, settings = biz_row

                # 2. Fetch Commercial Profile
                prof_stmt = select(CommercialProfile).where(CommercialProfile.business_id == business_id)
                prof_res = await session.execute(prof_stmt)
                profile = prof_res.scalar_one_or_none()

                # 3. Fetch Entitlements
                ent_stmt = select(BusinessEntitlement).where(BusinessEntitlement.business_id == business_id)
                ent_res = await session.execute(ent_stmt)
                entitlements = ent_res.scalars().all()

                # 4. Fetch Active Overrides
                now = datetime.utcnow()
                ov_stmt = select(EntitlementOverride).where(
                    EntitlementOverride.business_id == business_id,
                    EntitlementOverride.is_active == True,
                    EntitlementOverride.expires_at >= now
                )
                ov_res = await session.execute(ov_stmt)
                overrides = ov_res.scalars().all()

                # 5. Fetch Usage & Wallet
                sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == business_id)
                sub_res = await session.execute(sub_stmt)
                sub = sub_res.scalar_one_or_none()

                from services.token_service import token_service
                wallet = await token_service.get_wallet(business_id)

                metrics_stmt = select(BusinessUsageMetrics).where(BusinessUsageMetrics.business_id == business_id)
                metrics_res = await session.execute(metrics_stmt)
                metrics = metrics_res.scalar_one_or_none()

                # Build Map of Entitlements
                ent_map = {}
                for e in entitlements:
                    ent_map[e.entitlement_key] = {
                        "id": e.id,
                        "key": e.entitlement_key,
                        "enabled": e.enabled,
                        "type": e.entitlement_type,
                        "limit": e.numeric_limit,
                        "unit": e.unit,
                        "effective_from": e.effective_from.isoformat() if e.effective_from else None,
                        "effective_until": e.effective_until.isoformat() if e.effective_until else None,
                        "source": e.source,
                        "notes": e.notes
                    }

                # Apply Overrides to map
                for ov in overrides:
                    if ov.entitlement_key in ent_map:
                        ent_map[ov.entitlement_key]["override"] = {
                            "id": ov.id,
                            "type": ov.override_type,
                            "value": ov.override_value,
                            "reason": ov.reason,
                            "expires_at": ov.expires_at.isoformat()
                        }
                    else:
                        ent_map[ov.entitlement_key] = {
                            "key": ov.entitlement_key,
                            "enabled": ov.override_value.get("enabled", True),
                            "type": "override",
                            "limit": ov.override_value.get("limit"),
                            "override": {
                                "id": ov.id,
                                "type": ov.override_type,
                                "value": ov.override_value,
                                "reason": ov.reason,
                                "expires_at": ov.expires_at.isoformat()
                            }
                        }

                industry = settings.industry if settings else "hotel"
                installed_modules = settings.installed_modules if settings and settings.installed_modules else []

                return {
                    "business_id": biz.id,
                    "name": biz.name,
                    "industry": industry,
                    "installed_modules": installed_modules,
                    "commercial_profile": {
                        "status": profile.commercial_status if profile else "customer_active",
                        "billing_interval": profile.billing_interval if profile else "monthly",
                        "business_size": profile.business_size if profile else "Medium",
                        "num_employees": profile.num_employees if profile else 0,
                        "num_branches": profile.num_branches if profile else 1,
                        "account_manager": profile.account_manager_name if profile else "InteracAI Specialist",
                        "pilot_enabled": profile.pilot_enabled if profile else False,
                        "pilot_start_date": profile.pilot_start_date.isoformat() if profile and profile.pilot_start_date else None,
                        "pilot_end_date": profile.pilot_end_date.isoformat() if profile and profile.pilot_end_date else None,
                        "currency": profile.currency if profile else "NGN"
                    },
                    "usage": {
                        "conversations_used": sub.conversations_used if sub else 0,
                        "conversations_limit": ent_map.get("ai.conversations", {}).get("limit", 5000),
                        "token_subscription_balance": wallet.sub_balance if wallet else 0,
                        "token_payg_balance": wallet.payg_balance if wallet else 0,
                        "tokens_total_available": (wallet.sub_balance or 0) + (wallet.payg_balance or 0) if wallet else 0,
                        "tokens_limit": ent_map.get("ai.tokens", {}).get("limit", 10000000),
                        "total_lifetime_tokens_used": metrics.total_tokens_used if metrics else 0,
                        "total_lifetime_conversations": metrics.total_conversations if metrics else 0,
                    },
                    "entitlements": ent_map,
                    "overrides_count": len(overrides)
                }
            except Exception as e:
                logger.error(f"[Entitlement] Error compiling bundle for {business_id}: {e}", exc_info=True)
                return {}

    @staticmethod
    async def set_entitlements_for_business(
        business_id: str,
        entitlements_list: List[Dict[str, Any]],
        admin_id: Optional[str] = None,
        admin_email: Optional[str] = None,
        reason: Optional[str] = None
    ) -> bool:
        """
        Creates or updates granular entitlements for a tenant with mandatory audit logging.
        """
        async with AsyncSessionLocal() as session:
            try:
                # Capture previous state for audit
                stmt = select(BusinessEntitlement).where(BusinessEntitlement.business_id == business_id)
                res = await session.execute(stmt)
                existing = {e.entitlement_key: e for e in res.scalars().all()}
                
                prev_state = {k: {"enabled": v.enabled, "limit": v.numeric_limit} for k, v in existing.items()}
                new_state = {}

                for item in entitlements_list:
                    key = item.get("key") or item.get("entitlement_key")
                    if not key:
                        continue
                    
                    enabled = bool(item.get("enabled", True))
                    numeric_limit = item.get("limit") or item.get("numeric_limit")
                    unit = item.get("unit")
                    e_type = item.get("type") or item.get("entitlement_type", "boolean")
                    notes = item.get("notes")
                    source = item.get("source", "custom_contract")

                    new_state[key] = {"enabled": enabled, "limit": numeric_limit}

                    if key in existing:
                        ent = existing[key]
                        ent.enabled = enabled
                        ent.numeric_limit = numeric_limit
                        ent.unit = unit
                        ent.entitlement_type = e_type
                        ent.notes = notes
                        ent.source = source
                        ent.updated_by = admin_id
                        ent.updated_at = datetime.utcnow()
                    else:
                        ent = BusinessEntitlement(
                            business_id=business_id,
                            entitlement_key=key,
                            entitlement_type=e_type,
                            enabled=enabled,
                            numeric_limit=numeric_limit,
                            unit=unit,
                            notes=notes,
                            source=source,
                            created_by=admin_id,
                            updated_by=admin_id
                        )
                        session.add(ent)

                # Record Compliance Audit Log
                audit = AdminAuditLog(
                    admin_id=admin_id,
                    admin_email=admin_email or "admin@interac.ai",
                    business_id=business_id,
                    action="entitlement.batch_update",
                    target_resource=f"business:{business_id}:entitlements",
                    previous_state=prev_state,
                    new_state=new_state,
                    reason=reason or "Administrative entitlement provisioning"
                )
                session.add(audit)

                await session.commit()
                logger.info(f"[Entitlement] Successfully updated {len(entitlements_list)} entitlements for {business_id}")
                return True
            except Exception as e:
                logger.error(f"[Entitlement] Failed to set entitlements for {business_id}: {e}", exc_info=True)
                await session.rollback()
                return False

    @staticmethod
    async def create_override(
        business_id: str,
        entitlement_key: str,
        override_type: str,
        override_value: Dict[str, Any],
        reason: str,
        approved_by: str,
        expires_at: datetime,
        admin_email: Optional[str] = None
    ) -> Optional[str]:
        """
        Creates a time-bound, audited entitlement override.
        """
        async with AsyncSessionLocal() as session:
            try:
                override = EntitlementOverride(
                    business_id=business_id,
                    entitlement_key=entitlement_key,
                    override_type=override_type,
                    override_value=override_value,
                    reason=reason,
                    approved_by=approved_by,
                    expires_at=expires_at,
                    is_active=True
                )
                session.add(override)

                audit = AdminAuditLog(
                    admin_id=approved_by,
                    admin_email=admin_email or "admin@interac.ai",
                    business_id=business_id,
                    action="entitlement.override_create",
                    target_resource=f"override:{entitlement_key}",
                    new_state={"key": entitlement_key, "value": override_value, "expires_at": expires_at.isoformat()},
                    reason=reason
                )
                session.add(audit)

                await session.commit()
                await session.refresh(override)
                return override.id
            except Exception as e:
                logger.error(f"[Entitlement] Failed to create override for {business_id}: {e}")
                await session.rollback()
                return None

    @staticmethod
    async def provision_default_entitlements_for_industry(
        session,
        business_id: str,
        industry: str,
        custom_limits: Optional[Dict[str, int]] = None,
        admin_id: Optional[str] = None
    ) -> bool:
        """
        Seeds standard initial capabilities based on industry during provisioning.
        """
        catalog = INDUSTRY_CAPABILITIES_CATALOG.get(industry.lower(), INDUSTRY_CAPABILITIES_CATALOG["general"])
        
        for feat in catalog["features"]:
            ent = BusinessEntitlement(
                business_id=business_id,
                entitlement_key=feat["key"],
                entitlement_type=feat["type"],
                enabled=feat["default"],
                source="industry_template",
                created_by=admin_id,
                updated_by=admin_id
            )
            session.add(ent)

        limits = catalog["default_limits"].copy()
        if custom_limits:
            for k, v in custom_limits.items():
                if k in limits:
                    limits[k]["limit"] = v
                else:
                    limits[k] = {"limit": v, "unit": "custom"}

        for lim_key, lim_cfg in limits.items():
            ent = BusinessEntitlement(
                business_id=business_id,
                entitlement_key=lim_key,
                entitlement_type="numeric",
                enabled=True,
                numeric_limit=lim_cfg["limit"],
                unit=lim_cfg.get("unit"),
                source="industry_template",
                created_by=admin_id,
                updated_by=admin_id
            )
            session.add(ent)

        return True

entitlement_service = EntitlementService()
