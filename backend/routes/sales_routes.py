from fastapi import APIRouter, HTTPException, Depends, Request, Header
from typing import List, Optional
from pydantic import BaseModel
import logging
import json
from services.db_service import resolve_business_id, get_all_possible_business_ids
from database.session import AsyncSessionLocal
from sqlalchemy.future import select
from sqlalchemy import or_
from database.models.sales import SalesWebhookLog, Order, Delivery, Offer
from sqlalchemy.orm import selectinload

# Imports from new sales services
from services.sales_service import (
    create_offer, get_offers, get_offer_by_slug, save_sales_page, 
    get_sales_page, create_pending_order, process_successful_payment
)

from services.payment_service import (
    initialize_paystack_transaction, verify_paystack_webhook, verify_paystack_transaction
)

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Schemas ---
class OfferCreate(BaseModel):
    business_id: str
    title: str
    description: Optional[str] = None
    price: float
    currency: str = "USD"
    delivery_type: str = "link"
    slug: str
    content: Optional[dict] = {}
    ai_metadata: Optional[dict] = {}

class OfferUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[dict] = None
    ai_metadata: Optional[dict] = None
    business_id: Optional[str] = None # Added for compatibility with frontend send

class SalesPageCreate(BaseModel):
    business_id: str
    content: dict

class OrderCreateRequest(BaseModel):
    # This is when a user clicks 'Buy' on the public landing page
    # It requires the offer slug/id and their email.
    offer_id: int
    customer_email: str
    customer_phone: Optional[str] = None
    currency: str = "USD"
    callback_url: Optional[str] = None
    assessment_answers: Optional[dict] = {}

# --- Internal Dashboard Routes (/api/sales/*) ---

@router.post("/offers")
async def api_create_offer(data: OfferCreate):
    real_bid = await resolve_business_id(data.business_id)
    offer, error_msg = await create_offer(real_bid, data.dict(exclude={"business_id"}))
    if not offer:
        raise HTTPException(status_code=400, detail=error_msg or "Failed to create offer")
    return {"status": "success", "id": offer.id, "slug": offer.slug}

@router.get("/offers")
async def api_get_offers(business_id: str):
    possible_ids = await get_all_possible_business_ids(business_id)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Offer).options(selectinload(Offer.pages)).where(Offer.business_id.in_(possible_ids))
        )
        offers = result.scalars().all()
    
    return [
        {
            "id": o.id, "title": o.title, "price": o.price, 
            "currency": o.currency, "slug": o.slug, "is_active": o.is_active,
            "delivery_type": o.delivery_type, "description": o.description,
            "ai_metadata": o.ai_metadata,
            "content": o.pages.content if getattr(o, "pages", None) else {},
            "assessment_template": o.pages.assessment_template if getattr(o, "pages", None) else []
        } for o in offers
    ]

@router.put("/offers/{offer_id}")
async def api_update_offer(offer_id: int, data: OfferUpdate, request: Request):
    business_id = request.query_params.get("business_id")
    real_bid = await resolve_business_id(business_id)
    
    from services.sales_service import update_offer
    success = await update_offer(real_bid, offer_id, data.dict(exclude_unset=True))
    if not success:
         raise HTTPException(status_code=400, detail="Failed to update offer")
    return {"status": "success"}

@router.get("/orders")
async def api_get_orders(business_id: str):
    possible_ids = await get_all_possible_business_ids(business_id)
    
    async with AsyncSessionLocal() as session:
        try:
            # Query orders with related deliveries and offer
            stmt = select(Order).options(
                selectinload(Order.deliveries),
                selectinload(Order.offer)
            ).where(Order.business_id.in_(possible_ids)).order_by(Order.created_at.desc())
            
            result = await session.execute(stmt)
            orders = result.scalars().all()
            
            return [
                {
                    "id": o.id, 
                    "amount": o.amount, 
                    "currency": o.currency,
                    "status": o.status, 
                    "customer_email": o.customer_email,
                    "customer_phone": o.customer_phone,
                    "offer_title": o.offer.title if o.offer else "Deleted Offer",
                    "delivery_status": o.deliveries[0].status if o.deliveries else None,
                    "delivery_channel": o.deliveries[0].channel if o.deliveries else None,
                    "created_at": o.created_at
                } for o in orders
            ]
        except Exception as e:
            logger.error(f"Error fetching orders: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch orders")

@router.post("/offers/{offer_id}/page")
async def api_save_sales_page(offer_id: int, data: SalesPageCreate):
    real_bid = await resolve_business_id(data.business_id)
    success = await save_sales_page(real_bid, offer_id, data.content)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to save page")
    return {"status": "success"}

# --- Public Routes ---

@router.get("/public/verify/{reference}")
async def public_verify_transaction(reference: str):
    """
    Manually verify a transaction via reference (e.g., when the user returns from Paystack).
    Ensures 'Pending' orders are updated even if the webhook fails to reach the server.
    """
    from services.payment_service import verify_paystack_transaction
    
    # 1. Verify with Paystack
    res_wrapper = await verify_paystack_transaction(reference)
    
    # Paystack returns "status": True if the API call was successful
    if not res_wrapper or not res_wrapper.get("status"):
         raise HTTPException(status_code=400, detail="Payment verification API call failed")
         
    # The actual transaction status is inside data["data"]["status"]
    data = res_wrapper.get("data", {})
    if data.get("status") != "success":
         raise HTTPException(status_code=400, detail=f"Transaction is {data.get('status', 'pending')}")

    # 2. Process locally
    success, order, offer = await process_successful_payment(reference)
    if not success or not order or not offer:
         # It might already be paid, which is fine
         return {"status": "already_processed"}
         
    # 3. Trigger Workflow
    from services.workflow_engine import workflow_engine
    trigger_data = {
        "order_id": order.id,
        "amount": order.amount,
        "currency": order.currency,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "business_id": order.business_id,
        "reference": reference,
        "offer_slug": offer.slug,
        "offer_id": offer.id,
        "offer_title": offer.title,
        "user_id": order.customer_phone or order.customer_email,
        "from_number": order.customer_phone
    }
    logger.info(f"Verified payment {reference}. Triggering workflow.")
    await workflow_engine.trigger_workflow(order.business_id, "payment_received", trigger_data)
    
    return {"status": "success", "order_id": order.id}

