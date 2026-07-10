import asyncio
import os
import sys

# Set up paths
backend_path = os.path.join(os.getcwd(), 'backend')
sys.path.append(backend_path)

from database.session import AsyncSessionLocal
from database.models.billing import SubscriptionPlan
from sqlalchemy import select

async def list_plans():
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(SubscriptionPlan)
            result = await session.execute(stmt)
            plans = result.scalars().all()
            for p in plans:
                print(f"ID: {p.id}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(list_plans())
