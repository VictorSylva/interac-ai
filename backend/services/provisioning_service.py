"""
InteracAI SaaS Tenant Provisioning Pipeline.
Handles atomic creation, subscription setup, module installation, dynamic role setup,
default workflow cloning, and sample data seeding for new tenants.
"""

import uuid
import logging
from datetime import datetime
from sqlalchemy import select
from typing import Dict, Any, Optional

from database.models.general import Business, BusinessSettings, Role, User
from database.models.billing import BusinessSubscription, TokenWallet
from database.models.dynamic_entity import EntityType, EntityV2
from database.models.observation import ObservationV2
from database.models.workflow import Workflow
from services.module_registry import module_registry
from services.workflow_engine import workflow_engine
from create_booking_workflow import get_booking_workflow_payload

logger = logging.getLogger(__name__)

# Map selected signup industries to platform Module IDs
INDUSTRY_TO_MODULE_MAP = {
    "hotel": "module_hotels",
    "hospital": "module_hospital",
    "retail": "module_retail",
    "school": "module_education",
    "church": "module_church",
    "manufacturing": "module_manufacturing",
    "government": "module_government",
    "ngo": "module_bible_translation",
    "estate": "module_estate",
    "restaurant": "module_hotels",
    "agriculture": "module_agriculture",
    "irs": "module_nigeria_irs",
    "bible_translation": "module_bible_translation"
}

# Plan token allocations
PLAN_TOKEN_ALLOCATIONS = {
    "starter": 250000,
    "growth": 1000000,
    "pro": 5000000,
    "enterprise": 100000000
}

