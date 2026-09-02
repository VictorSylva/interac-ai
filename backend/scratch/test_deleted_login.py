import asyncio
from database.session import AsyncSessionLocal
from services.auth_service import authenticate_user

async def test_deleted_login():
    async with AsyncSessionLocal() as session:
        print("Testing login for cosmoocart@gmail.com (Deleted Business)...")
        try:
            user = await authenticate_user(session, 'cosmoocart@gmail.com', 'wrongpassword')
            print(f"Login returned: {user}")
        except ValueError as e:
            print(f"Login failed as expected with ValueError: {e}")
        except Exception as e:
            print(f"Unexpected error: {e}")

if __name__ == "__main__":
    asyncio.run(test_deleted_login())
