import asyncio
import httpx

async def verify():
    base_url = "http://localhost:8000" # Assuming backend is running locally
    
    print("--- 1. Testing Plans API ---")
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{base_url}/api/subscriptions/plans")
            plans = res.json()
            print(f"Plans found: {[p['id'] for p in plans]}")
            for p in plans:
                print(f"Plan: {p['id']}, Public: {p['is_public']}, Price: {p['price']}")
    except Exception as e:
        print(f"Plans API error: {e}")

    print("\n--- 2. Testing Special Account Override ---")
    try:
        from services.subscription_service import check_access
        res = await check_access("interacai.int@gmail.com")
        print(f"Override Result: {res}")
    except Exception as e:
        print(f"Access check error: {e}")

    print("\n--- 3. Testing Enterprise Protection ---")
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{base_url}/api/subscriptions/initialize", json={
                "plan_id": "enterprise",
                "business_id": "test_biz",
                "email": "test@example.com"
            })
            print(f"Initialize Enterprise Status: {res.status_code}")
            print(f"Initialize Enterprise Body: {res.json()}")
    except Exception as e:
        print(f"Initialize Enterprise error: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
