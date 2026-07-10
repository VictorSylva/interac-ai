import asyncio
import httpx

async def check_staging_schema():
    url = "https://interacai-backend-staging.onrender.com/api/admin/maintenance"
    payload = {
        "admin_key": "interact_secret_2026",
        "action": "check_schema",
        "table": "business_settings"
    }
    
    print(f"Checking schema on {url}...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, json=payload)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.json()}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_staging_schema())
