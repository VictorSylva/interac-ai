import os
import sys
import asyncio
import subprocess
from sqlalchemy import inspect

# Add backend folder to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import engine

async def init_db():
    print("Auto-creating initial database tables if they do not exist...")
    # Import models to ensure they are registered with Base.metadata
    from database.base import Base
    from database.models import general, chat, crm, workflow, scheduling, behavior_analytics, sales, dynamic_entity, observation, entitlement
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Initial database tables created/verified.")
    
    # Ensure backward-compatible column migrations for existing tables
    async with engine.begin() as conn:
        from sqlalchemy import text
        try:
            if engine.dialect.name == "postgresql":
                await conn.execute(text("ALTER TABLE business_department_configs ADD COLUMN IF NOT EXISTS property_id VARCHAR;"))
            elif engine.dialect.name == "sqlite":
                def add_sqlite_cols(sync_conn):
                    cursor = sync_conn.connection.cursor()
                    cursor.execute("PRAGMA table_info(business_department_configs)")
                    cols = [c[1] for c in cursor.fetchall()]
                    if "property_id" not in cols:
                        cursor.execute("ALTER TABLE business_department_configs ADD COLUMN property_id VARCHAR")
                        sync_conn.connection.commit()
                await conn.run_sync(add_sqlite_cols)
        except Exception as e:
            print(f"Non-critical schema compatibility check note: {e}")

    # Purge legacy mock dummy rooms/guests seeded during older tenant provisioning
    async with engine.begin() as conn:
        from sqlalchemy import text
        try:
            if engine.dialect.name == "postgresql":
                await conn.execute(text("""
                    DELETE FROM entities_v2 
                    WHERE display_label IN ('Room 101', 'Room 102', 'Room 201', 'Alice Smith', 'Bob Johnson')
                       OR (display_label = '201' AND attributes->>'room_type' = 'Executive Suite' AND (attributes->>'nightly_rate')::numeric = 250);
                """))
            else:
                await conn.execute(text("""
                    DELETE FROM entities_v2 
                    WHERE display_label IN ('Room 101', 'Room 102', 'Room 201', 'Alice Smith', 'Bob Johnson');
                """))
            print("Purged legacy mock dummy hotel data.")
        except Exception as purge_err:
            print(f"Dummy data purge note: {purge_err}")
            
    # Check if alembic_version table exists
    async with engine.connect() as conn:
        def check_alembic_table(sync_conn):
            return inspect(sync_conn).has_table("alembic_version")
        return await conn.run_sync(check_alembic_table)

def main():
    print("--- InteracAI Custom Startup Script ---")
    
    # 1. Initialize tables & check if alembic_version exists
    has_alembic = asyncio.run(init_db())
    
    # 2. Run Alembic stamp or upgrade as a subprocess to avoid event loop conflicts
    if not has_alembic:
        print("Fresh database detected. Stamping Alembic head (marking schema as up to date)...")
        res = subprocess.run(["alembic", "copy-db", "stamp", "head"], capture_output=True, text=True)
        # If 'copy-db' is not a custom command, let's just run standard alembic stamp head
        res = subprocess.run(["alembic", "stamp", "head"], capture_output=True, text=True)
        print(res.stdout)
        if res.returncode != 0:
            print(f"Error stamping head: {res.stderr}")
            sys.exit(res.returncode)
        print("Stamping completed successfully.")
    else:
        print("Existing database detected. Running Alembic migrations to upgrade to head...")
        res = subprocess.run(["alembic", "upgrade", "head"], capture_output=True, text=True)
        print(res.stdout)
        if res.returncode != 0:
            print(f"Error migrating database: {res.stderr}")
            sys.exit(res.returncode)
        print("Migrations completed successfully.")

    # 3. Ensure essential subscription plans (including custom_operating_system) exist
    try:
        from seed_plans import seed_plans
        print("Ensuring standard subscription plans are seeded...")
        asyncio.run(seed_plans())
    except Exception as e:
        print(f"Warning: Failed to auto-seed subscription plans: {e}")

if __name__ == "__main__":
    main()
