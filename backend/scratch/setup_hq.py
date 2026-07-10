import asyncio
from database.session import AsyncSessionLocal
from database.models.general import Business, User
from sqlalchemy import select

async def setup_local_hq():
    async with AsyncSessionLocal() as session:
        # 1. Create INTERAC_HQ if missing
        stmt = select(Business).where(Business.id == 'INTERAC_HQ')
        hq = (await session.execute(stmt)).scalar_one_or_none()
        if not hq:
            print("Creating local INTERAC_HQ business...")
            hq = Business(id='INTERAC_HQ', name='InteracAI System')
            session.add(hq)
        
        # 2. Link mbasitisylva@gmail.com to it
        stmt_user = select(User).where(User.email == 'mbasitisylva@gmail.com')
        admin = (await session.execute(stmt_user)).scalar_one_or_none()
        if admin:
            print("Linking super admin to HQ...")
            admin.business_id = 'INTERAC_HQ'
            admin.role = 'super_admin'
        
        await session.commit()
        print("Local HQ setup complete.")

if __name__ == "__main__":
    asyncio.run(setup_local_hq())
