import asyncio
from database.session import AsyncSessionLocal
from database.models.general import Business
from sqlalchemy import select

async def check_businesses():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Business))
        businesses = res.scalars().all()
        for b in businesses:
            print(f"ID: {b.id}, Name: {b.name}, Email: {b.email}")

if __name__ == "__main__":
    asyncio.run(check_businesses())
