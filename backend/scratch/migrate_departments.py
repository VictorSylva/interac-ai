import asyncio
from sqlalchemy import text
from database.session import engine

async def migrate_departments():
    print("Starting migration: Adding departments column to business_settings...")
    async with engine.begin() as conn:
        try:
            # PostgreSQL syntax to add column if not exists
            await conn.execute(text("ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS departments JSONB DEFAULT '[]'::jsonb"))
            print("Successfully added departments column (or it already existed).")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(migrate_departments())
