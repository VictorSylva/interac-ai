import asyncio
from database.session import AsyncSessionLocal
from database.models.general import Business
from database.models.billing import BusinessSubscription
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def check_businesses():
    async with AsyncSessionLocal() as session:
        stmt = select(Business).options(
            selectinload(Business.users),
            selectinload(Business.subscription)
        )
        res = await session.execute(stmt)
        businesses = res.scalars().all()
        for b in businesses:
            emails = [u.email for u in b.users]
            sub_status = "No Subscription"
            if b.subscription:
                sub_status = f"Plan: {b.subscription.plan_id}, Status: {b.subscription.status}"
            print(f"ID: {b.id}, Name: {b.name}, Users: {emails}, Sub: {sub_status}")

if __name__ == "__main__":
    asyncio.run(check_businesses())

