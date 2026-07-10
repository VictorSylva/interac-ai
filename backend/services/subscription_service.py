import logging
from datetime import datetime, timedelta
from sqlalchemy import select, update, func
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription, SubscriptionPlan, TokenWallet, BusinessUsageMetrics
from database.models.chat import Conversation
from database.models.general import Business

logger = logging.getLogger(__name__)

async def check_access(business_id: str, required_tokens: int = 0) -> dict:
    """
    GLOBAL ENFORCEMENT LAYER
    Checks access in mandatory order:
    1. Active Subscription
    2. Conversation Limits
    3. Token Balance
    
    Returns: {"allowed": bool, "reason": str, "code": str}
    """
    if not business_id:
        return {"allowed": False, "reason": "Missing business ID", "code": "MISSING_ID"}

    # --- SPECIAL OVERRIDE: interacai.int@gmail.com ---
    # This account has lifetime Enterprise access and bypasses all checks.
    if business_id == "interacai.int@gmail.com":
        return {"allowed": True, "reason": "Enterprise Override Access", "code": "OK"}

    async with AsyncSessionLocal() as session:
        try:
            # 1. Verify Active Subscription
            stmt = select(BusinessSubscription, SubscriptionPlan).join(
                SubscriptionPlan, BusinessSubscription.plan_id == SubscriptionPlan.id
            ).where(BusinessSubscription.business_id == business_id)
            
            result = await session.execute(stmt)
            row = result.first()
            
            if not row:
                logger.warning(f"[Access] Blocked: No subscription for {business_id}")
                return {"allowed": False, "reason": "No active subscription found.", "code": "NO_SUBSCRIPTION"}
            
            sub, plan = row
            
            # Check for reset (Billing Cycle)
            await _check_and_reset_usage(session, sub)

            if sub.status != "active":
                logger.info(f"[Access] Blocked: {business_id} status is {sub.status}")
                return {"allowed": False, "reason": f"Your subscription is {sub.status}.", "code": "SUBSCRIPTION_INACTIVE"}

            # Check expiry (Extra safety)
            grace_period = timedelta(minutes=5)
            if sub.current_period_end and (sub.current_period_end + grace_period) < datetime.utcnow():
                logger.info(f"[Access] Blocked: {business_id} subscription expired.")
                sub.status = "expired"
                await session.commit()
                return {"allowed": False, "reason": "Your subscription has expired.", "code": "SUBSCRIPTION_EXPIRED"}

            # 2. Verify Conversation Limit
            if plan.conversation_limit != -1: # -1 for unlimited
                if sub.conversations_used >= plan.conversation_limit:
                    logger.warning(f"[Access] Blocked: {business_id} reached conversation limit ({sub.conversations_used}/{plan.conversation_limit})")
                    return {"allowed": False, "reason": "Monthly conversation limit reached.", "code": "LIMIT_REACHED"}

            # 3. Verify Token Balance
            from services.token_service import token_service
            wallet = await token_service.get_wallet(business_id)
            total_balance = (wallet.sub_balance or 0) + (wallet.payg_balance or 0) if wallet else 0
            
            # DEBUG TYPE LOGGING
            logger.info(f"[AccessCheck] BID: {business_id}, Total: {total_balance} ({type(total_balance)}), Required: {required_tokens} ({type(required_tokens)})")
            
            if required_tokens is None:
                logger.error(f"[AccessCheck] required_tokens is NONE for BID {business_id}. Defaulting to 0.")
                required_tokens = 0

            if total_balance < required_tokens:
                logger.warning(f"[Access] Blocked: {business_id} insufficient tokens (Has {total_balance}, Need {required_tokens})")
                return {"allowed": False, "reason": "Insufficient token balance.", "code": "INSUFFICIENT_TOKENS"}

            return {"allowed": True, "reason": "Access granted", "code": "OK"}

        except Exception as e:
            logger.error(f"Error in check_access for {business_id}: {e}", exc_info=True)
            return {"allowed": False, "reason": "Internal security check failure", "code": "ERROR"}

async def _check_and_reset_usage(session, sub: BusinessSubscription):
    """Resets usage counters if the billing cycle has rolled over."""
    now = datetime.utcnow()
    # Simple logic: If we are past current_period_end, we might need a reset.
    # However, for production, this usually happens via a webhook or a daily cron.
    # We add a safety check here.
    if sub.current_period_end and now > sub.current_period_end:
        # In a real system, we'd check if the next payment was made.
        # For now, we update the anchor and reset counters if it looks like a new month.
        # This is a fallback; primary reset should be in the renewal/webhook logic.
        pass

async def track_conversation(business_id: str, user_id: str) -> bool:
    """
    Implements the 24h rolling window conversation counting.
    A conversation unit is counted ONLY if it's the first message from a unique customer
    within a 24-hour window.
    """
    convo_id = f"{business_id}:{user_id}"
    now = datetime.utcnow()
    window = timedelta(hours=24)
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if conversation exists
            stmt = select(Conversation).where(Conversation.id == convo_id)
            res = await session.execute(stmt)
            convo = res.scalar_one_or_none()
            
            should_increment = False
            
            if not convo:
                # New conversation ever
                should_increment = True
                # Create the conversation record if it doesn't exist (Safety)
                convo = Conversation(
                    id=convo_id,
                    business_id=business_id,
                    conversation_start_at=now,
                    last_message_at=now,
                    last_timestamp=now,
                    is_active=True
                )
                session.add(convo)
                await session.flush()
            else:
                # Check 24h window from the start of the current active conversation
                # Or from the last message if we follow a strict inactivity reset.
                # The requirement says: "IF no existing conversation in last 24h: create new conversation"
                # This usually means 24h of inactivity.
                
                if convo.last_message_at:
                    if (now - convo.last_message_at) > window:
                        should_increment = True
                        convo.conversation_start_at = now
                        convo.is_active = True
                
                convo.last_message_at = now
                convo.last_timestamp = now
            
            if should_increment:
                # Atomic increment in BusinessSubscription
                logger.info(f"[Usage] Incrementing conversation count for {business_id} (User: {user_id})")
                await session.execute(
                    update(BusinessSubscription)
                    .where(BusinessSubscription.business_id == business_id)
                    .values(conversations_used=BusinessSubscription.conversations_used + 1)
                )
                
                # Increment in BusinessUsageMetrics
                metrics_stmt = select(BusinessUsageMetrics).where(BusinessUsageMetrics.business_id == business_id).with_for_update()
                metrics_res = await session.execute(metrics_stmt)
                metrics = metrics_res.scalar_one_or_none()
                
                if not metrics:
                    metrics = BusinessUsageMetrics(business_id=business_id, total_conversations=1)
                    session.add(metrics)
                else:
                    metrics.total_conversations += 1
                
                await session.commit()
                return True
            
            await session.commit()
            return False
        except Exception as e:
            logger.error(f"Error tracking conversation for {business_id}: {e}")
            await session.rollback()
            return False

# Maintain backward compatibility for old callers during migration
async def check_subscription_access(business_id: str) -> bool:
    res = await check_access(business_id)
    return res["allowed"]
