import asyncio
from database.session import AsyncSessionLocal
from database.models.general import Business
from database.models.workflow import Workflow
from database.models.general import User
from sqlalchemy import select
from create_booking_workflow import get_booking_workflow_payload
from services.workflow_engine import workflow_engine

async def seed_all_businesses():
    async with AsyncSessionLocal() as session:
        # Get all businesses
        res = await session.execute(select(Business))
        businesses = res.scalars().all()
        
        for biz in businesses:
            # 1. Ensure the User who owns this business is linked to the UUID
            if hasattr(biz, 'email') and getattr(biz, 'email'):
                res_user = await session.execute(
                    select(User).where(User.email.ilike(biz.email))
                )
                user = res_user.scalars().first()
                if user and user.business_id != biz.id:
                    print(f"[{biz.name}] Linking user {user.email} to business UUID {biz.id}...")
                    user.business_id = biz.id
                    await session.commit()

            # 2. Check if an appointment_booked workflow exists
            res_wf = await session.execute(
                select(Workflow).where(
                    Workflow.business_id == biz.id,
                    Workflow.trigger_type == 'appointment_booked'
                )
            )
            existing_wf = res_wf.scalars().first()
            
            # If the workflow doesn't exist, OR if it has a null definition (like the broken one)
            if not existing_wf or not existing_wf.definition:
                if existing_wf and not existing_wf.definition:
                    # We should safely delete the broken one so we can replace it
                    print(f"[{biz.name}] Found broken workflow (no UI definition). Replacing...")
                    await session.delete(existing_wf)
                    await session.commit()
                
                print(f"[{biz.name}] Seeding Booking Confirmation Workflow...")
                payload = get_booking_workflow_payload(biz.id)
                await workflow_engine.create_workflow(biz.id, payload)
                print(f"[{biz.name}] -> Success!")
            else:
                print(f"[{biz.name}] Already has valid workflow. Skipping.")

if __name__ == "__main__":
    asyncio.run(seed_all_businesses())
