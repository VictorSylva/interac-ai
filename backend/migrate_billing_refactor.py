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
        
        # 1. Update conversations table
        columns_to_add = [
            ("last_message_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("conversation_start_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("is_active", "BOOLEAN DEFAULT TRUE")
        ]
        
        for col_name, col_type in columns_to_add:
            try:
                await conn.execute(text(f"ALTER TABLE conversations ADD COLUMN {col_name} {col_type};"))
                print(f"Successfully added {col_name} to conversations.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"Column {col_name} already exists in conversations.")
                else:
                    print(f"Error adding {col_name}: {e}")

        # 2. Create business_usage_metrics table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS business_usage_metrics (
                    business_id VARCHAR PRIMARY KEY REFERENCES businesses(id),
                    total_tokens_used INTEGER DEFAULT 0,
                    total_conversations INTEGER DEFAULT 0,
                    estimated_cost FLOAT DEFAULT 0.0,
                    estimated_profit FLOAT DEFAULT 0.0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            print("Successfully created business_usage_metrics table.")
        except Exception as e:
            print(f"Error creating business_usage_metrics table: {e}")

    await engine.dispose()
    print("Migration finished!")

if __name__ == "__main__":
    asyncio.run(run_migration())
