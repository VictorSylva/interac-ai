from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription, TokenWallet, SubscriptionPlan, TokenTransaction
from database.models.payment import PaymentTransaction
from database.models.general import Business
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/billing/{business_id}")
async def inspect_billing(business_id: str):
    """
    Internal observability endpoint to inspect the billing state of a business.
    """
    async with AsyncSessionLocal() as session:
        try:
            # 1. Fetch Subscription
            stmt = select(BusinessSubscription, SubscriptionPlan).join(
                SubscriptionPlan, BusinessSubscription.plan_id == SubscriptionPlan.id
            ).where(BusinessSubscription.business_id == business_id)
            sub_res = await session.execute(stmt)
            sub_data = sub_res.first()
            
            # 2. Fetch Wallet
            wallet_stmt = select(TokenWallet).where(TokenWallet.business_id == business_id)
            wallet_res = await session.execute(wallet_stmt)
            wallet = wallet_res.scalar_one_or_none()
            
            # 3. Recent Transactions
            tx_stmt = select(PaymentTransaction).where(PaymentTransaction.business_id == business_id).order_by(PaymentTransaction.created_at.desc()).limit(5)
            tx_res = await session.execute(tx_stmt)
            recent_payments = [
                {
                    "reference": tx.reference,
                    "amount": tx.amount,
                    "status": tx.status,
                    "created_at": tx.created_at
                } for tx in tx_res.scalars().all()
            ]
            
            # 4. Recent Token History
            token_tx_stmt = select(TokenTransaction).where(TokenTransaction.business_id == business_id).order_by(TokenTransaction.created_at.desc()).limit(5)
            token_tx_res = await session.execute(token_tx_stmt)
            recent_tokens = [
                {
                    "amount": t.amount,
                    "pool": t.token_pool,
                    "action": t.action_type,
                    "created_at": t.created_at
                } for t in token_tx_res.scalars().all()
            ]

            return {
                "business_id": business_id,
                "subscription": {
                    "plan": sub_data[1].name if sub_data else None,
                    "status": sub_data[0].status if sub_data else "none",
                    "conversations_used": sub_data[0].conversations_used if sub_data else 0,
                    "conversation_limit": sub_data[1].conversation_limit if sub_data else 0,
                    "period_end": sub_data[0].current_period_end if sub_data else None
                } if sub_data else None,
                "wallet": {
                    "sub_balance": wallet.sub_balance if wallet else 0,
                    "payg_balance": wallet.payg_balance if wallet else 0,
                    "status": wallet.status if wallet else "none"
                } if wallet else None,
                "recent_payments": recent_payments,
                "recent_token_history": recent_tokens
            }
        except Exception as e:
            logger.error(f"Error inspecting billing for {business_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-quota/{business_id}")
async def sync_quota(business_id: str):
    """
    Force syncs a business's token balance to their current plan's allocation.
    Useful for fixing accounts that were provisioned with incorrect old plan data.
    """
    from services.db_service import resolve_business_id
    from database.models.billing import BusinessSubscription, SubscriptionPlan, TokenWallet
    
    async with AsyncSessionLocal() as session:
        try:
            real_bid = await resolve_business_id(business_id)
            
            # 1. Get current sub
            stmt = select(BusinessSubscription, SubscriptionPlan).join(
                SubscriptionPlan, BusinessSubscription.plan_id == SubscriptionPlan.id
            ).where(BusinessSubscription.business_id == real_bid)
            res = await session.execute(stmt)
            data = res.first()
            
            if not data:
                raise HTTPException(status_code=404, detail="No active subscription found")
                
            plan = data[1]
            
            # 2. Reset balance to plan allocation
            wallet_stmt = select(TokenWallet).where(TokenWallet.business_id == real_bid)
            wallet_res = await session.execute(wallet_stmt)
            wallet = wallet_res.scalar_one_or_none()
            
            if wallet:
                old_balance = wallet.sub_balance
                wallet.sub_balance = plan.token_allocation
                await session.commit()
                return {"status": "success", "old_balance": old_balance, "new_balance": plan.token_allocation}
            else:
                raise HTTPException(status_code=404, detail="Wallet not found")
        except Exception as e:
            logger.error(f"Error syncing quota for {business_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
