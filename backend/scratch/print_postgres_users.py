import asyncio
import os
from database.session import AsyncSessionLocal
from database.models.general import User, Business
from database.models.billing import BusinessSubscription
from sqlalchemy import select

async def print_postgres_users():
    async with AsyncSessionLocal() as session:
        stmt = select(User, Business, BusinessSubscription).join(
            Business, User.business_id == Business.id, isouter=True
        ).join(
            BusinessSubscription, Business.id == BusinessSubscription.business_id, isouter=True
        )
        res = await session.execute(stmt)
        rows = res.all()
        print(f"=== USERS IN POSTGRES DB ({len(rows)}) ===")
        for u, b, sub in rows:
            biz_name = b.name if b else "N/A"
            biz_del = b.is_deleted if b else "N/A"
            sub_status = sub.status if sub else "N/A"
            print(f"Email: {u.email} | Role: {u.role} | Biz: {biz_name} (Deleted: {biz_del}) | Sub Status: {sub_status}")

if __name__ == "__main__":
    asyncio.run(print_postgres_users())
