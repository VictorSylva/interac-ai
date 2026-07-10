import asyncio
import httpx

PROD_API_URL = "https://interact-backend-pcex.onrender.com"
ADMIN_KEY = "interact_secret_2026"

async def fix_links():
    payload = {
        "admin_key": ADMIN_KEY,
        "action": "fix_user_links"
    }
    
    print(f"Sending fix-links request to {PROD_API_URL}...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{PROD_API_URL}/api/admin/maintenance",
                json=payload
            )
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_links())
