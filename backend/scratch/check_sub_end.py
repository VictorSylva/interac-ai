import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(BusinessSubscription))
        subs = res.scalars().all()
        for s in subs:
            print(f"BID: {s.business_id}, End: {s.current_period_end}, Type: {type(s.current_period_end)}")

if __name__ == "__main__":
    asyncio.run(check())
