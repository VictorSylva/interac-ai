import asyncio
import os
import sys

# Set up paths
backend_path = os.path.join(os.getcwd(), 'backend')
sys.path.append(backend_path)

from database.session import AsyncSessionLocal
from database.models.general import Business
from sqlalchemy import select

async def list_businesses():
    print("Fetching businesses from database...")
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(Business)
            result = await session.execute(stmt)
            bizs = result.scalars().all()
            print(f"Found {len(bizs)} businesses:")
            for b in bizs:
                print(f"ID: {b.id}, Name: {b.name}, Deleted: {b.is_deleted}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(list_businesses())
