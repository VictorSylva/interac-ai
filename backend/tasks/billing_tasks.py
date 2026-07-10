import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription, SubscriptionPlan, TokenWallet
from services.token_service import token_service
from celery_app import celery_app

logger = logging.getLogger(__name__)

@celery_app.task(name="billing.monthly_token_refill")
async def monthly_token_refill():
    """
    Periodic task to refill subscription tokens for active businesses.
    Should run daily (or monthly) and check if a new period has started.
    """
    logger.info("Starting monthly token refill task...")
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Find all active subscriptions whose current_period_end has passed
            now = datetime.utcnow()
            stmt = select(BusinessSubscription).where(
                BusinessSubscription.status == 'active',
                BusinessSubscription.current_period_end <= now
            )
            result = await session.execute(stmt)
            subscriptions = result.scalars().all()
            
            logger.info(f"Found {len(subscriptions)} subscriptions up for renewal.")
            
            for sub in subscriptions:
                # 2. Get Plan Details
                plan = await session.get(SubscriptionPlan, sub.plan_id)
                if not plan:
                    logger.error(f"Plan {sub.plan_id} not found for subscription {sub.id}")
                    continue
                
                # 3. Update Period
                sub.current_period_start = now
                sub.current_period_end = now + timedelta(days=30)
                
                # 4. Reset Subscription Tokens (No rollover for sub pool)
                # We overwrite the sub_balance with the plan allocation
                success = await token_service.refill_tokens(
                    sub.business_id, 
                    plan.token_allocation, 
                    pool='subscription', 
                    action_type='monthly_refill',
                    metadata={"plan_id": plan.id}
                )
                
                if success:
                    logger.info(f"Successfully refilled {plan.token_allocation} tokens for {sub.business_id}")
                else:
                    logger.error(f"Failed to refill tokens for {sub.business_id}")
            
            await session.commit()
            
        except Exception as e:
            logger.error(f"Error in monthly_token_refill: {e}")
            await session.rollback()

@celery_app.task(name="billing.check_expired_subscriptions")
async def check_expired_subscriptions():
    """
    Optionally check if subscriptions have truly expired (e.g. payment failed).
    """
    # Logic for handling failed payments, grace periods, etc.
    pass
