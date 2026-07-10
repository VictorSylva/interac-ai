import asyncio
import httpx
import sys
import os

PROD_API_URL = "https://interact-backend-pcex.onrender.com"
ADMIN_KEY = "interact_secret_2026"

async def full_redeploy():
    print("--- STARTING FULL PRODUCTION REDEPLOY ---")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1. WIPE DATABASE
        print("Wiping production database...")
        res_wipe = await client.post(f"{PROD_API_URL}/api/admin/maintenance", json={
            "admin_key": ADMIN_KEY,
            "action": "wipe_db"
        })
        print(f"Wipe Status: {res_wipe.status_code} | {res_wipe.text}")
        
        if res_wipe.status_code != 200:
            print("Wipe failed! Aborting sync.")
            return

        # 2. RUN FULL SYNC
        print("Pushing clean local data to production...")
        sys.path.append(os.getcwd())
        from sync_to_production import sync_to_production
        await sync_to_production()

        # 3. GRANT LIFETIME TO MAIN BUSINESS
        # We need to find the local ID for interacai.int@gmail.com again
        from database.session import AsyncSessionLocal
        from database.models.general import User
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as session:
            stmt = select(User.business_id).where(User.email == 'interacai.int@gmail.com')
            res = await session.execute(stmt)
            main_id = res.scalar_one_or_none()
        
        if main_id:
            print(f"Granting Lifetime to {main_id}...")
            res_sub = await client.post(f"{PROD_API_URL}/api/admin/maintenance", json={
                "admin_key": ADMIN_KEY,
                "action": "lifetime_subscription",
                "business_id": main_id
            })
            print(f"Subscription Status: {res_sub.status_code} | {res_sub.text}")

    print("--- REDEPLOY COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(full_redeploy())
