import sys
import os
sys.path.append(os.path.join(os.getcwd()))

import asyncio
from database.session import AsyncSessionLocal
from sqlalchemy import select

async def check():
    # Dynamically import model
    from database.models.general import Business
    # Let's inspect business_whatsapp_configs
    # We can query the DB directly
    async with AsyncSessionLocal() as session:
        try:
            # We can execute a raw SQL query since we don't know the exact class name
            from sqlalchemy import text
            res = await session.execute(text("SELECT * FROM business_whatsapp_configs"))
            rows = res.fetchall()
            print("business_whatsapp_configs rows:")
            for r in rows:
                print(r)
        except Exception as e:
            print("Error querying configs:", e)

if __name__ == "__main__":
    asyncio.run(check())
