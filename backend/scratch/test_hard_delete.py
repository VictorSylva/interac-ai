import asyncio
from database.session import AsyncSessionLocal
from services.admin_service import admin_service

async def test_hard_delete():
    # Let's delete the business Victor's Enterprise Solutions (ID: default)
    success = await admin_service.hard_delete_business('default')
    print(f"Hard delete success: {success}")

if __name__ == '__main__':
    asyncio.run(test_hard_delete())
