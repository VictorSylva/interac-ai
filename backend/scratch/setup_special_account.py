import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription
from database.models.general import User
from sqlalchemy import select

async def setup():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.email == 'interacai.int@gmail.com'))
        user = res.scalar_one_or_none()
        if user:
            bid = user.business_id
            print(f"Found user interacai.int@gmail.com with business_id: {bid}")
            sub_res = await session.execute(select(BusinessSubscription).where(BusinessSubscription.business_id == bid))
            sub = sub_res.scalar_one_or_none()
            if not sub:
                print("Creating Enterprise subscription...")
                sub = BusinessSubscription(
                    business_id=bid, 
                    plan_id='enterprise', 
                    status='active'
                )
                session.add(sub)
            else:
                print("Updating existing subscription to Enterprise/Active...")
                sub.plan_id = 'enterprise'
                sub.status = 'active'
            await session.commit()
            print("Special account Enterprise status verified.")
        else:
            print("User interacai.int@gmail.com not found. Skipping DB update.")

if __name__ == "__main__":
    asyncio.run(setup())
