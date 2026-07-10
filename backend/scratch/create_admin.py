import asyncio
import uuid
from database.session import AsyncSessionLocal
from database.models.general import User
from sqlalchemy import select

async def create_super_admin():
    async with AsyncSessionLocal() as session:
        # Check if already exists
        stmt = select(User).where(User.email == 'mbasitisylva@gmail.com')
        existing_admin = (await session.execute(stmt)).scalar_one_or_none()
        if existing_admin:
            print("mbasitisylva@gmail.com already exists. Updating role...")
            existing_admin.role = 'super_admin'
            await session.commit()
            return

        # Get hash from existing owner
        stmt = select(User).where(User.email == 'interacai.int@gmail.com')
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if not existing:
            print("Error: interacai.int@gmail.com not found")
            return

        # Create super admin
        new_user = User(
            id=str(uuid.uuid4()),
            email='mbasitisylva@gmail.com',
            password_hash=existing.password_hash,
            role='super_admin',
            business_id=existing.business_id
        )
        session.add(new_user)
        await session.commit()
        print("Created mbasitisylva@gmail.com as super_admin locally")

if __name__ == "__main__":
    asyncio.run(create_super_admin())
