import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import SubscriptionPlan
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(SubscriptionPlan))
        plans = res.scalars().all()
        for p in plans:
            print(f"ID: {p.id}, Limit: {p.conversation_limit}, Type: {type(p.conversation_limit)}")

if __name__ == "__main__":
    asyncio.run(check())
