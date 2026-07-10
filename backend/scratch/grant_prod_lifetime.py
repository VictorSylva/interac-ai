import asyncio
import httpx

async def grant_prod_lifetime():
    async with httpx.AsyncClient(timeout=60.0) as client:
        print("Granting lifetime subscriptions on PRODUCTION...")
        
        target_ids = ['0bbd48c4-b066-435a-be3d-c095b55897c6', 'INTERAC_HQ', 'interac_hq']
        for bid in target_ids:
            res = await client.post('https://interact-backend-pcex.onrender.com/api/admin/maintenance', json={
                'admin_key': 'interact_secret_2026',
                'action': 'lifetime_subscription',
                'business_id': bid
            })
            print(f"ID {bid}: {res.text}")

if __name__ == "__main__":
    asyncio.run(grant_prod_lifetime())
