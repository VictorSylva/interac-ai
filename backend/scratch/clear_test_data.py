import asyncio
from sqlalchemy import text
from database.session import engine

async def main():
    async with engine.begin() as conn:
        # 1. Update primary user's department to 'general'
        res_user = await conn.execute(
            text("UPDATE users SET department = 'general' WHERE email = 'interacai.int@gmail.com'")
        )
        print(f"Updated user interacai.int@gmail.com department to 'general' (affected: {res_user.rowcount})")

        # 2. Clear transient tables (ordered by foreign key relationships)
        tables = [
            "lead_activities",
            "appointments",
            "leads",
            "messages",
            "conversations",
            "ba_events",
            "ba_sessions",
            "tickets",
            "investigation_notes",
            "entities_v2"
        ]
        
        for table in tables:
            try:
                res = await conn.execute(text(f"DELETE FROM {table}"))
                print(f"Cleared table '{table}' (rows deleted: {res.rowcount})")
            except Exception as e:
                print(f"Could not clear table '{table}': {e}")

if __name__ == '__main__':
    asyncio.run(main())
