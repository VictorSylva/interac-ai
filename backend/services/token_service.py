import logging
from datetime import datetime, timedelta
from sqlalchemy import select, update, func
from database.session import AsyncSessionLocal
from database.models.billing import TokenWallet, TokenTransaction, BusinessUsageMetrics, BusinessSubscription, SubscriptionPlan
from database.models.general import Business

logger = logging.getLogger(__name__)

# Standardized Token Costs
TOKEN_COSTS = {
    "ai_inference_base": 100,
    "whatsapp_outbound": 50,
    "email_send": 20,
    "workflow_step": 10
}

class TokenService:
    @staticmethod
    async def get_wallet(business_id: str) -> TokenWallet:
        """
        Fetches the token wallet for a business.
        Internal services should call this after business_id resolution.
        """
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(TokenWallet).where(TokenWallet.business_id == business_id)
                result = await session.execute(stmt)
                wallet = result.scalar_one_or_none()
                
                if not wallet:
                    from database.models.entitlement import BusinessEntitlement
                    ent_stmt = select(BusinessEntitlement.numeric_limit).where(
                        BusinessEntitlement.business_id == business_id,
                        BusinessEntitlement.entitlement_key == "ai.tokens"
                    )
                    ent_res = await session.execute(ent_stmt)
                    ent_tokens = ent_res.scalar_one_or_none()
                    init_balance = int(ent_tokens) if ent_tokens is not None else 5000

                    logger.info(f"[TokenService] Initializing missing wallet for {business_id} with allowance {init_balance}")
                    wallet = TokenWallet(
                        business_id=business_id, 
                        sub_balance=init_balance, 
                        payg_balance=0,
                        status="active"
                    )
                    session.add(wallet)
                    await session.commit()
                    await session.refresh(wallet)

                return wallet
            except Exception as e:
                logger.error(f"[TokenService] Error fetching wallet for {business_id}: {e}")
                return None

    @staticmethod
    async def init_wallet(business_id: str) -> bool:
        """
        Explicit idempotent initialization of a wallet.
        Called during fulfillment or business onboarding.
        """
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(TokenWallet).where(TokenWallet.business_id == business_id)
                result = await session.execute(stmt)
                if not result.scalar_one_or_none():
                    wallet = TokenWallet(business_id=business_id, sub_balance=0, payg_balance=0)
                    session.add(wallet)
                    await session.commit()
                    logger.info(f"[TokenService] Wallet initialized for {business_id}")
                return True
            except Exception as e:
                logger.error(f"[TokenService] Initialization failed for {business_id}: {e}")
                return False

    @staticmethod
    async def check_balance(business_id: str, required_tokens: int) -> bool:
        """Checks if the business has enough tokens across both pools."""
        wallet = await TokenService.get_wallet(business_id)
        if not wallet:
            return False
            
        total_balance = (wallet.sub_balance or 0) + (wallet.payg_balance or 0)
        return total_balance >= required_tokens

    @staticmethod
    async def deduct_tokens(business_id: str, amount: int, action_type: str, metadata: dict = None) -> bool:
        """
        ATOMIC token deduction with multi-pool logic (Subscription -> PAYG).
        """
        if amount <= 0:
            return True

        async with AsyncSessionLocal() as session:
            try:
                # 1. Row-level lock the wallet
                stmt = select(TokenWallet).where(TokenWallet.business_id == business_id).with_for_update()
                result = await session.execute(stmt)
                wallet = result.scalar_one_or_none()

                if not wallet:
                    logger.warning(f"[TokenService] Deduction Fail: No wallet for {business_id}")
                    return False

                # Ensure no nulls
                current_sub = wallet.sub_balance or 0
                current_payg = wallet.payg_balance or 0
                total_available = current_sub + current_payg

                if total_available < amount:
                    logger.warning(f"[TokenService] Deduction Fail: Insufficient tokens for {business_id} (Need {amount}, Has {total_available})")
                    return False

                # 2. Consume from Subscription pool first
                sub_deduction = min(current_sub, amount)
                remaining_to_deduct = amount - sub_deduction
                
                # 3. Consume remaining from PAYG pool
                payg_deduction = remaining_to_deduct

                wallet.sub_balance = current_sub - sub_deduction
                wallet.payg_balance = current_payg - payg_deduction
                wallet.updated_at = datetime.utcnow()

                # 4. Audit Transactions
                if sub_deduction > 0:
                    session.add(TokenTransaction(
                        business_id=business_id,
                        amount=-sub_deduction,
                        token_pool='subscription',
                        action_type=action_type,
                        transaction_metadata=metadata or {}
                    ))
                
                if payg_deduction > 0:
                    session.add(TokenTransaction(
                        business_id=business_id,
                        amount=-payg_deduction,
                        token_pool='payg',
                        action_type=action_type,
                        transaction_metadata=metadata or {}
                    ))

                # 5. Update Usage Metrics (Asynchronous update in same session)
                await TokenService.update_usage_metrics(session, business_id, amount)
                
                await session.commit()
                logger.info(f"[TokenService] Deducted {amount} tokens from {business_id} ({action_type}) | Metrics updated.")
                return True

            except Exception as e:
                logger.error(f"[TokenService] Critical error during token deduction for {business_id}: {e}", exc_info=True)
                await session.rollback()
                return False

    @staticmethod
    async def refill_tokens(business_id: str, amount: int, pool: str = 'payg', action_type: str = 'refill', metadata: dict = None):
        """Adds tokens to a specific pool."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(TokenWallet).where(TokenWallet.business_id == business_id).with_for_update()
                result = await session.execute(stmt)
                wallet = result.scalar_one_or_none()

                if not wallet:
                    logger.info(f"[TokenService] Creating wallet during refill for {business_id}")
                    wallet = TokenWallet(business_id=business_id, sub_balance=0, payg_balance=0)
                    session.add(wallet)

                # Ensure no nulls before math
                if pool == 'subscription':
                    wallet.sub_balance = (wallet.sub_balance or 0) + amount
                else:
                    wallet.payg_balance = (wallet.payg_balance or 0) + amount
                
                wallet.last_refill_at = datetime.utcnow()
                wallet.updated_at = datetime.utcnow()
                
                session.add(TokenTransaction(
                    business_id=business_id,
                    amount=amount,
                    token_pool=pool,
                    action_type=action_type,
                    transaction_metadata=metadata or {}
                ))

                await session.commit()
                logger.info(f"[TokenService] Refilled {amount} tokens to {pool} pool for {business_id} ({action_type})")
                return True
            except Exception as e:
                logger.error(f"[TokenService] Error refilling tokens for {business_id}: {e}", exc_info=True)
                await session.rollback()
                return False

    @staticmethod
    async def get_transaction_history(business_id: str, limit: int = 50):
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(TokenTransaction).where(TokenTransaction.business_id == business_id).order_by(TokenTransaction.created_at.desc()).limit(limit)
                result = await session.execute(stmt)
                return result.scalars().all()
            except Exception as e:
                logger.error(f"[TokenService] Error fetching history for {business_id}: {e}")
                return []

    @staticmethod
    async def update_usage_metrics(session, business_id: str, tokens_used: int):
        """Updates the cost and profit metrics for a business."""
        from config import config
        COST_PER_TOKEN = float(config.COST_PER_TOKEN or 0.001)

        try:
            # 1. Fetch or Initialize Metrics
            stmt = select(BusinessUsageMetrics).where(BusinessUsageMetrics.business_id == business_id).with_for_update()
            result = await session.execute(stmt)
            metrics = result.scalar_one_or_none()

            if not metrics:
                metrics = BusinessUsageMetrics(business_id=business_id)
                session.add(metrics)
                await session.flush()

            # 2. Update Token Usage & Cost
            metrics.total_tokens_used += tokens_used
            metrics.estimated_cost = metrics.total_tokens_used * COST_PER_TOKEN

            # 3. Calculate Profit (Sub Price - Cost)
            # Fetch active subscription price
            sub_stmt = select(SubscriptionPlan).join(
                BusinessSubscription, BusinessSubscription.plan_id == SubscriptionPlan.id
            ).where(BusinessSubscription.business_id == business_id, BusinessSubscription.status == 'active')
            
            sub_result = await session.execute(sub_stmt)
            plan = sub_result.scalar_one_or_none()
            
            sub_price = plan.price if plan and plan.price else 0.0
            metrics.estimated_profit = sub_price - metrics.estimated_cost
            metrics.updated_at = datetime.utcnow()

            logger.info(f"[TokenService] Metrics pending update for {business_id}: Cost={metrics.estimated_cost}, Profit={metrics.estimated_profit}")
        except Exception as e:
            logger.error(f"[TokenService] Failed to update metrics for {business_id}: {e}")
            raise # Re-raise to trigger rollback in caller

    @staticmethod
    async def get_usage_summary(business_id: str):
        """Fetches the usage metrics summary for a business."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(BusinessUsageMetrics).where(BusinessUsageMetrics.business_id == business_id)
                result = await session.execute(stmt)
                metrics = result.scalar_one_or_none()
                
                if not metrics:
                    return {
                        "total_tokens_used": 0,
                        "total_conversations": 0,
                        "estimated_cost": 0.0,
                        "estimated_profit": 0.0
                    }
                
                return {
                    "total_tokens_used": metrics.total_tokens_used,
                    "total_conversations": metrics.total_conversations,
                    "estimated_cost": metrics.estimated_cost,
                    "estimated_profit": metrics.estimated_profit,
                    "updated_at": metrics.updated_at
                }
            except Exception as e:
                logger.error(f"[TokenService] Error fetching usage summary for {business_id}: {e}")
                return None

token_service = TokenService()