async def provision_tenant(
    db_session,
    email: str,
    password_hash: str,
    business_name: str,
    industry: str,
    business_size: Optional[str] = "Small",
    country: Optional[str] = "United States",
    subscription_plan: Optional[str] = "starter"
) -> Dict[str, Any]:
    """
    Executes the ProvisionTenant pipeline end-to-end.
    Ties the business creation, modules installation, settings seeding, and sample data.
    """
    business_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    industry_clean = (industry or "retail").lower().strip()
    plan_clean = (subscription_plan or "starter").lower().strip()

    logger.info(f"[PROVISIONING] Starting pipeline for {business_name} ({email}) - Industry: {industry_clean}, Plan: {plan_clean}")

    # 1. Create Business Tenant
    new_business = Business(
        id=business_id,
        name=business_name,
        industry=industry_clean,
        subscription_plan=plan_clean,
        installed_modules=[],
        enabled_features=["crm", "email", "analytics_basic", "scheduling"]
    )
    db_session.add(new_business)

    # 2. Assign Subscription (Set immediately active for frictionless onboarding)
    new_sub = BusinessSubscription(
        business_id=business_id,
        plan_id=plan_clean,
        status="active",
        billing_cycle_anchor=datetime.utcnow()
    )
    db_session.add(new_sub)

    # 3. Create Token Wallet
    token_allocation = PLAN_TOKEN_ALLOCATIONS.get(plan_clean, 250000)
    new_wallet = TokenWallet(
        business_id=business_id,
        sub_balance=token_allocation,
        payg_balance=0
    )
    db_session.add(new_wallet)

    # 4. Create Owner User Account
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

    # 5. Default Settings Profile
    settings = BusinessSettings(
        business_id=business_id,
        industry=industry_clean,
        description=f"Automated SaaS workspace for {business_name} in the {industry_clean} sector.",
        tone="professional",
        location=country,
        departments=["general", "sales", "support", "billing"]
    )
    db_session.add(settings)

    # Flush so related tables (like BusinessSettings) exist before module installation hooks run
    await db_session.flush()

    # 6. Install Module
    module_id = INDUSTRY_TO_MODULE_MAP.get(industry_clean, "module_retail")
    logger.info(f"[PROVISIONING] Installing module '{module_id}' for '{business_id}'")
    
    # Register the installed module directly in the business record
    new_business.installed_modules = [module_id]
    settings.installed_modules = [module_id]

    module = module_registry.get_module(module_id)
    if module:
        # Executes dynamic entity types creation inside the module
        await module.on_install(business_id, db_session)
        
        # 7. Clone Default Departments & Roles from Module Permissions
        module_departments = set()
        for perm_spec in module.manifest.permissions:
            module_departments.add(perm_spec.department.lower())
            
            # Create dynamic role
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
        
        # Merge module-specific departments into settings
        merged_depts = list(set(settings.departments + list(module_departments)))
        settings.departments = merged_depts
        
        await db_session.flush()

        # 8. Seed Sample Data (Dynamic entities based on newly created schema)
        stmt_et = select(EntityType).where(EntityType.org_id == business_id)
        res_et = await db_session.execute(stmt_et)
        entity_types = res_et.scalars().all()
        et_map = {et.code: et.id for et in entity_types}

        logger.info(f"[PROVISIONING] Seeding mock entities. Entity map: {list(et_map.keys())}")
        
        # Hotel Specific Mock Data
        if "hotel_room" in et_map:
            rooms_to_seed = [
                {"label": "Room 101", "type": "Standard King", "status": "OCCUPIED", "floor": "1st Floor"},
                {"label": "Room 102", "type": "Deluxe Queen", "status": "VACANT", "floor": "1st Floor"},
                {"label": "Room 201", "type": "Executive Suite", "status": "OCCUPIED", "floor": "2nd Floor"}
            ]
            for room in rooms_to_seed:
                ent = EntityV2(
                    id=f"ent_{uuid.uuid4().hex[:12]}",
                    org_id=business_id,
                    entity_type_id=et_map["hotel_room"],
                    display_label=room["label"],
                    attributes={"status": room["status"], "room_type": room["type"], "floor": room["floor"]},
                    risk_score=0.0
                )
                db_session.add(ent)

        if "hotel_guest" in et_map:
            guests_to_seed = [
                {"name": "Alice Smith", "vip": "VIP Gold", "phone": "+1 555-0199", "email": "alice@example.com"},
                {"name": "Bob Johnson", "vip": "Regular", "phone": "+1 555-0188", "email": "bob@example.com"}
            ]
            for guest in guests_to_seed:
                ent = EntityV2(
                    id=f"ent_{uuid.uuid4().hex[:12]}",
                    org_id=business_id,
                    entity_type_id=et_map["hotel_guest"],
                    display_label=guest["name"],
                    attributes={"vip_status": guest["vip"], "phone": guest["phone"], "email": guest["email"], "preferences": "Extra pillows requested."},
                    risk_score=0.0
                )
                db_session.add(ent)

        # Hospital Specific Mock Data
        if "hospital_patient" in et_map:
            patients_to_seed = [
                {"name": "John Doe", "age": 45, "gender": "Male", "blood": "O+", "status": "Stable"},
                {"name": "Jane Smith", "age": 29, "gender": "Female", "blood": "A-", "status": "Observation"}
            ]
            for patient in patients_to_seed:
                ent = EntityV2(
                    id=f"ent_{uuid.uuid4().hex[:12]}",
                    org_id=business_id,
                    entity_type_id=et_map["hospital_patient"],
                    display_label=patient["name"],
                    attributes={"age": patient["age"], "gender": patient["gender"], "blood_type": patient["blood"], "status": patient["status"]},
                    risk_score=0.0
                )
                db_session.add(ent)

        # Retail Specific Mock Data
        if "product" in et_map:
            products_to_seed = [
                {"name": "Organic Milk 1L", "price": 3.99, "stock": 45, "sku": "RET-MILK-ORG"},
                {"name": "Whole Wheat Bread", "price": 2.49, "stock": 18, "sku": "RET-BREAD-WW"},
                {"name": "Dark Roast Coffee 500g", "price": 12.99, "stock": 80, "sku": "RET-COFFEE-DR"}
            ]
            for prod in products_to_seed:
                ent = EntityV2(
                    id=f"ent_{uuid.uuid4().hex[:12]}",
                    org_id=business_id,
                    entity_type_id=et_map["product"],
                    display_label=prod["name"],
                    attributes={"price": prod["price"], "stock": prod["stock"], "sku": prod["sku"], "category": "Grocery"},
                    risk_score=0.0
                )
                db_session.add(ent)

        # School Specific Mock Data
        if "student_record" in et_map:
            students_to_seed = [
                {"name": "Marcus Vance", "grade": "10th Grade", "guardian": "Robert Vance", "gpa": 3.7},
                {"name": "Emily Carter", "grade": "11th Grade", "guardian": "Sarah Carter", "gpa": 3.9}
            ]
            for student in students_to_seed:
                ent = EntityV2(
                    id=f"ent_{uuid.uuid4().hex[:12]}",
                    org_id=business_id,
                    entity_type_id=et_map["student_record"],
                    display_label=student["name"],
                    attributes={"grade_level": student["grade"], "guardian_name": student["guardian"], "gpa": student["gpa"]},
                    risk_score=0.0
                )
                db_session.add(ent)

        # 9. Create Observation Rules / Threat Alerts
        obs = ObservationV2(
            id=f"obs_{uuid.uuid4().hex[:16]}",
            org_id=business_id,
            source_channel="system",
            observation_type=f"{industry_clean}_workspace_provisioned",
            payload={"message": f"Successfully initialized {industry_clean} workspace."},
            severity="INFO",
            confidence=1.0,
            risk_score_impact=0.0
        )
        db_session.add(obs)
    else:
        logger.warning(f"[PROVISIONING] Module for industry {industry_clean} was not found in registry.")

    # 10. Clone Default Booking Confirmation Workflow
    try:
        payload = get_booking_workflow_payload(business_id)
        await workflow_engine.create_workflow(business_id, payload)
        logger.info(f"[PROVISIONING] Successfully cloned default workflow for {business_id}")
    except Exception as e:
        logger.error(f"[PROVISIONING] Failed to clone default workflow: {e}")

    await db_session.commit()
    logger.info(f"[PROVISIONING] Tenant {business_id} fully provisioned.")
    return {"business_id": business_id, "user_id": user_id, "email": email}
