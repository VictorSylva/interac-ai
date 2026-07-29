import asyncio
from sqlalchemy import text
from database.session import engine

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, customer_name, department FROM conversations"))
        rows = res.fetchall()
        print("CONVERSATIONS IN DATABASE:")
        for r in rows:
            print(f"ID: {r[0]} | Guest: {r[1]} | Department: {r[2]}")

if __name__ == '__main__':
    asyncio.run(main())
