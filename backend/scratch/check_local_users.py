import asyncio
from database.session import AsyncSessionLocal
from database.models.general import User
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User))
        users = res.scalars().all()
        print(f"Found {len(users)} users")
        for u in users:
            print(f"Email: {u.email}, Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(check())
