import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription, SubscriptionPlan
from sqlalchemy import select, update

async def grant_lifetime_local():
    async with AsyncSessionLocal() as session:
        # 1. Ensure 'enterprise' plan exists
        plan_stmt = select(SubscriptionPlan).where(SubscriptionPlan.id == 'enterprise')
        res = await session.execute(plan_stmt)
        plan = res.scalar_one_or_none()
        
        if not plan:
            print("Creating Enterprise plan...")
            plan = SubscriptionPlan(
                id='enterprise',
                name='Enterprise Lifetime',
                price=0.0,
                token_allocation=1000000,
                conversation_limit=1000000
            )
            session.add(plan)
            await session.commit()

        # 2. Grant to IDs
        target_ids = ['0bbd48c4-b066-435a-be3d-c095b55897c6', 'INTERAC_HQ', 'interac_hq']
        for bid in target_ids:
            stmt = update(BusinessSubscription).where(BusinessSubscription.business_id == bid).values(
                plan_id='enterprise',
                status='active'
            )
            await session.execute(stmt)
        
        await session.commit()
        print("Lifetime Enterprise granted to local accounts.")

if __name__ == "__main__":
    asyncio.run(grant_lifetime_local())
