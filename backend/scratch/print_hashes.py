import asyncio
from database.session import AsyncSessionLocal
from database.models.general import User
from sqlalchemy import select

async def print_hashes():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User))
        for u in res.scalars().all():
            print(f"Email: {u.email} | Hash: {u.password_hash} | Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(print_hashes())