@router.get("/public/{business_slug}/{offer_slug}")
async def public_get_offer_page(business_slug: str, offer_slug: str):
    # Wait, business_slug in DB is usually the manual business id.
    real_bid = await resolve_business_id(business_slug)
    
    offer = await get_offer_by_slug(real_bid, offer_slug)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    page = await get_sales_page(real_bid, offer.id)
    
    return {
        "offer": {
            "id": offer.id,
            "title": offer.title,
            "description": offer.description,
            "price": offer.price,
            "currency": offer.currency
        },
        "page_content": page.content if page else {},
        "assessment_template": page.assessment_template if page else []
    }

@router.post("/public/checkout")
async def public_checkout(req: OrderCreateRequest):
    """
    Creates an order and returns a Paystack authorization URL.
    """
    # 1. Fetch Offer to get price and business ID
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Offer).where(Offer.id == req.offer_id))
        offer = result.scalars().first()
    
    if not offer:
         raise HTTPException(status_code=404, detail="Offer not found")
         
    order = await create_pending_order(
        business_id=offer.business_id, 
        offer_id=offer.id, 
        amount=offer.price, 
        customer_email=req.customer_email, 
        customer_phone=req.customer_phone,
        currency=req.currency,
        assessment_answers=req.assessment_answers
    )
    
    if not order:
        raise HTTPException(status_code=500, detail="Could not create order")
        
    # 3. Initialize Paystack
    auth_url = await initialize_paystack_transaction(
        email=req.customer_email,
        amount=order.amount,
        reference=order.paystack_reference,
        callback_url=req.callback_url
    )
    
    if not auth_url:
         raise HTTPException(status_code=502, detail="Failed to initialize payment gateway")
         
    return {
        "status": "success",
        "authorization_url": auth_url,
        "reference": order.paystack_reference
    }

# --- Webhooks ---

@router.post("/webhook/paystack")
async def paystack_webhook(request: Request, x_paystack_signature: str = Header(None)):
    payload_bytes = await request.body()
    
    if not verify_paystack_webhook(payload_bytes, x_paystack_signature or ""):
        logger.warning("Invalid Paystack Webhook Signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        data = json.loads(payload_bytes)
    except json.JSONDecodeError:
         raise HTTPException(status_code=400, detail="Invalid JSON payload")
         
    event = data.get("event")
    
    # Optional ID for idempotency if provided by Paystack, or we use our reference
    # Paystack data.id is unique per event
    event_id = str(data.get("data", {}).get("id", "unknown")) 
    
    async with AsyncSessionLocal() as session:
        # Check idempotency
        result = await session.execute(
            select(SalesWebhookLog).where(SalesWebhookLog.event_id == event_id)
        )
        if result.scalars().first():
            logger.info(f"Webhook {event_id} already processed")
            return {"status": "success"} # Return 200 immediately
            
        # Log event
        log_entry = SalesWebhookLog(event_id=event_id, event_type=event, payload=data)
        session.add(log_entry)
        await session.commit()
    
    if event == "charge.success":
        reference = data.get("data", {}).get("reference")
        if reference:
            logger.info(f"[Webhook] Verifying transaction reference: {reference}")
            from services.payment_service import verify_paystack_transaction, PAYMENT_MODE
            
            # Step 1: Backend-to-Backend Verification (Step 4.3 in Plan)
            verify_res = await verify_paystack_transaction(reference)
            if not verify_res or not verify_res.get("status") or verify_res.get("data", {}).get("status") != "success":
                logger.error(f"[Webhook] Mandatory API verification FAILED for {reference}")
                return {"status": "error", "message": "Verification failed"}

            # Step 2: Process Success
            success, order, offer = await process_successful_payment(reference)
            if success and order and offer:
                # Update payment mode for audit trail
                async with AsyncSessionLocal() as session:
                    from sqlalchemy import update
                    await session.execute(
                        update(Order).where(Order.id == order.id).values(payment_mode=PAYMENT_MODE)
                    )
                    await session.commit()

                from services.workflow_engine import workflow_engine
                trigger_data = {
                    "order_id": order.id,
                    "amount": order.amount,
                    "currency": order.currency,
                    "customer_email": order.customer_email,
                    "customer_phone": order.customer_phone,
                    "business_id": order.business_id,
                    "reference": reference,
                    "offer_slug": offer.slug,
                    "offer_id": offer.id,
                    "offer_title": offer.title,
                    "user_id": order.customer_phone or order.customer_email, # Standardized key for workflow engine matching
                    "from_number": order.customer_phone # WhatsApp standard matching
                }
                logger.info(f"Triggering payment_received workflow for business {order.business_id}")
                await workflow_engine.trigger_workflow(order.business_id, "payment_received", trigger_data)
            
    return {"status": "success"}
    
    return {"status": "success"}
