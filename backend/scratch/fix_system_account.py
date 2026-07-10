import asyncio
import os
import sys
from datetime import datetime, timedelta

# Set up paths
backend_path = os.path.join(os.getcwd(), 'backend')
sys.path.append(backend_path)

from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription, TokenWallet
from sqlalchemy import select, update

async def fix_system_account():
    biz_id = "interac_hq"
    print(f"Fixing system account: {biz_id}")
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Update Subscription
            stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == biz_id)
            res = await session.execute(stmt)
            sub = res.scalar_one_or_none()
            
            if sub:
                print(f"Updating existing subscription for {biz_id}")
                sub.status = "active"
                sub.plan_id = "pro"  # Set to highest available plan
                sub.billing_cycle_anchor = datetime.utcnow()
            else:
                print(f"Creating new active enterprise subscription for {biz_id}")
                new_sub = BusinessSubscription(
                    business_id=biz_id,
                    plan_id="pro",
                    status="active",
                    billing_cycle_anchor=datetime.utcnow()
                )
                session.add(new_sub)
            
            # 2. Ensure Token Wallet is healthy
            stmt_w = select(TokenWallet).where(TokenWallet.business_id == biz_id)
            res_w = await session.execute(stmt_w)
            wallet = res_w.scalar_one_or_none()
            
            if wallet:
                print(f"Top up tokens for system account")
                wallet.payg_balance = 1000000 # 1 Million tokens for system use
            else:
                print(f"Created new wallet for system account")
                new_wallet = TokenWallet(
                    business_id=biz_id,
                    payg_balance=1000000,
                    sub_balance=0
                )
                session.add(new_wallet)
                
            await session.commit()
            print(f"DONE: System account {biz_id} is now ACTIVE on Enterprise plan with 1M tokens.")
        except Exception as e:
            await session.rollback()
            print(f"ERROR: Error fixing system account: {e}")

if __name__ == "__main__":
    asyncio.run(fix_system_account())
