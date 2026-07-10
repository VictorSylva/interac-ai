import asyncio
import sys
import os
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.session import AsyncSessionLocal
from database.models.billing import TokenWallet, TokenTransaction, BusinessUsageMetrics, BusinessSubscription, SubscriptionPlan
from sqlalchemy import select

async def seed_example_data(business_id: str):
    print(f"Seeding example analytics data for business: {business_id}")
    
    async with AsyncSessionLocal() as session:
        # 1. Ensure metrics exist
        stmt = select(BusinessUsageMetrics).where(BusinessUsageMetrics.business_id == business_id)
        res = await session.execute(stmt)
        metrics = res.scalar_one_or_none()
        
        if not metrics:
            metrics = BusinessUsageMetrics(business_id=business_id)
            session.add(metrics)
            await session.flush()
        
        # 2. Add some transactions
        transactions = [
            TokenTransaction(
                business_id=business_id,
                amount=-1500,
                token_pool='subscription',
                action_type='ai_inference',
                transaction_metadata={"model": "gpt-4", "convo_id": "demo_1"}
            ),
            TokenTransaction(
                business_id=business_id,
                amount=-800,
                token_pool='subscription',
                action_type='whatsapp_outbound',
                transaction_metadata={"recipient": "+2348012345678"}
            ),
            TokenTransaction(
                business_id=business_id,
                amount=-1200,
                token_pool='payg',
                action_type='ai_inference',
                transaction_metadata={"model": "gpt-4", "convo_id": "demo_2"}
            )
        ]
        session.add_all(transactions)
        
        # 3. Update metrics manually for the example
        metrics.total_tokens_used = 3500
        metrics.total_conversations = 12
        metrics.estimated_cost = 3.50 # Based on 0.001 rate
        
        # 4. Mock a subscription plan to show profit
        # First ensure a plan exists
        plan_stmt = select(SubscriptionPlan).where(SubscriptionPlan.id == 'growth')
        plan = (await session.execute(plan_stmt)).scalar_one_or_none()
        if not plan:
            plan = SubscriptionPlan(id='growth', name='Growth Plan', price=15000.0)
            session.add(plan)
            await session.flush()
            
        # Ensure subscription exists
        sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == business_id)
        sub = (await session.execute(sub_stmt)).scalar_one_or_none()
        if not sub:
            sub = BusinessSubscription(
                business_id=business_id,
                plan_id='growth',
                status='active',
                current_period_start=datetime.utcnow() - timedelta(days=5),
                current_period_end=datetime.utcnow() + timedelta(days=25)
            )
            session.add(sub)
        
        metrics.estimated_profit = 15000.0 - metrics.estimated_cost
        metrics.updated_at = datetime.utcnow()
        
        await session.commit()
        print("Done! Refresh your dashboard to see the example data.")

if __name__ == "__main__":
    # Use the ID from the screenshot
    target_id = "0bbd48c4-b066-435a-be3d-c095b55897c6"
    asyncio.run(seed_example_data(target_id))
