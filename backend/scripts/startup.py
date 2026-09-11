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
    from database.base import Base
    from database.models import general, chat, crm, workflow, scheduling, behavior_analytics, sales, dynamic_entity, observation, entitlement, billing, payment, admin
    
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

async def seed_platform_hq():
    print("Ensuring Master Platform Accounts and Industry Modules are seeded...")
    from database.session import AsyncSessionLocal
    from services.auth_service import get_password_hash
    from sqlalchemy import select
    from database.models.general import User, Business, BusinessSettings
    from database.models.billing import BusinessSubscription, TokenWallet
    from database.models.entitlement import CommercialProfile
    import uuid

    all_modules = [
        "module_retail", "module_bible_translation", "module_estate", "module_hospital",
        "module_hotels", "module_nigeria_irs", "module_church", "module_government",
        "module_manufacturing", "module_education", "module_agriculture",
        "retail", "bible_translation", "estate", "hospital",
        "hotels", "nigeria_irs", "church", "government",
        "manufacturing", "education", "agriculture"
    ]
    
    master_bid = "0bbd48c4-b066-435a-be3d-c095b55897c6"
    hq_bids = [master_bid, "INTERAC_HQ"]

    async with AsyncSessionLocal() as session:
        try:
            # 1. Ensure master businesses exist
            for bid in hq_bids:
                biz = await session.get(Business, bid)
                name = "interacAi" if bid == master_bid else "InteracAI System"
                if not biz:
                    biz = Business(id=bid, name=name, is_deleted=False)
                    session.add(biz)
                else:
                    biz.name = name
                    biz.is_deleted = False
                    session.add(biz)
            await session.flush()

            # 2. Master platform credentials
            pwd_hash = get_password_hash("Setecs@55")

            # 2a. interacai.int@gmail.com (Platform HQ Owner & Master Test Account)
            u_stmt = select(User).where(User.email == "interacai.int@gmail.com")
            u_res = await session.execute(u_stmt)
            hq_users = u_res.scalars().all()
            if hq_users:
                hq_user = hq_users[0]
                hq_user.business_id = master_bid
                hq_user.password_hash = pwd_hash
                hq_user.role = "owner"
                hq_user.department = "general"
                hq_user.status = "active"
                hq_user.email_verified = True
                session.add(hq_user)
                for dup in hq_users[1:]:
                    await session.delete(dup)
            else:
                hq_user = User(
                    id="6637d297-b771-4ac4-ac03-694c7a538d42",
                    business_id=master_bid,
                    email="interacai.int@gmail.com",
                    password_hash=pwd_hash,
                    role="owner",
                    department="general",
                    status="active",
                    email_verified=True
                )
                session.add(hq_user)

            # 2b. mbasitisylva@gmail.com (Super Admin)
            sa_stmt = select(User).where(User.email == "mbasitisylva@gmail.com")
            sa_res = await session.execute(sa_stmt)
            sa_users = sa_res.scalars().all()
            if sa_users:
                sa_user = sa_users[0]
                sa_user.business_id = master_bid
                sa_user.password_hash = pwd_hash
                sa_user.role = "super_admin"
                sa_user.department = "general"
                sa_user.status = "active"
                sa_user.email_verified = True
                session.add(sa_user)
                for dup in sa_users[1:]:
                    await session.delete(dup)
            else:
                sa_user = User(
                    id=str(uuid.uuid4()),
                    business_id=master_bid,
                    email="mbasitisylva@gmail.com",
                    password_hash=pwd_hash,
                    role="super_admin",
                    department="general",
                    status="active",
                    email_verified=True
                )
                session.add(sa_user)

            # Commit users immediately
            await session.commit()

            # 3. Ensure Enterprise Subscriptions for both HQ bids
            for bid in hq_bids:
                sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == bid)
                sub_res = await session.execute(sub_stmt)
                sub = sub_res.scalar_one_or_none()
                if not sub:
                    sub = BusinessSubscription(business_id=bid, plan_id="enterprise", status="active", conversation_limit=-1)
                    session.add(sub)
                else:
                    sub.plan_id = "enterprise"
                    sub.status = "active"
                    sub.conversation_limit = -1
                    session.add(sub)

            # 4. Token Wallets
            for bid in hq_bids:
                wallet = await session.get(TokenWallet, bid)
                if not wallet:
                    wallet = TokenWallet(business_id=bid, sub_balance=10000000, payg_balance=1000000, status="active")
                    session.add(wallet)
                else:
                    wallet.sub_balance = max(wallet.sub_balance or 0, 10000000)
                    wallet.status = "active"
                    session.add(wallet)

            # 5. Settings with all industry modules pre-installed
            for bid in hq_bids:
                set_stmt = select(BusinessSettings).where(BusinessSettings.business_id == bid)
                set_res = await session.execute(set_stmt)
                settings = set_res.scalar_one_or_none()
                if not settings:
                    settings = BusinessSettings(
                        business_id=bid,
                        description="InteracAI Platform Master Operations and Testing HQ",
                        tone="professional",
                        installed_modules=all_modules
                    )
                    session.add(settings)
                else:
                    settings.installed_modules = all_modules
                    session.add(settings)

            # 6. Commercial Profile
            for bid in hq_bids:
                cp_stmt = select(CommercialProfile).where(CommercialProfile.business_id == bid)
                cp_res = await session.execute(cp_stmt)
                cp = cp_res.scalar_one_or_none()
                if not cp:
                    cp = CommercialProfile(
                        business_id=bid,
                        commercial_status="customer_active",
                        billing_interval="lifetime",
                        account_manager_name="Victor Sylva"
                    )
                    session.add(cp)
                else:
                    cp.commercial_status = "customer_active"
                    cp.billing_interval = "lifetime"
                    session.add(cp)

            await session.commit()
            print("Master Platform Accounts and Enterprise Subscriptions verified successfully.")
        except Exception as seed_err:
            print(f"Error seeding master platform accounts: {seed_err}")
            await session.rollback()

    # Pre-register and install all industry modules across platform registries
    try:
        from modules.loader import load_all_industry_modules
        await load_all_industry_modules(default_org_id=master_bid)
        print("Industry starter modules initialized and pre-installed for master accounts.")
    except Exception as mod_err:
        print(f"Warning: Industry module loader notice: {mod_err}")

def main():
    print("--- InteracAI Custom Startup Script ---")
    
    # 1. Initialize tables & check if alembic_version exists
    has_alembic = asyncio.run(init_db())
    
    # 2. Run Alembic stamp or upgrade as a subprocess to avoid event loop conflicts
    if not has_alembic:
        print("Fresh database detected. Stamping Alembic head (marking schema as up to date)...")
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

    # 4. Ensure Master Platform HQ Account & Industry Modules exist
    asyncio.run(seed_platform_hq())

if __name__ == "__main__":
    main()
