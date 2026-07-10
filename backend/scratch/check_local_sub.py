import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(BusinessSubscription).where(BusinessSubscription.business_id == '0bbd48c4-b066-435a-be3d-c095b55897c6'))
        s = res.scalars().first()
        if s:
            print(f"Status: {s.status}, Plan: {s.plan_id}")
        else:
            print("No subscription found")

if __name__ == "__main__":
    asyncio.run(check())
