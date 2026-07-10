import asyncio
import httpx

async def fix_prod():
    async with httpx.AsyncClient(timeout=60.0) as client:
        print("Cleaning up production data...")
        
        # 1. Deduplicate HQ
        res_dedup = await client.post('https://interact-backend-pcex.onrender.com/api/admin/maintenance', json={
            'admin_key': 'interact_secret_2026',
            'action': 'deduplicate_businesses'
        })
        print(f"Deduplication: {res_dedup.text}")

        # 2. Reset Main Account Password
        res_pwd1 = await client.post('https://interact-backend-pcex.onrender.com/api/admin/maintenance', json={
            'admin_key': 'interact_secret_2026',
            'action': 'reset_user_password',
            'email': 'interacai.int@gmail.com',
            'password': 'Interac@2026'
        })
        print(f"Main Account Pwd: {res_pwd1.text}")

        # 3. Reset Super Admin Password
        res_pwd2 = await client.post('https://interact-backend-pcex.onrender.com/api/admin/maintenance', json={
            'admin_key': 'interact_secret_2026',
            'action': 'reset_user_password',
            'email': 'mbasitisylva@gmail.com',
            'password': 'Interac@2026'
        })
        print(f"Super Admin Pwd: {res_pwd2.text}")

        # 4. Grant Lifetime to both
        for bid in ['0bbd48c4-b066-435a-be3d-c095b55897c6', 'INTERAC_HQ']:
            res_sub = await client.post('https://interact-backend-pcex.onrender.com/api/admin/maintenance', json={
                'admin_key': 'interact_secret_2026',
                'action': 'lifetime_subscription',
                'business_id': bid
            })
            print(f"Subscription ({bid}): {res_sub.text}")

if __name__ == "__main__":
    asyncio.run(fix_prod())
