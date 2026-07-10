import asyncio
from database.session import AsyncSessionLocal
from database.models.general import Business
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Business))
        bs = res.scalars().all()
        print(f"Found {len(bs)} businesses")
        for b in bs:
            print(f"ID: {b.id}, Name: {b.name}")

if __name__ == "__main__":
    asyncio.run(check())
