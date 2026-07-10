import asyncio
from database.session import AsyncSessionLocal
from database.models.scheduling import Appointment
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Appointment))
        apts = res.scalars().all()
        for a in apts:
            print(f"ID: {a.id}, Start: {a.start_at}, End: {a.end_at}")

if __name__ == "__main__":
    asyncio.run(check())
