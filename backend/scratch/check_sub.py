import asyncio
import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(BusinessSubscription).where(BusinessSubscription.business_id == '1036f8ff-99cd-4503-a7ca-0957dc42acfb'))
        sub = res.scalar_one_or_none()
        if sub:
            print(f"Sub found: ID={sub.id}, Plan={sub.plan_id}, Status={sub.status}")
        else:
            print("No sub found")

if __name__ == "__main__":
    asyncio.run(check())
