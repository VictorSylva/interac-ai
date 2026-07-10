import asyncio
from database.session import AsyncSessionLocal
from database.models.general import User
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == 'mbasitisylva@gmail.com')
        user = (await session.execute(stmt)).scalar_one_or_none()
        if user:
            print(f"User: {user.email} | Role: {user.role}")
            if user.role != "super_admin":
                print("Updating to super_admin...")
                user.role = "super_admin"
                await session.commit()
                print("Updated!")
        else:
            print("User mbasitisylva@gmail.com not found locally")

if __name__ == "__main__":
    asyncio.run(check())
