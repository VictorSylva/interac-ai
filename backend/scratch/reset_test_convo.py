import asyncio
from services.db_service import set_conversation_mode

async def reset_convo():
    business_id = "0bbd48c4-b066-435a-be3d-c095b55897c6"
    user_id = "web_user_yih48cyxk"
    print(f"Resetting conversation {business_id}:{user_id} to AI mode...")
    await set_conversation_mode(business_id, user_id, mode="ai", status="active")
    print("Done!")

if __name__ == "__main__":
    asyncio.run(reset_convo())
