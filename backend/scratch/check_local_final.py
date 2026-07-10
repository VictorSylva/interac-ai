import asyncio
from database.session import AsyncSessionLocal
from database.models.general import User, Business
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        print("BUSINESSES:")
        res = await session.execute(select(Business))
        for b in res.scalars().all():
            print(f" - {b.id}: {b.name}")
        
        print("\nUSERS:")
        res_u = await session.execute(select(User))
        for u in res_u.scalars().all():
            print(f" - {u.email}: Role={u.role}, BizID={u.business_id}")

if __name__ == "__main__":
    asyncio.run(check())
