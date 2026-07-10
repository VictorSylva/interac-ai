import asyncio
from database.session import AsyncSessionLocal
from database.models.general import User
from sqlalchemy import select

async def list_users():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User))
        for u in res.scalars().all():
            print(f"User: {u.email} | Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(list_users())
