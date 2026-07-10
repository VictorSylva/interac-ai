import asyncio
from database.session import AsyncSessionLocal
from database.models.general import User, Business
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == 'interacai.int@gmail.com')
        user = (await session.execute(stmt)).scalar_one_or_none()
        if user:
            print(f"User: {user.email} | BizID: {user.business_id}")
            # Get Business Name
            biz_stmt = select(Business).where(Business.id == user.business_id)
            biz = (await session.execute(biz_stmt)).scalar_one_or_none()
            if biz:
                print(f"Business Name: {biz.name}")
        else:
            print("User interacai.int@gmail.com not found locally")

if __name__ == "__main__":
    asyncio.run(check())
