import asyncio
from sqlalchemy import select
from database.session import AsyncSessionLocal
from database.models.billing import SubscriptionPlan

async def check():
    print("Checking database for subscription plans...")
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(SubscriptionPlan)
            result = await session.execute(stmt)
            plans = result.scalars().all()
            print(f"Found {len(plans)} plans.")
            for p in plans:
                print(f"ID: {p.id}, Name: {p.name}, Price: {p.price}, Tokens: {p.token_allocation}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
