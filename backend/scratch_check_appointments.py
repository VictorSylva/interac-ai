import asyncio
import os
os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:password@localhost:5435/interact_db"

from database.session import AsyncSessionLocal
from database.models.scheduling import Appointment
from sqlalchemy import select
from datetime import datetime

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Appointment))
        apts = res.scalars().all()
        now = datetime.utcnow()
        print(f"NOW UTC: {now}")
        for a in apts:
            print(f"APT id={a.id}, start={a.start_at}, status={a.status}")
            print(f"a.start_at > now: {a.start_at > now if a.start_at else False}")

if __name__ == "__main__":
    asyncio.run(main())
