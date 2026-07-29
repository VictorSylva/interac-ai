import asyncio
from sqlalchemy import text
from database.session import engine

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, email, role, department FROM users"))
        rows = res.fetchall()
        print("USERS IN DATABASE:")
        for r in rows:
            print(f"ID: {r[0]} | Email: {r[1]} | Role: {r[2]} | Department: {r[3]}")

if __name__ == '__main__':
    asyncio.run(main())
