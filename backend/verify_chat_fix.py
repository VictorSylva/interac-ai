import asyncio
from httpx import AsyncClient
import time

async def test():
    async with AsyncClient(base_url='http://localhost:8000') as ac:
        payload = {
            "message": "hello",
            "user_id": "final-test-user",
            "business_id": "0bbd48c4-b066-435a-be3d-c095b55897c6"
        }
        for i in range(1, 4):
            print(f"\n--- Request {i} ---")
            start = time.time()
            try:
                response = await ac.post("/api/web-chat", json=payload, timeout=40.0)
                duration = time.time() - start
                print(f"Status: {response.status_code}")
                print(f"Body: {response.text}")
                print(f"Request {i} completed in {duration:.2f} seconds")
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())

