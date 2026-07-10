import asyncio
import os
import sys
import uuid

# Set up paths
backend_path = os.path.join(os.getcwd(), 'backend')
sys.path.append(backend_path)

from database.session import AsyncSessionLocal
from database.models.general import User, Business
from services.auth_service import get_password_hash
from sqlalchemy import select, update, delete

async def seed_super_admin():
    old_email = "admin@interac.ai"
    new_email = "mbasitisylva@gmail.com"
    password = "Setecs@55Astro"
    
    async with AsyncSessionLocal() as session:
        # 1. Check if old user exists
        stmt_old = select(User).where(User.email == old_email)
        res_old = await session.execute(stmt_old)
        old_user = res_old.scalar_one_or_none()
        
        # 2. Check if new user exists
        stmt_new = select(User).where(User.email == new_email)
        res_new = await session.execute(stmt_new)
        new_user = res_new.scalar_one_or_none()
        
        if old_user and not new_user:
            print(f"Migrating super_admin from {old_email} to {new_email}...")
            old_user.email = new_email
            old_user.password_hash = get_password_hash(password)
            old_user.role = "super_admin"
        elif new_user:
            print(f"Updating existing user {new_email} to super_admin...")
            new_user.password_hash = get_password_hash(password)
            new_user.role = "super_admin"
            # Cleanup old if exists
            if old_user:
                await session.execute(delete(User).where(User.id == old_user.id))
        else:
            print(f"Creating new super_admin: {new_email}...")
            biz_id = "interac_hq"
            biz_stmt = select(Business).where(Business.id == biz_id)
            biz_res = await session.execute(biz_stmt)
            if not biz_res.scalar_one_or_none():
                system_biz = Business(id=biz_id, name="InteracAI System")
                session.add(system_biz)
            
            new_admin = User(
                id=str(uuid.uuid4()),
                email=new_email,
                password_hash=get_password_hash(password),
                role="super_admin",
                business_id=biz_id
            )
            session.add(new_admin)
        
        await session.commit()
        print(f"DONE: Super Admin is now {new_email}")

if __name__ == "__main__":
    asyncio.run(seed_super_admin())
