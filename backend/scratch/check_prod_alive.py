import asyncio
import httpx

PROD_API_URL = "https://interact-backend-pcex.onrender.com"
ADMIN_KEY = "interact_secret_2026"

async def check_prod():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check businesses via maintenance action if possible or just history
        # Actually, let's just try to login with mbasitisylva@gmail.com
        print("Checking production status...")
        res = await client.get(f"{PROD_API_URL}/api/web-chat/history?business_id=test&user_id=test")
        print(f"Status: {res.status_code}")

if __name__ == "__main__":
    asyncio.run(check_prod())
