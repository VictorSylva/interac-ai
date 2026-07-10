import asyncio
from database.session import engine
from sqlalchemy import text

async def verify_schema():
    async with engine.connect() as conn:
        # Check businesses table
        print("Checking 'businesses' table columns...")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'businesses'"))
        columns = [row[0] for row in res.fetchall()]
        print(f"Columns: {columns}")
        if 'is_deleted' in columns:
            print("✅ 'is_deleted' column found in 'businesses' table.")
        else:
            print("❌ 'is_deleted' column NOT found in 'businesses' table.")

        # Check for new tables
        tables = ['system_logs', 'webhook_logs']
        for table in tables:
            res = await conn.execute(text(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')"))
            exists = res.scalar()
            if exists:
                print(f"✅ Table '{table}' exists.")
            else:
                print(f"❌ Table '{table}' does NOT exist.")

if __name__ == "__main__":
    import os
    import sys
    # Add backend parent to sys.path
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    
    asyncio.run(verify_schema())
