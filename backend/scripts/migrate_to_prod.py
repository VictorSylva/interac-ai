import asyncio
import httpx
from database.session import AsyncSessionLocal
from database.models.general import User, Business
from sqlalchemy import select

PROD_API_URL = "https://interact-backend-pcex.onrender.com"
ADMIN_KEY = "interact_secret_2026"
TARGET_EMAIL = "interacai.int@gmail.com"

async def get_local_biz_id():
    async with AsyncSessionLocal() as session:
        stmt = select(User.business_id).where(User.email == TARGET_EMAIL)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

async def run_migration():
    print(f"--- Starting Migration for {TARGET_EMAIL} ---")
    
    local_id = await get_local_biz_id()
    if not local_id:
        print(f"Error: Local user {TARGET_EMAIL} not found.")
        return

    print(f"Local Business ID: {local_id}")

    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Delete old production business (to ensure clean slate for this ID/Email)
        print("Cleaning up old production data for this business...")
        res_del = await client.post(f"{PROD_API_URL}/api/admin/maintenance", json={
            "admin_key": ADMIN_KEY,
            "action": "delete_business",
            "business_id": local_id
        })
        print(f"Cleanup Status: {res_del.status_code} | {res_del.text}")

        # 2. Run standard sync (Pushes all local data including the target business)
        print("Running full data sync...")
        import sys
        import os
        sys.path.append(os.getcwd())
        from sync_to_production import sync_to_production
        await sync_to_production()

        # 3. Grant Lifetime Subscription
        print(f"Granting Lifetime Enterprise Plan to {local_id}...")
        res_sub = await client.post(f"{PROD_API_URL}/api/admin/maintenance", json={
            "admin_key": ADMIN_KEY,
            "action": "lifetime_subscription",
            "business_id": local_id
        })
        print(f"Subscription Status: {res_sub.status_code} | {res_sub.text}")

    print("--- Migration Complete! ---")

if __name__ == "__main__":
    asyncio.run(run_migration())
