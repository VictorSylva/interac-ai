import asyncio
from database.session import AsyncSessionLocal
from services.auth_service import authenticate_user

async def test_login():
    async with AsyncSessionLocal() as session:
        print("Testing local login for interacai.int@gmail.com...")
        # I'll try common passwords or just check if it returns False vs ValueError
        try:
            user = await authenticate_user(session, 'interacai.int@gmail.com', 'your_password_here')
            if user:
                print("Login SUCCESS")
            else:
                print("Login FAILED (Invalid credentials)")
        except ValueError as e:
            print(f"Login ERROR: {e}")
        except Exception as e:
            print(f"Unexpected Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_login())
