import asyncio
import sys
from database.session import AsyncSessionLocal
from database.models.general import User, Business
from database.models.billing import BusinessSubscription, SubscriptionPlan
from sqlalchemy import select

async def check_user():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"=== TOTAL USERS IN DB: {len(users)} ===")
        for u in users:
            print(f"User: id={u.id}, email={u.email}, business_id={u.business_id}, role={u.role}")

        result_biz = await session.execute(select(Business))
        businesses = result_biz.scalars().all()
        print(f"\n=== TOTAL BUSINESSES IN DB: {len(businesses)} ===")
        for b in businesses:
            print(f"Business: id={b.id}, name={b.name}, plan_tier={getattr(b, 'plan_tier', 'N/A')}")

        result_sub = await session.execute(select(BusinessSubscription))
        subs = result_sub.scalars().all()
        print(f"\n=== TOTAL BUSINESS SUBSCRIPTIONS IN DB: {len(subs)} ===")
        for s in subs:
            print(f"Sub: id={s.id}, business_id={s.business_id}, plan_id={s.plan_id}, status={s.status}")

if __name__ == "__main__":
    asyncio.run(check_user())
