import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import SubscriptionPlan
from sqlalchemy import select

async def seed_plans():
    async with AsyncSessionLocal() as session:
        # Check if plans exist
        stmt = select(SubscriptionPlan)
        res = await session.execute(stmt)
        if res.scalars().first():
            print("Plans already exist.")
            return

        print("Seeding subscription plans...")
        plans = [
            SubscriptionPlan(
                id='starter',
                name='Starter Plan',
                price=60000.0,
                token_allocation=10000,
                conversation_limit=500
            ),
            SubscriptionPlan(
                id='growth',
                name='Growth Plan',
                price=120000.0,
                token_allocation=25000,
                conversation_limit=1500
            ),
            SubscriptionPlan(
                id='pro',
                name='Professional Plan',
                price=250000.0,
                token_allocation=60000,
                conversation_limit=5000
            ),
            SubscriptionPlan(
                id='enterprise',
                name='Enterprise Lifetime',
                price=0.0,
                token_allocation=1000000,
                conversation_limit=-1
            )
        ]
        session.add_all(plans)
        await session.commit()
        print("Plans seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_plans())
