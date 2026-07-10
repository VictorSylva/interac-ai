
import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import SubscriptionPlan
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(SubscriptionPlan))
        plans = res.scalars().all()
        print(f"Plans Found: {len(plans)}")
        for p in plans:
            print(f"- {p.id}: {p.name}")

if __name__ == "__main__":
    asyncio.run(check())
