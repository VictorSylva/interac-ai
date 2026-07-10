import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription, TokenWallet, SubscriptionPlan, TokenTransaction
from database.models.general import Business, BusinessSettings
from sqlalchemy import select, delete

async def cleanup_and_grant():
    async with AsyncSessionLocal() as session:
        # 1. Ensure Plans
        print("Ensuring plans...")
        plan_stmt = select(SubscriptionPlan).where(SubscriptionPlan.id == 'enterprise')
        if not (await session.execute(plan_stmt)).scalar_one_or_none():
            session.add(SubscriptionPlan(id='enterprise', name='Enterprise Lifetime', price=0.0, token_allocation=1000000, conversation_limit=-1))
            await session.commit()

        # 2. Delete the lowercase 'interac_hq' to avoid confusion (Keep uppercase)
        print("Cleaning up duplicate HQ...")
        # Order matters for foreign keys
        target_dup = 'interac_hq'
        await session.execute(delete(TokenTransaction).where(TokenTransaction.business_id == target_dup))
        await session.execute(delete(TokenWallet).where(TokenWallet.business_id == target_dup))
        await session.execute(delete(BusinessSubscription).where(BusinessSubscription.business_id == target_dup))
        await session.execute(delete(BusinessSettings).where(BusinessSettings.business_id == target_dup))
        await session.execute(delete(Business).where(Business.id == target_dup))

        # 3. Grant to correct IDs
        target_ids = ['0bbd48c4-b066-435a-be3d-c095b55897c6', 'INTERAC_HQ']
        for bid in target_ids:
            print(f"Granting to {bid}...")
            # Sub
            sub_res = await session.execute(select(BusinessSubscription).where(BusinessSubscription.business_id == bid))
            sub = sub_res.scalar_one_or_none()
            if not sub:
                sub = BusinessSubscription(business_id=bid)
                session.add(sub)
            sub.status = 'active'
            sub.plan_id = 'enterprise'
            
            # Wallet
            wall_res = await session.execute(select(TokenWallet).where(TokenWallet.business_id == bid))
            wall = wall_res.scalar_one_or_none()
            if not wall:
                wall = TokenWallet(business_id=bid)
                session.add(wall)
            wall.sub_balance = 1000000
            
            # Business Sync
            biz_res = await session.execute(select(Business).where(Business.id == bid))
            biz = biz_res.scalar_one_or_none()
            if biz:
                biz.plan_id = 'enterprise'
                biz.subscription_status = 'active'

        await session.commit()
        print("Cleanup and Grant complete.")

if __name__ == "__main__":
    asyncio.run(cleanup_and_grant())
