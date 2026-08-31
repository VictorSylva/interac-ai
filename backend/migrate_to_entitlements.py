"""
InteracAI Safe Legacy Entitlements Migration Script.
Converts existing businesses from static SaaS plans to audit-based Custom Entitlements.
Preserves all historical usage, tokens, and settings with ZERO downtime or data loss.
"""

import asyncio
import logging
from datetime import datetime
from sqlalchemy import select
from database.session import AsyncSessionLocal, engine
from database.base import Base
from database.models.general import Business, BusinessSettings, User
from database.models.billing import BusinessSubscription, TokenWallet, BusinessUsageMetrics
from database.models.entitlement import BusinessEntitlement, CommercialProfile, AdminAuditLog
from services.entitlement_service import entitlement_service, INDUSTRY_CAPABILITIES_CATALOG

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

PLAN_TO_CONVERSATION_LIMITS = {
    "starter": 5000,
    "growth": 15000,
    "pro": 50000,
    "enterprise": 500000
}

PLAN_TO_TOKEN_LIMITS = {
    "starter": 10000000,
    "growth": 25000000,
    "pro": 100000000,
    "enterprise": 500000000
}

async def run_migration():
    logger.info("Starting safe migration to Custom Entitlements...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as session:
        # Fetch all businesses
        stmt = select(Business)
        res = await session.execute(stmt)
        businesses = res.scalars().all()
        
        logger.info(f"Found {len(businesses)} businesses to process.")
        
        migrated_count = 0
        already_migrated_count = 0

        for biz in businesses:
            # 1. Check if already has commercial profile
            prof_stmt = select(CommercialProfile).where(CommercialProfile.business_id == biz.id)
            prof_res = await session.execute(prof_stmt)
            profile = prof_res.scalar_one_or_none()

            # 2. Check settings
            set_stmt = select(BusinessSettings).where(BusinessSettings.business_id == biz.id)
            set_res = await session.execute(set_stmt)
            settings = set_res.scalar_one_or_none()

            # 3. Check subscription
            sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == biz.id)
            sub_res = await session.execute(sub_stmt)
            sub = sub_res.scalar_one_or_none()

            industry = settings.industry if settings and settings.industry else "hotel"
            plan_id = (sub.plan_id if sub and sub.plan_id else "starter").lower()

            if not profile:
                comm_status = "customer_active"
                if sub and sub.status in ["suspended", "canceled"]:
                    comm_status = "suspended"
                elif sub and sub.status == "trialing":
                    comm_status = "pilot_active"

                profile = CommercialProfile(
                    business_id=biz.id,
                    commercial_status=comm_status,
                    billing_interval="monthly",
                    account_manager_name="Victor Sylva",
                    business_size="Medium",
                    pilot_enabled=(sub.status == "trialing") if sub else False,
                    currency="NGN"
                )
                session.add(profile)

            # 4. Check Entitlements
            ent_stmt = select(BusinessEntitlement).where(BusinessEntitlement.business_id == biz.id)
            ent_res = await session.execute(ent_stmt)
            existing_ents = ent_res.scalars().all()

            if not existing_ents:
                # Custom limits based on previous plan tier
                custom_limits = {
                    "ai.conversations": PLAN_TO_CONVERSATION_LIMITS.get(plan_id, 5000),
                    "ai.tokens": PLAN_TO_TOKEN_LIMITS.get(plan_id, 10000000),
                    "platform.seats": 25,
                    "argus.cameras": 8
                }

                await entitlement_service.provision_default_entitlements_for_industry(
                    session=session,
                    business_id=biz.id,
                    industry=industry,
                    custom_limits=custom_limits,
                    admin_id="system_migration"
                )

                # Record Audit Log
                audit = AdminAuditLog(
                    admin_email="system@interac.ai",
                    business_id=biz.id,
                    action="migration.legacy_to_custom_entitlements",
                    target_resource=f"business:{biz.id}",
                    previous_state={"legacy_plan": plan_id},
                    new_state={"industry": industry, "custom_limits": custom_limits},
                    reason="Automated zero-downtime migration from fixed plans to custom entitlements"
                )
                session.add(audit)
                migrated_count += 1
            else:
                already_migrated_count += 1

        await session.commit()
        logger.info(f"Migration completed successfully! Migrated: {migrated_count}, Already up-to-date: {already_migrated_count}")

if __name__ == "__main__":
    asyncio.run(run_migration())
