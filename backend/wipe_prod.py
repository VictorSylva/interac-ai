import httpx
import asyncio

PROD_API_URL = "https://interact-backend-pcex.onrender.com"
ADMIN_KEY = "interact_secret_2026"

async def wipe_production():
    print(f"Waiting for Render deployment on {PROD_API_URL}...")
    payload = {
        "admin_key": ADMIN_KEY,
        "action": "wipe_db"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for i in range(30):
            try:
                response = await client.post(
                    f"{PROD_API_URL}/api/admin/maintenance",
                    json=payload
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") != "unknown_action":
                        print(f"Success! Response: {data}")
                        return
                    else:
                        print(f"Still running old version... retrying in 10s...")
                else:
                    print(f"Deploying (Got {response.status_code})... retrying in 10s...")
            except Exception as e:
                print(f"Deploying (Error: {e})... retrying in 10s...")
            await asyncio.sleep(10)
        print("Timeout waiting for deployment.")

if __name__ == "__main__":
    asyncio.run(wipe_production())
