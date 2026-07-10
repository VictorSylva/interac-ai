import asyncio
from sqlalchemy import text
from database.session import engine

async def check_business():
    biz_id = "0bbd48c4-c8c3-4d6d-8e4a-937c4d5d5d5d" # Truncated from screenshot, let's search by prefix
    prefix = "0bbd48c4"
    print(f"Searching for business with prefix: {prefix}")
    async with engine.begin() as conn:
        result = await conn.execute(text(f"SELECT id, name FROM businesses WHERE id LIKE '{prefix}%'"))
        rows = result.fetchall()
        for row in rows:
            print(f"Found: {row[0]} | {row[1]}")
        
        if not rows:
            print("No business found with that prefix.")

if __name__ == "__main__":
    asyncio.run(check_business())
