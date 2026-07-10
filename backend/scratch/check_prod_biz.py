import asyncio
import httpx

PROD_API_URL = "https://interact-backend-pcex.onrender.com"
ADMIN_KEY = "interact_secret_2026"

async def check_prod_data():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check Businesses
        res = await client.post(f"{PROD_API_URL}/api/admin/maintenance", json={
            "admin_key": ADMIN_KEY,
            "action": "check_schema", # Just to see if it's alive, but let's try to get data
            "table": "businesses"
        })
        print(f"Schema check: {res.text}")

        # Let's try to grant lifetime again but first verify the ID
        res_usr = await client.get(f"{PROD_API_URL}/api/web-chat/history?business_id=0bbd48c4-b066-435a-be3d-c095b55897c6&user_id=test")
        print(f"Main Biz Ping: {res_usr.status_code}")

        res_hq = await client.get(f"{PROD_API_URL}/api/web-chat/history?business_id=INTERAC_HQ&user_id=test")
        print(f"HQ Biz Ping: {res_hq.status_code}")

if __name__ == "__main__":
    asyncio.run(check_prod_data())
