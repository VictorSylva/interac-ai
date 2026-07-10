import asyncio
import sys
import os
import logging
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal
from database.models.general import Business
from database.models.billing import BusinessSubscription, TokenWallet, SubscriptionPlan
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration_v4")

async def migrate(dry_run=True):
    logger.info(f"{'DRY RUN' if dry_run else 'LIVE'} MIGRATION STARTING...")
    
    async with AsyncSessionLocal() as session:
        # 1. Fetch all businesses
        stmt = select(Business)
        result = await session.execute(stmt)
        businesses = result.scalars().all()
        logger.info(f"Found {len(businesses)} businesses to audit.")

        # 2. Ensure Plans exist
        plan_stmt = select(SubscriptionPlan)
        plans_res = await session.execute(plan_stmt)
        plans = {p.id: p for p in plans_res.scalars().all()}
        
        if not plans:
            logger.error("No SubscriptionPlans found. Please run seed_plans.py first.")
            return

        for biz in businesses:
            logger.info(f"Processing Business: {biz.id} ({biz.name})")
            
            # --- BusinessSubscription Migration ---
            sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == biz.id)
            sub_res = await session.execute(sub_stmt)
            sub = sub_res.scalar_one_or_none()
            
            # Fallback plan_id
            plan_id = biz.plan_name or "starter"
            if plan_id not in plans:
                plan_id = "starter"

            if not sub:
                logger.info(f"  [SUB] Creating missing sub record for {biz.id} (Plan: {plan_id})")
                if not dry_run:
                    sub = BusinessSubscription(
                        business_id=biz.id,
                        plan_id=plan_id,
                        status=biz.status or "active",
                        current_period_end=biz.subscription_end_at or (datetime.utcnow() + timedelta(days=30)),
                        billing_cycle_anchor=datetime.utcnow(),
                        conversations_used=0
                    )
                    session.add(sub)
            else:
                logger.info(f"  [SUB] Existing record found for {biz.id}. Syncing status/end_at.")
                if not dry_run:
                    sub.status = biz.status or sub.status
                    sub.current_period_end = biz.subscription_end_at or sub.current_period_end

            # --- TokenWallet Migration ---
            wallet_stmt = select(TokenWallet).where(TokenWallet.business_id == biz.id)
            wallet_res = await session.execute(wallet_stmt)
            wallet = wallet_res.scalar_one_or_none()
            
            if not wallet:
                logger.info(f"  [WALLET] Creating missing wallet for {biz.id}")
                if not dry_run:
                    wallet = TokenWallet(
                        business_id=biz.id,
                        sub_balance=0,
                        payg_balance=0,
                        status="active"
                    )
                    session.add(wallet)
            else:
                logger.info(f"  [WALLET] Existing wallet for {biz.id}")

        if not dry_run:
            await session.commit()
            logger.info("LIVE MIGRATION COMPLETED SUCCESSFULLY.")
        else:
            logger.info("DRY RUN COMPLETED. No changes made.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="Commit changes to DB")
    args = parser.parse_args()
    
    asyncio.run(migrate(dry_run=not args.commit))
