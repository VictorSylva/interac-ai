import asyncio
import os
import sys

# Mocking modules for standalone test
sys.path.append(os.getcwd())

async def test_ai():
    from services.ai_service import generate_response
    print("Testing AI Engine...")
    try:
        response = await generate_response(
            user_message="Hello",
            user_id="test_user",
            business_id="mbasitisylva@gmail.com"
        )
        print(f"AI Response: {response}")
    except Exception as e:
        import traceback
        print(f"FAILED: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_ai())
