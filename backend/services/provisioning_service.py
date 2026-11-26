"""
InteracAI SaaS & Enterprise Tenant Provisioning Pipeline.
Handles audit-first business onboarding, custom industry capabilities,
entitlement seeding, commercial profile initialization, and dynamic role setup.
"""

import uuid
import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from typing import Dict, Any, Optional, List

from database.models.general import Business, BusinessSettings, Role, User
from database.models.billing import BusinessSubscription, TokenWallet, SubscriptionPlan
from database.models.entitlement import BusinessEntitlement, CommercialProfile, AdminAuditLog
from database.models.dynamic_entity import EntityType, EntityV2
from database.models.observation import ObservationV2
from services.module_registry import module_registry
from services.workflow_engine import workflow_engine
from services.entitlement_service import entitlement_service
from create_booking_workflow import get_booking_workflow_payload

logger = logging.getLogger(__name__)

# Map selected signup industries to platform Module IDs
INDUSTRY_TO_MODULE_MAP = {
    "hotel": "module_hotels",
    "hospital": "module_hospital",
    "retail": "module_retail",
    "school": "module_education",
    "education": "module_education",
    "church": "module_church",
    "manufacturing": "module_manufacturing",
    "government": "module_government",
    "ngo": "module_bible_translation",
    "estate": "module_estate",
    "restaurant": "module_hotels",
    "agriculture": "module_agriculture",
    "irs": "module_nigeria_irs",
    "bible_translation": "module_bible_translation",
    "sme": "module_sme",
    "sme & business operations": "module_sme",
    "general sme": "module_sme",
    "general_sme": "module_sme",
    "general": None,
    "general enterprise": None,
    "general_enterprise": None,
    "saas": None,
    "other": None
}

