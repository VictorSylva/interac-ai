import asyncio
import sys
import os

# Add app to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.camera import Camera
from sqlalchemy import select, delete

async def main():
    async with SessionLocal() as db:
        await db.execute(delete(Camera).where(Camera.rtsp_url == "mock://main_gate"))
        await db.commit()
        print("Mock camera deleted successfully.")

if __name__ == "__main__":
    asyncio.run(main())
