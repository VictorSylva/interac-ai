import asyncio
import sys
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import config
from database.session import DATABASE_URL, engine
from database.base import Base
from database.models import general, chat, crm, workflow, scheduling, behavior_analytics, sales, entitlement, dynamic_entity, observation

async def sync_database():
    print(f"Connecting to database: {DATABASE_URL}")
    async with engine.begin() as conn:
        print("Creating all tables if not exist...")
        await conn.run_sync(Base.metadata.create_all)
        
        is_pg = "postgresql" in DATABASE_URL
        ine = "IF NOT EXISTS" if is_pg else ""
        
        patches = [
            f"ALTER TABLE users ADD COLUMN {ine} reset_token VARCHAR;",
            f"ALTER TABLE users ADD COLUMN {ine} reset_token_expiry TIMESTAMP;",
            f"ALTER TABLE users ADD COLUMN {ine} department VARCHAR;",
            f"ALTER TABLE users ADD COLUMN {ine} property_id VARCHAR;",
            f"ALTER TABLE users ADD COLUMN {ine} status VARCHAR DEFAULT 'active';",
            f"ALTER TABLE users ADD COLUMN {ine} email_verified BOOLEAN DEFAULT FALSE;",
            f"ALTER TABLE users ADD COLUMN {ine} verification_token VARCHAR;",
            f"ALTER TABLE users ADD COLUMN {ine} role_id VARCHAR;",
            f"ALTER TABLE users ADD COLUMN {ine} department_id VARCHAR;",
            f"ALTER TABLE users ADD COLUMN {ine} phone VARCHAR;",
            f"ALTER TABLE users ADD COLUMN {ine} receive_operational_alerts BOOLEAN DEFAULT TRUE;",
            f"ALTER TABLE users ADD COLUMN {ine} notification_preference VARCHAR DEFAULT 'all';",
            f"ALTER TABLE businesses ADD COLUMN {ine} is_deleted BOOLEAN DEFAULT FALSE;",
            f"ALTER TABLE business_settings ADD COLUMN {ine} auto_escalate_on_keyword BOOLEAN DEFAULT FALSE;",
            f"ALTER TABLE business_settings ADD COLUMN {ine} notification_cooldown_minutes INTEGER DEFAULT 30;",
            f"ALTER TABLE business_settings ADD COLUMN {ine} departments JSONB DEFAULT '[]';",
            f"ALTER TABLE business_settings ADD COLUMN {ine} installed_modules JSONB DEFAULT '[]';",
            f"ALTER TABLE business_settings ADD COLUMN {ine} updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            f"ALTER TABLE conversations ADD COLUMN {ine} mode VARCHAR DEFAULT 'ai';",
            f"ALTER TABLE conversations ADD COLUMN {ine} assigned_agent_id VARCHAR;",
            f"ALTER TABLE conversations ADD COLUMN {ine} status VARCHAR DEFAULT 'active';",
            f"ALTER TABLE conversations ADD COLUMN {ine} last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            f"ALTER TABLE conversations ADD COLUMN {ine} conversation_start_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            f"ALTER TABLE conversations ADD COLUMN {ine} is_active BOOLEAN DEFAULT TRUE;",
            f"ALTER TABLE conversations ADD COLUMN {ine} department VARCHAR;",
            f"ALTER TABLE sales_orders ADD COLUMN {ine} payment_mode VARCHAR DEFAULT 'test';",
            f"ALTER TABLE subscription_plans ADD COLUMN {ine} is_public BOOLEAN DEFAULT TRUE;",
            f"ALTER TABLE subscription_plans ADD COLUMN {ine} requires_contact BOOLEAN DEFAULT FALSE;",
            f"ALTER TABLE user_invitations ADD COLUMN {ine} phone VARCHAR;",
            f"ALTER TABLE business_department_configs ADD COLUMN {ine} property_id VARCHAR;"
        ]
        
        for patch in patches:
            try:
                await conn.execute(text(patch))
            except Exception as e:
                pass
        
        print("Database schema synchronization complete!")

if __name__ == "__main__":
    asyncio.run(sync_database())
