import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys
import os

# Import config from backend directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import config

async def run_migration():
    # Ensure URL is correct for asyncpg
    url = config.DATABASE_URL
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    print(f"Connecting to {url.split('@')[-1]}...")
    engine = create_async_engine(url)
    
    async with engine.begin() as conn:
        print("Running migrations...")
        
        # 1. Add ai_metadata to sales_offers
        try:
            await conn.execute(text("ALTER TABLE sales_offers ADD COLUMN ai_metadata JSONB DEFAULT '{}';"))
            print("Successfully added ai_metadata to sales_offers.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("Column ai_metadata already exists in sales_offers.")
            else:
                print(f"Error adding ai_metadata: {e}")

        # 2. Add assessment_template to sales_pages
        try:
            await conn.execute(text("ALTER TABLE sales_pages ADD COLUMN assessment_template JSONB DEFAULT '[]';"))
            print("Successfully added assessment_template to sales_pages.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("Column assessment_template already exists in sales_pages.")
            else:
                print(f"Error adding assessment_template: {e}")

    await engine.dispose()
    print("Migration finished!")

if __name__ == "__main__":
    asyncio.run(run_migration())
