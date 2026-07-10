import asyncio
import sys
import os
import logging
from sqlalchemy import text

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription, SubscriptionPlan
from database.models.payment import PaymentTransaction
from database.base import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("schema_apply_v4")

async def apply_schema():
    logger.info("Applying schema updates for V4...")
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Create new table PaymentTransaction
            # We use metadata to ensure table is created if it doesn't exist
            from sqlalchemy import create_engine
            # Need sync engine for metadata.create_all usually, or use the async session
            # As we are in async, we can use session.connection()
            def create_tables(conn):
                PaymentTransaction.__table__.create(conn, checkfirst=True)
            
            # Actually, simpler to just run raw SQL for new table if needed
            # But let's use the metadata approach
            
            # For adding columns to existing tables
            queries = [
                # subscription_plans
                "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS conversation_limit INTEGER DEFAULT 500",
                
                # business_subscriptions
                "ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS conversations_used INTEGER DEFAULT 0",
                "ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP"
            ]
            
            for q in queries:
                logger.info(f"Executing: {q}")
                await session.execute(text(q))
            
            # Create payment_transactions table manually if checkfirst isn't enough
            create_table_q = """
            CREATE TABLE IF NOT EXISTS payment_transactions (
                id VARCHAR PRIMARY KEY,
                business_id VARCHAR REFERENCES businesses(id),
                reference VARCHAR UNIQUE,
                amount FLOAT,
                currency VARCHAR DEFAULT 'NGN',
                status VARCHAR,
                transaction_metadata JSON,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """
            logger.info("Ensuring payment_transactions table exists...")
            await session.execute(text(create_table_q))
            
            # Create index for reference
            await session.execute(text("CREATE INDEX IF NOT EXISTS ix_payment_transactions_reference ON payment_transactions (reference)"))
            await session.execute(text("CREATE INDEX IF NOT EXISTS ix_payment_transactions_business_id ON payment_transactions (business_id)"))
            
            await session.commit()
            logger.info("SCHEMA UPDATES COMPLETED.")
            
        except Exception as e:
            logger.error(f"Error applying schema: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(apply_schema())
