import asyncio
from sqlalchemy import select
from database.session import AsyncSessionLocal
from database.models.general import User, Business

async def check():
    auth_email = 'interacai.int@gmail.com'
    print(f"Checking for user: {auth_email}")
    async with AsyncSessionLocal() as session:
        # Check User
        stmt = select(User).where(User.email.ilike(auth_email))
        u = (await session.execute(stmt)).scalar_one_or_none()
        if u:
            print(f"FOUND USER: {u.email}, BusinessID: {u.business_id}")
            # Check Business
            b_stmt = select(Business).where(Business.id == u.business_id)
            b = (await session.execute(b_stmt)).scalar_one_or_none()
            if b:
                print(f"FOUND BUSINESS: {b.name}, ID: {b.id}, Plan: {b.plan_name}")
            else:
                print(f"BUSINESS NOT FOUND for UUID: {u.business_id}")
        else:
            print("USER NOT FOUND")
            # Maybe the business_id IS the email?
            b_stmt = select(Business).where(Business.id == auth_email)
            b = (await session.execute(b_stmt)).scalar_one_or_none()
            if b:
                print(f"FOUND BUSINESS (ID=Email): {b.name}, ID: {b.id}")

if __name__ == "__main__":
    asyncio.run(check())
