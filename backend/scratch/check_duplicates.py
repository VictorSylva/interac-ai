import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(BusinessSubscription).where(BusinessSubscription.business_id == '0bbd48c4-b066-435a-be3d-c095b55897c6'))
        subs = res.scalars().all()
        print(f"Found {len(subs)} subscriptions")
        for s in subs:
            print(f"ID: {s.id}, Status: {s.status}")

if __name__ == "__main__":
    asyncio.run(check())
