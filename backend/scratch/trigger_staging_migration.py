import asyncio
import httpx

async def run_staging_migration():
    url = "https://interacai-backend-staging.onrender.com/api/admin/maintenance"
    payload = {
        "admin_key": "interact_secret_2026",
        "action": "migrate_departments"
    }
    
    print(f"Triggering migration on {url}...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, json=payload)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.json()}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_staging_migration())
