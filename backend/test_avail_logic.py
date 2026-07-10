
import asyncio
from services.scheduling_service import scheduling_service
import json

async def test_availability():
    business_id = "0bbd48c4-b066-435a-be3d-c095b55897c6"
    print(f"Testing availability for {business_id}...")
    
    slots = await scheduling_service.get_upcoming_available_slots(business_id)
    print(f"Slots found: {json.dumps(slots, indent=2)}")

if __name__ == "__main__":
    asyncio.run(test_availability())
