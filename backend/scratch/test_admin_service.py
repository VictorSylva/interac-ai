import asyncio
import os
import sys

# Set up paths
backend_path = os.path.join(os.getcwd(), 'backend')
sys.path.append(backend_path)

from services.admin_service import admin_service

async def test_admin_service():
    print("Testing AdminService.get_all_businesses()...")
    try:
        businesses = await admin_service.get_all_businesses(include_deleted=True)
        print(f"✅ Successfully fetched {len(businesses)} businesses.")
        for b in businesses:
            print(f" - {b['name']} (ID: {b['business_id']}, Deleted: {b['is_deleted']})")
    except Exception as e:
        print(f"❌ Failed to fetch businesses: {e}")

if __name__ == "__main__":
    asyncio.run(test_admin_service())
