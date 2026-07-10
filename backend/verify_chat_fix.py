import asyncio
from httpx import AsyncClient
import json

async def test():
    async with AsyncClient(base_url='http://localhost:8000') as ac:
        payload = {
            "message": "hello",
            "user_id": "final-test-user",
            "business_id": "0168904e-2590-4dbb-b855-3f9bfe06e181"
        }
        try:
            # We hit the actual running container port from within it
            response = await ac.post("/api/web-chat", json=payload, timeout=30.0)
            print(f"Status: {response.status_code}")
            print(f"Body: {response.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
