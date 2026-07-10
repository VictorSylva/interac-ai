import asyncio
from database.session import AsyncSessionLocal
from database.models.general import Business
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as s:
        res = await s.execute(select(Business.id).limit(1))
        print(res.scalar())

if __name__ == "__main__":
    asyncio.run(run())
