from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel
from typing import List, Optional
import logging
from datetime import datetime, timedelta
from database.session import AsyncSessionLocal
from database.models.general import Business
from sqlalchemy import select, update
from services.payment_service import initialize_paystack_transaction, verify_paystack_webhook, verify_paystack_transaction
from services.db_service import resolve_business_id, get_business_profile
from services.token_service import token_service
from database.models.billing import BusinessSubscription, SubscriptionPlan, TokenWallet
from database.models.payment import PaymentTransaction
import os
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

async def process_subscription_fulfillment(session, business_id: str, plan_id: str, reference: str, amount: float = 0):
    """
    Refined provisioning logic with IDEMPOTENCY and single source of truth.
    """
    logger.info(f"[Fulfillment] Starting fulfillment for {business_id} (Ref: {reference})")
    
    # 1. Idempotency Check (Double Check inside transaction)
    stmt = select(PaymentTransaction).where(PaymentTransaction.reference == reference).with_for_update()
    res = await session.execute(stmt)
    tx = res.scalar_one_or_none()
    
    if tx and tx.status == "success":
        logger.warning(f"[Fulfillment] Reference {reference} already fulfilled. Skipping.")
        return {"status": "already_fulfilled", "business_id": business_id}

    # 2. Resolve Business
    real_business_id = await resolve_business_id(business_id)
    now = datetime.utcnow()
    
    # 3. Update PaymentTransaction
    if not tx:
        tx = PaymentTransaction(
            id=str(uuid.uuid4()),
            business_id=real_business_id,
            reference=reference,
            amount=amount,
            status="success",
            created_at=now
        )
        session.add(tx)
    else:
        tx.status = "success"
    
    # 4. Fetch Plan
    plan_stmt = select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    plan_res = await session.execute(plan_stmt)
    plan = plan_res.scalar_one_or_none()
    
    if not plan:
        logger.error(f"[Fulfillment] Plan {plan_id} not found in DB!")
        raise ValueError(f"Plan {plan_id} not found")

    # 5. Update BusinessSubscription (Single Source of Truth)
    sub_stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == real_business_id).with_for_update()
    sub_res = await session.execute(sub_stmt)
    sub = sub_res.scalar_one_or_none()
    
    duration_days = 30 # Default
    end_date = now + timedelta(days=duration_days)
    
    if not sub:
        logger.info(f"[Fulfillment] Creating new subscription for {real_business_id}")
        sub = BusinessSubscription(
            business_id=real_business_id,
            plan_id=plan_id,
            status="active",
            current_period_start=now,
            current_period_end=end_date,
            billing_cycle_anchor=now,
            conversations_used=0
        )
        session.add(sub)
    else:
        logger.info(f"[Fulfillment] Renewing subscription for {real_business_id}")
        # If current period hasn't ended, extend it
        if sub.current_period_end and sub.current_period_end > now:
            sub.current_period_end += timedelta(days=duration_days)
        else:
            sub.current_period_end = now + timedelta(days=duration_days)
            sub.current_period_start = now
        
        sub.plan_id = plan_id
        sub.status = "active"
        sub.conversations_used = 0 # Reset on renewal
        sub.billing_cycle_anchor = now
    
    # 6. Legacy Sync (Ensure Business table is updated until migration is complete)
    # This is temporary and will be removed after Step 5 (Migration Cleanup)
    biz_stmt = select(Business).where(Business.id == real_business_id)
    biz_res = await session.execute(biz_stmt)
    business = biz_res.scalar_one_or_none()
    if business:
        business.plan_name = plan_id
        business.status = "active"
        business.subscription_end_at = sub.current_period_end

    # 7. Token Refill (subscription pool)
    logger.info(f"[Fulfillment] Crediting {plan.token_allocation} tokens to {real_business_id}")
    await token_service.refill_tokens(
        real_business_id, 
        plan.token_allocation, 
        pool='subscription', 
        action_type='subscription_refill',
        metadata={"reference": reference, "plan": plan_id}
    )

    await session.commit()
    logger.info(f"[Fulfillment] SUCCESS for {real_business_id} (Plan: {plan_id})")
    return {"status": "success", "business_id": real_business_id, "new_end": sub.current_period_end}

@router.get("/plans")
async def get_plans():
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(SubscriptionPlan)
            result = await session.execute(stmt)
            db_plans = result.scalars().all()
            return [
                {
                    "id": p.id,
                    "name": p.name,
                    "price": p.price,
                    "token_allocation": p.token_allocation,
                    "conversation_limit": p.conversation_limit,
                    "is_public": p.is_public,
                    "requires_contact": p.requires_contact,
                    "currency": "NGN",
                    "interval": "monthly"
                } for p in db_plans
            ]
        except Exception as e:
            logger.error(f"Error fetching plans: {e}")
            raise HTTPException(status_code=500, detail="Could not fetch plans")

class SubscriptionInitRequest(BaseModel):
    plan_id: str
    business_id: str
    email: str

