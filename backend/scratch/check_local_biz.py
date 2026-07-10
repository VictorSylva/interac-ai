import asyncio
from database.session import AsyncSessionLocal
from database.models.general import User
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email=='interacai.int@gmail.com'))).scalar_one_or_none()
        if user:
            print('Business ID:', user.business_id)

asyncio.run(check())