async def provision_tenant(
    db_session,
    email: str,
    password_hash: str,
    business_name: str,
    industry: str,
    business_size: Optional[str] = "Medium",
    country: Optional[str] = "Nigeria",
    commercial_status: Optional[str] = "customer_active",
    billing_interval: Optional[str] = "monthly",
    account_manager_name: Optional[str] = "Victor Sylva",
    pilot_enabled: bool = False,
    pilot_days: int = 30,
    custom_limits: Optional[Dict[str, int]] = None,
    custom_modules: Optional[List[str]] = None,
    custom_entitlements: Optional[List[Dict[str, Any]]] = None,
    initial_tokens: int = 5000,
    admin_id: Optional[str] = None,
    sme_preset: Optional[str] = "beauty"
) -> Dict[str, Any]:
    """
    Executes the Audit-First ProvisionTenant pipeline end-to-end.
    Ties business creation, commercial profiling, custom entitlements, module installation, and role seeding.
    """
    business_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    industry_clean = (industry or "general").lower().strip()

    logger.info(f"[PROVISIONING] Starting enterprise pipeline for {business_name} ({email}) - Industry: {industry_clean}")

    # 0. Check for existing user with this email
    stmt_existing = select(User).where(User.email.ilike(email.strip()))
    res_existing = await db_session.execute(stmt_existing)
    existing_u = res_existing.scalar_one_or_none()
    if existing_u:
        stmt_biz = select(Business).where(Business.id == existing_u.business_id)
        biz_res = await db_session.execute(stmt_biz)
        b_record = biz_res.scalar_one_or_none()
        if b_record and b_record.is_deleted:
            raise ValueError(
                f"A user with email '{email}' exists under deactivated business '{b_record.name}'. "
                f"To reuse this email, please permanently delete the deactivated account from Super Admin."
            )
        raise ValueError(f"A user with email '{email}' already exists.")

    # 1. Create Business Tenant
    new_business = Business(
        id=business_id,
        name=business_name
    )
    db_session.add(new_business)

    # 2. Ensure Plan Exists in subscription_plans (satisfy Foreign Key constraint)
    target_plan_id = "custom_operating_system"
    stmt_plan = select(SubscriptionPlan).where(SubscriptionPlan.id == target_plan_id)
    res_plan = await db_session.execute(stmt_plan)
    existing_plan = res_plan.scalar_one_or_none()

    if not existing_plan:
        try:
            logger.info(f"[PROVISIONING] Seeding missing SubscriptionPlan '{target_plan_id}'...")
            custom_plan = SubscriptionPlan(
                id=target_plan_id,
                name="Custom Operating System",
                price=None,
                token_allocation=initial_tokens,
                conversation_limit=-1,
                is_public=False,
                requires_contact=True,
                feature_flags={
                    "whatsapp_bot": True,
                    "web_chat": True,
                    "advanced_workflows": True,
                    "crm": True,
                    "email": True,
                    "analytics_basic": True,
                    "analytics_full": True,
                    "scheduling": True,
                    "api_access": True,
                    "industry_os": True
                },
                limits={
                    "max_workflows": -1,
                    "max_ai_messages": -1
                }
            )
            db_session.add(custom_plan)
            await db_session.flush()
        except Exception as plan_err:
            logger.warning(f"[PROVISIONING] Could not seed '{target_plan_id}' plan ({plan_err}), resolving fallback...")
            res_ent = await db_session.execute(select(SubscriptionPlan.id).where(SubscriptionPlan.id == "enterprise"))
            if res_ent.scalar_one_or_none():
                target_plan_id = "enterprise"
            else:
                res_starter = await db_session.execute(select(SubscriptionPlan.id).where(SubscriptionPlan.id == "starter"))
                if res_starter.scalar_one_or_none():
                    target_plan_id = "starter"

    # Assign Operating Subscription Status (Internal record)
    now = datetime.utcnow()
    pilot_end = now + timedelta(days=pilot_days) if pilot_enabled else None
    
    new_sub = BusinessSubscription(
        business_id=business_id,
        plan_id=target_plan_id,
        status="active",
        current_period_start=now,
        current_period_end=pilot_end if pilot_enabled else (now + timedelta(days=365)),
        billing_cycle_anchor=now,
        conversations_used=0
    )
    db_session.add(new_sub)

    # 3. Create Commercial Profile
    comm_profile = CommercialProfile(
        business_id=business_id,
        commercial_status=commercial_status,
        billing_interval=billing_interval,
        account_manager_name=account_manager_name,
        business_size=business_size or "Medium",
        pilot_enabled=pilot_enabled,
        pilot_start_date=now if pilot_enabled else None,
        pilot_end_date=pilot_end,
        currency="NGN"
    )
    db_session.add(comm_profile)

    # 4. Resolve Initial Token Balance & Create Token Wallet
    resolved_initial_tokens = initial_tokens
    if custom_entitlements:
        for cent in custom_entitlements:
            if cent.get("key") == "ai.tokens" and cent.get("limit") is not None:
                resolved_initial_tokens = int(float(cent["limit"]))
    elif custom_limits and "ai.tokens" in custom_limits:
        resolved_initial_tokens = int(float(custom_limits["ai.tokens"]))

    new_wallet = TokenWallet(
        business_id=business_id,
        sub_balance=resolved_initial_tokens,
        payg_balance=0
    )
    db_session.add(new_wallet)

    # 5. Create Owner User Account
    new_user = User(
        id=user_id,
        business_id=business_id,
        email=email,
        password_hash=password_hash,
        role="owner",
        status="active",
        email_verified=True
    )
    db_session.add(new_user)

    # 6. Default Settings Profile
    if custom_modules is not None:
        modules_to_install = [m for m in custom_modules if m]
    else:
        target_mod = INDUSTRY_TO_MODULE_MAP.get(industry_clean)
        modules_to_install = [target_mod] if target_mod else []
    
    settings = BusinessSettings(
        business_id=business_id,
        industry=industry_clean,
        description=f"InteracAI Custom Operating System for {business_name} in {industry_clean}.",
        tone="professional",
        location=country,
        departments=["general", "sales", "support", "billing"],
        installed_modules=modules_to_install
    )
    db_session.add(settings)

    # 7. Seed Default Capabilities & Entitlements for Industry
    limits_to_seed = custom_limits.copy() if custom_limits else {}
    if "ai.tokens" not in limits_to_seed:
        limits_to_seed["ai.tokens"] = resolved_initial_tokens

    await entitlement_service.provision_default_entitlements_for_industry(
        session=db_session,
        business_id=business_id,
        industry=industry_clean,
        custom_limits=limits_to_seed,
        admin_id=admin_id
    )

    # Apply any specific custom entitlements overrides passed during audit intake
    if custom_entitlements:
        for cent in custom_entitlements:
            key = cent.get("key")
            if key:
                ent = BusinessEntitlement(
                    business_id=business_id,
                    entitlement_key=key,
                    entitlement_type=cent.get("type", "boolean"),
                    enabled=cent.get("enabled", True),
                    numeric_limit=cent.get("limit"),
                    unit=cent.get("unit"),
                    source="custom_quote",
                    created_by=admin_id,
                    updated_by=admin_id
                )
                db_session.add(ent)

    # Flush so related tables exist before module installation hooks run
    await db_session.flush()

    # 8. Install Selected Industry Modules
    for mod_id in modules_to_install:
        if not mod_id:
            continue
        module = module_registry.get_module(mod_id)
        if module:
            logger.info(f"[PROVISIONING] Installing module '{mod_id}' for '{business_id}'")
            await module.on_install(business_id, db_session)
            
            # Clone Default Departments & Roles from Module Permissions
            module_departments = set()
            for perm_spec in module.manifest.permissions:
                module_departments.add(perm_spec.department.lower())
                
                role_code = f"{perm_spec.department}_{perm_spec.role_tier}".lower()
                role_name = f"{perm_spec.department.capitalize()} {perm_spec.role_tier.capitalize()}"
                
                role_permissions = [
                    f"{industry_clean}.{perm_spec.department}.read",
                    f"{industry_clean}.{perm_spec.department}.manage"
                ]
                new_role = Role(
                    id=f"role_{uuid.uuid4().hex[:12]}",
                    business_id=business_id,
                    name=role_name,
                    code=role_code,
                    permissions=role_permissions
                )
                db_session.add(new_role)
            
            settings.departments = list(set(settings.departments + list(module_departments)))
            await db_session.flush()

    # Apply SME industry preset if module_sme is provisioned
    if "module_sme" in modules_to_install:
        try:
            from services.sme_service import sme_service
            logger.info(f"[PROVISIONING] Applying SME preset '{sme_preset}' for business '{business_id}'")
            await sme_service.apply_preset(db_session, business_id, sme_preset or "beauty")
            await db_session.flush()
        except Exception as sme_err:
            logger.error(f"[PROVISIONING] Failed to apply SME preset '{sme_preset}': {sme_err}")

    # 9. Industry Entities: No mock/dummy entities seeded. Rooms and inventory must be created cleanly by the hotel management.
    stmt_et = select(EntityType).where(EntityType.org_id == business_id)
    res_et = await db_session.execute(stmt_et)
    entity_types = res_et.scalars().all()
    et_map = {et.code: et.id for et in entity_types}

    # 10. Observation Rules
    obs = ObservationV2(
        id=f"obs_{uuid.uuid4().hex[:16]}",
        org_id=business_id,
        source_channel="system",
        observation_type=f"{industry_clean}_workspace_provisioned",
        payload={"message": f"Successfully initialized {industry_clean} custom operating platform."},
        severity="INFO",
        confidence=1.0,
        risk_score_impact=0.0
    )
    db_session.add(obs)

    # 11. Record Audit Log for Business Creation
    audit = AdminAuditLog(
        admin_id=admin_id,
        admin_email="system@interac.ai" if not admin_id else "admin@interac.ai",
        business_id=business_id,
        action="business.provision",
        target_resource=f"business:{business_id}",
        new_state={
            "name": business_name,
            "industry": industry_clean,
            "commercial_status": commercial_status,
            "pilot_enabled": pilot_enabled,
            "modules": modules_to_install
        },
        reason="Initial business audit provisioning"
    )
    db_session.add(audit)

    # Commit business, subscription, and related models before background workflow cloning
    await db_session.commit()

    # 12. Clone Default Booking Confirmation Workflow (After commit so foreign keys & db locks are clear)
    try:
        payload = get_booking_workflow_payload(business_id)
        await workflow_engine.create_workflow(business_id, payload)
        logger.info(f"[PROVISIONING] Successfully cloned default workflow for {business_id}")
    except Exception as e:
        logger.error(f"[PROVISIONING] Failed to clone default workflow: {e}")

    logger.info(f"[PROVISIONING] Enterprise tenant {business_id} fully provisioned with custom entitlements.")
    return {"business_id": business_id, "user_id": user_id, "email": email}