@router.post("/initialize")
async def initialize_subscription(req: SubscriptionInitRequest, request: Request):
    async with AsyncSessionLocal() as session:
        # Resolve Plan
        stmt = select(SubscriptionPlan).where(SubscriptionPlan.id == req.plan_id)
        res = await session.execute(stmt)
        plan = res.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan selected")
        
        if not plan.is_public:
            logger.warning(f"[Subscription] Attempted purchase of non-public plan: {req.plan_id} by {req.business_id}")
            raise HTTPException(status_code=400, detail="This plan is not available for public purchase. Please contact sales.")

        real_business_id = await resolve_business_id(req.business_id)
        reference = f"SUB_{req.plan_id}_{real_business_id}_{int(datetime.utcnow().timestamp())}"
        
        # 1. Create Pending Transaction record
        tx = PaymentTransaction(
            id=str(uuid.uuid4()),
            business_id=real_business_id,
            reference=reference,
            amount=plan.price,
            status="pending"
        )
        session.add(tx)
        await session.commit()

        metadata = {
            "type": "platform_subscription",
            "business_id": real_business_id,
            "plan_id": req.plan_id,
            "duration_days": 30
        }

        from config import config
        # Dynamically determine frontend URL from Origin header if available, fallback to config
        origin = request.headers.get("origin")
        base_url = origin if origin else config.FRONTEND_URL
        callback_url = f"{base_url}/dashboard/subscription?status=success&reference={reference}"
        
        auth_url = await initialize_paystack_transaction(
            email=req.email,
            amount=plan.price,
            reference=reference,
            callback_url=callback_url,
            metadata=metadata
        )

        if not auth_url:
            raise HTTPException(status_code=500, detail="Paystack initialization failed")

        return {"status": "success", "authorization_url": auth_url, "reference": reference}

@router.get("/verify/{reference}")
async def verify_subscription(reference: str):
    """Local fallback / Manual verification."""
    logger.info(f"[Verify] Manual verification for {reference}")
    res_wrapper = await verify_paystack_transaction(reference)
    
    if not res_wrapper or not res_wrapper.get("status"):
         raise HTTPException(status_code=400, detail="Verification failed")
         
    data = res_wrapper.get("data", {})
    if data.get("status") != "success":
         raise HTTPException(status_code=400, detail=f"Transaction is {data.get('status')}")

    meta = data.get("metadata", {})
    if meta.get("type") != "platform_subscription":
        return {"status": "ignored", "message": "Not a platform subscription"}

    business_id = meta.get("business_id")
    plan_id = meta.get("plan_id")
    amount = data.get("amount", 0) / 100 # Paystack is in kobo/cents

    async with AsyncSessionLocal() as session:
        try:
            return await process_subscription_fulfillment(session, business_id, plan_id, reference, amount)
        except Exception as e:
            logger.error(f"[Verify] Fulfillment error: {e}")
            await session.rollback()
            raise HTTPException(status_code=500, detail="Fulfillment failed")

@router.post("/webhook")
async def paystack_webhook(request: Request, x_paystack_signature: str = Header(None)):
    payload = await request.body()
    
    if not verify_paystack_webhook(payload, x_paystack_signature):
        logger.warning("[Webhook] Invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    data = await request.json()
    event = data.get("event")
    
    if event == "charge.success":
        tx_data = data.get("data", {})
        meta = tx_data.get("metadata", {})
        reference = tx_data.get("reference")
        amount = tx_data.get("amount", 0) / 100
        
        logger.info(f"[Webhook] Success event for {reference}")
        
        if meta.get("type") == "platform_subscription":
            business_id = meta.get("business_id")
            plan_id = meta.get("plan_id")
            
            async with AsyncSessionLocal() as session:
                try:
                    await process_subscription_fulfillment(session, business_id, plan_id, reference, amount)
                except Exception as e:
                    logger.error(f"[Webhook] Fulfillment Fail: {e}")
                    await session.rollback()

        elif meta.get("type") == "payg_token_purchase":
            business_id = meta.get("business_id")
            tokens = meta.get("amount_tokens", 0)
            real_business_id = await resolve_business_id(business_id)
            
            # Idempotency for PAYG too
            async with AsyncSessionLocal() as session:
                stmt = select(PaymentTransaction).where(PaymentTransaction.reference == reference)
                res = await session.execute(stmt)
                if res.scalar_one_or_none():
                    logger.warning(f"[Webhook] PAYG Ref {reference} already processed.")
                    return {"status": "received"}

                tx = PaymentTransaction(
                    id=str(uuid.uuid4()),
                    business_id=real_business_id,
                    reference=reference,
                    amount=amount,
                    status="success"
                )
                session.add(tx)
                
                await token_service.refill_tokens(
                    real_business_id, 
                    tokens, 
                    pool='payg', 
                    action_type='payg_purchase',
                    metadata={"reference": reference}
                )
                await session.commit()
                logger.info(f"[Webhook] PAYG Success for {real_business_id}: {tokens} tokens")

                # Emit observation to argus-core
                try:
                    from services.argus_core_client import emit_observation
                    import asyncio
                    asyncio.create_task(
                        emit_observation(
                            source_system="payments",
                            entity_type="payment",
                            entity_id=reference,
                            confidence=1.0,
                            metadata={
                                "amount": float(amount) if amount else 0.0,
                                "business_id": real_business_id,
                                "reference": reference,
                                "tokens_purchased": tokens,
                                "type": "payg_token_purchase"
                            },
                            context=f"PAYG tokens purchased: {tokens} tokens for business {real_business_id}",
                            severity="info"
                        )
                    )
                except Exception as obs_err:
                    logger.warning(f"Error initiating observation emission for PAYG token purchase: {obs_err}")

    return {"status": "received"}
