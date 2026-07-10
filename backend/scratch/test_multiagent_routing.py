import asyncio
import httpx
import json

async def test_routing():
    business_id = "groupcopac@gmail.com" # Adjust to your test business ID
    user_id = "test_user_123"
    
    print(f"--- Testing Escalation to Sales ---")
    
    # 1. Simulate a message that should trigger a human handover
    # (Assuming you have a workflow or keyword trigger for 'human')
    url = "http://localhost:8000/api/web_chat"
    payload = {
        "business_id": business_id,
        "user_id": user_id,
        "message": "I want to talk to a human in the sales department"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        print(f"Backend Response: {response.json()}")

    print("\n--- Checking Conversation State ---")
    # 2. Check if the conversation is now in human mode and routed to 'sales'
    status_url = f"http://localhost:8000/api/conversations?business_id={business_id}"
    async with httpx.AsyncClient() as client:
        res = await client.get(status_url)
        convs = res.json()
        for c in convs:
            if user_id in c['id']:
                print(f"ID: {c['id']}")
                print(f"Mode: {c.get('mode')}")
                print(f"Status: {c.get('status')}")
                print(f"Department: {c.get('department')}")
                print(f"Assigned Agent: {c.get('assignedAgentId')}")

if __name__ == "__main__":
    asyncio.run(test_routing())
