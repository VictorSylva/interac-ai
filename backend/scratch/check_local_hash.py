import asyncio
from database.session import AsyncSessionLocal
from database.models.general import User
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.email == 'interacai.int@gmail.com'))
        u = res.scalars().first()
        if u:
            print(f"User Found: {u.email}")
            print(f"Hash: {u.password_hash}")
        else:
            print("User NOT found locally.")

if __name__ == "__main__":
    asyncio.run(check())
