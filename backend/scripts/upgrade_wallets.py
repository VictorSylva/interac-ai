import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal
from database.models.billing import TokenWallet, BusinessSubscription, SubscriptionPlan
from sqlalchemy import select, update

async def upgrade_wallets():
    async with AsyncSessionLocal() as session:
        # Get all subscriptions
        stmt = select(BusinessSubscription, SubscriptionPlan).join(SubscriptionPlan, BusinessSubscription.plan_id == SubscriptionPlan.id)
        result = await session.execute(stmt)
        subscriptions = result.all()
        
        print(f"Found {len(subscriptions)} subscriptions to check.")
        
        for sub, plan in subscriptions:
            # Update wallet to match plan allocation if it's lower (one-time sync)
            wallet_stmt = select(TokenWallet).where(TokenWallet.business_id == sub.business_id)
            wallet_res = await session.execute(wallet_stmt)
            wallet = wallet_res.scalar_one_or_none()
            
            if wallet:
                print(f"Business: {sub.business_id} | Plan: {plan.id} | Current: {wallet.sub_balance} | New Target: {plan.token_allocation}")
                # For this migration, we'll top up their subscription balance to the new plan level
                if wallet.sub_balance < plan.token_allocation:
                    wallet.sub_balance = plan.token_allocation
                    print(f"  --> Upgraded {sub.business_id} to {plan.token_allocation} tokens.")
        
        await session.commit()
        print("Wallet upgrade complete.")

if __name__ == "__main__":
    asyncio.run(upgrade_wallets())
