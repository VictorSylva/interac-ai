
import asyncio
import httpx
from database.session import AsyncSessionLocal
from database.models.general import Business, BusinessEmailConfig, BusinessSettings, User
from database.models.workflow import Workflow
from database.models.scheduling import AppointmentType, AvailabilityRule
from database.models.billing import SubscriptionPlan, BusinessSubscription, TokenWallet
from sqlalchemy import select
from datetime import datetime, timedelta

PROD_API_URL = "https://interact-backend-pcex.onrender.com"
ADMIN_KEY = "interact_secret_2026"

# TARGETS
TARGET_BUSINESS_IDS = ["0bbd48c4-b066-435a-be3d-c095b55897c6", "INTERAC_HQ"]
TARGET_USER_EMAILS = ["interacai.int@gmail.com", "mbasitisylva@gmail.com"]

def model_to_dict(obj):
    if not obj: return None
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for k, v in d.items():
        if v and not isinstance(v, (str, int, float, bool, dict, list)):
            d[k] = str(v)
    return d

async def export_selected_data():
    async with AsyncSessionLocal() as session:
        # 1. Businesses
        res_biz = await session.execute(select(Business).where(Business.id.in_(TARGET_BUSINESS_IDS)))
        businesses = [model_to_dict(b) for b in res_biz.scalars().all()]
        
        # 2. Users
        res_usr = await session.execute(select(User).where(User.email.in_(TARGET_USER_EMAILS)))
        users = [model_to_dict(u) for u in res_usr.scalars().all()]
        
        # 3. Billing (IMPORTANT: PUSH ALL PLANS)
        res_plans = await session.execute(select(SubscriptionPlan))
        plans = [model_to_dict(p) for p in res_plans.scalars().all()]
        
        # Ensure Subscriptions and Wallets exist for targets
        subscriptions = []
        wallets = []
        
        for bid in TARGET_BUSINESS_IDS:
            # Subscription
            res_sub = await session.execute(select(BusinessSubscription).where(BusinessSubscription.business_id == bid))
            sub = res_sub.scalars().first()
            if sub:
                d = model_to_dict(sub)
                d['status'] = 'active' # Force active for migration
                # Ensure period is far in the future
                d['current_period_end'] = str(datetime.utcnow() + timedelta(days=365))
                subscriptions.append(d)
            
            # Wallet
            res_wal = await session.execute(select(TokenWallet).where(TokenWallet.business_id == bid))
            wal = res_wal.scalars().first()
            if wal:
                d = model_to_dict(wal)
                # Ensure healthy balance for the official accounts
                if d['sub_balance'] < 10000: d['sub_balance'] = 1000000
                wallets.append(d)

        # 4. Other Configs
        res_ec = await session.execute(select(BusinessEmailConfig).where(BusinessEmailConfig.business_id.in_(TARGET_BUSINESS_IDS)))
        email_configs = [model_to_dict(e) for e in res_ec.scalars().all()]
        
        res_bs = await session.execute(select(BusinessSettings).where(BusinessSettings.business_id.in_(TARGET_BUSINESS_IDS)))
        settings = [model_to_dict(s) for s in res_bs.scalars().all()]
        
        res_wf = await session.execute(select(Workflow).where(Workflow.business_id.in_(TARGET_BUSINESS_IDS)))
        workflows = [model_to_dict(w) for w in res_wf.scalars().all()]
        
        return {
            "businesses": businesses,
            "users": users,
            "plans": plans,
            "subscriptions": subscriptions,
            "wallets": wallets,
            "email_configs": email_configs,
            "settings": settings,
            "workflows": workflows
        }

async def sync_to_production():
    print("Exporting production-critical data...")
    data = await export_selected_data()
    
    payload = {
        "admin_key": ADMIN_KEY,
        **data
    }

    print(f"Syncing to {PROD_API_URL}...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{PROD_API_URL}/api/admin/seed-data",
                json=payload
            )
            print(f"Status: {response.status_code}")
            try:
                print(f"Response: {response.json()}")
            except:
                print(f"Response (text): {response.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(sync_to_production())
