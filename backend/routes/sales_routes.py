from fastapi import APIRouter, HTTPException, Depends, Request, Header
from typing import List, Optional, Any, Union
from pydantic import BaseModel
import logging
import json
from services.db_service import resolve_business_id, get_all_possible_business_ids
from database.session import AsyncSessionLocal
from services.auth_service import get_current_user, require_permission
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
    initialize_paystack_transaction, verify_paystack_webhook, verify_paystack_transaction,
    list_paystack_banks, resolve_paystack_account, create_or_update_paystack_subaccount,
    get_business_payment_config
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
    offer_id: Any
    customer_email: str
    customer_phone: Optional[str] = None
    currency: str = "USD"
    callback_url: Optional[str] = None
    assessment_answers: Optional[dict] = {}

class AccountResolveRequest(BaseModel):
    account_number: str
    bank_code: str

class PayoutConfigRequest(BaseModel):
    business_id: str
    bank_code: str
    bank_name: Optional[str] = None
    account_number: str
    account_name: Optional[str] = None
    percentage_charge: Optional[float] = 0.0

# --- Internal Dashboard Routes (/api/sales/*) ---

@router.post("/offers")
async def api_create_offer(data: OfferCreate, current_user: dict = Depends(get_current_user)):
    real_bid = await resolve_business_id(data.business_id)
    if current_user.get("role") not in ["super_admin"] and current_user.get("business_id") != real_bid:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    offer, error_msg = await create_offer(real_bid, data.dict(exclude={"business_id"}))
    if not offer:
        raise HTTPException(status_code=400, detail=error_msg or "Failed to create offer")
    return {"status": "success", "id": offer.id, "slug": offer.slug}

@router.get("/offers")
async def api_get_offers(business_id: str, current_user: dict = Depends(get_current_user)):
    real_bid = await resolve_business_id(business_id)
    if current_user.get("role") not in ["super_admin"] and current_user.get("business_id") != real_bid:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    possible_ids = await get_all_possible_business_ids(business_id)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Offer).options(selectinload(Offer.pages)).where(Offer.business_id.in_(possible_ids))
        )
        offers = result.scalars().all()
    
    offer_list = [
        {
            "id": o.id, "title": o.title, "price": o.price, 
            "currency": o.currency, "slug": o.slug, "is_active": o.is_active,
            "delivery_type": o.delivery_type, "description": o.description,
            "ai_metadata": o.ai_metadata,
            "content": o.pages.content if getattr(o, "pages", None) else {},
            "assessment_template": o.pages.assessment_template if getattr(o, "pages", None) else []
        } for o in offers
    ]

    # Also merge SME products from entities_v2
    async with AsyncSessionLocal() as session:
        try:
            from database.models.dynamic_entity import EntityV2, EntityType
            type_stmt = select(EntityType.id).where(
                EntityType.org_id.in_(possible_ids),
                EntityType.code == "sme_product"
            )
            res_t = await session.execute(type_stmt)
            t_ids = res_t.scalars().all()
            if t_ids:
                e_stmt = select(EntityV2).where(
                    EntityV2.org_id.in_(possible_ids),
                    EntityV2.entity_type_id.in_(t_ids)
                )
                res_e = await session.execute(e_stmt)
                sme_prods = res_e.scalars().all()
                for sp in sme_prods:
                    attrs = sp.attributes or {}
                    title = attrs.get("name") or sp.display_label
                    if any(ol.get("title") == title for ol in offer_list):
                        continue
                    price = float(attrs.get("selling_price") or attrs.get("price") or 0.0)
                    offer_list.append({
                        "id": sp.id,
                        "title": title,
                        "price": price,
                        "currency": attrs.get("currency", "NGN"),
                        "slug": f"sme-product-{sp.id}",
                        "is_active": True,
                        "delivery_type": "physical",
                        "description": f"SKU: {attrs.get('sku', 'N/A')} | In Stock: {attrs.get('current_stock', 0)}",
                        "ai_metadata": {"core_benefit": title, "stock": attrs.get("current_stock", 0)},
                        "content": {},
                        "assessment_template": []
                    })
        except Exception as sme_prod_e:
            logger.warning(f"Error merging SME products into offers: {sme_prod_e}")

    return offer_list

@router.put("/offers/{offer_id}")
async def api_update_offer(offer_id: int, data: OfferUpdate, request: Request, current_user: dict = Depends(get_current_user)):
    business_id = request.query_params.get("business_id")
    real_bid = await resolve_business_id(business_id)
    if current_user.get("role") not in ["super_admin"] and current_user.get("business_id") != real_bid:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    
    from services.sales_service import update_offer
    success = await update_offer(real_bid, offer_id, data.dict(exclude_unset=True))
    if not success:
         raise HTTPException(status_code=400, detail="Failed to update offer")
    return {"status": "success"}

@router.get("/orders")
async def api_get_orders(business_id: str, current_user: dict = Depends(get_current_user)):
    real_bid = await resolve_business_id(business_id)
    if current_user.get("role") not in ["super_admin"] and current_user.get("business_id") != real_bid:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    possible_ids = await get_all_possible_business_ids(business_id)
    
    order_list = []
    async with AsyncSessionLocal() as session:
        try:
            # 1. Query orders with related deliveries and offer
            stmt = select(Order).options(
                selectinload(Order.deliveries),
                selectinload(Order.offer)
            ).where(Order.business_id.in_(possible_ids)).order_by(Order.created_at.desc())
            
            result = await session.execute(stmt)
            orders = result.scalars().all()
            
            for o in orders:
                order_list.append({
                    "id": o.id, 
                    "amount": o.amount, 
                    "currency": o.currency or "NGN",
                    "status": (o.status or "pending").lower(), 
                    "customer_email": o.customer_email or "No Email",
                    "customer_phone": o.customer_phone,
                    "offer_title": o.offer.title if o.offer else "Direct Purchase",
                    "delivery_status": o.deliveries[0].status if o.deliveries else ("delivered" if o.status == "paid" else "pending"),
                    "delivery_channel": o.deliveries[0].channel if o.deliveries else "email",
                    "created_at": o.created_at.isoformat() if o.created_at else ""
                })
        except Exception as e:
            logger.error(f"Error fetching orders: {e}")

        # 2. Query SME orders from entities_v2
        try:
            from database.models.dynamic_entity import EntityV2, EntityType
            type_stmt = select(EntityType.id).where(
                EntityType.org_id.in_(possible_ids),
                EntityType.code == "sme_order"
            )
            res_t = await session.execute(type_stmt)
            t_ids = res_t.scalars().all()
            if t_ids:
                e_stmt = select(EntityV2).where(
                    EntityV2.org_id.in_(possible_ids),
                    EntityV2.entity_type_id.in_(t_ids)
                ).order_by(EntityV2.created_at.desc())
                res_e = await session.execute(e_stmt)
                sme_orders = res_e.scalars().all()
                for so in sme_orders:
                    attrs = so.attributes or {}
                    if any(ol.get("id") == so.id for ol in order_list):
                        continue
                    
                    items = attrs.get("items") or []
                    items_str = ", ".join([f"{it.get('name', 'Item')} (x{it.get('quantity', 1)})" for it in items]) if items else attrs.get("product_name") or so.display_label
                    
                    order_list.append({
                        "id": so.id,
                        "customer_email": attrs.get("customer_email") or attrs.get("customer_name") or "Direct Customer",
                        "customer_phone": attrs.get("customer_phone") or "N/A",
                        "offer_title": items_str or "SME Order",
                        "currency": attrs.get("currency") or "NGN",
                        "amount": float(attrs.get("total_amount") or 0.0),
                        "status": (attrs.get("payment_status") or "paid").lower(),
                        "delivery_status": (attrs.get("fulfilment_status") or "delivered").lower(),
                        "delivery_channel": attrs.get("payment_method") or "store",
                        "created_at": so.created_at.isoformat() if so.created_at else ""
                    })
        except Exception as sme_e:
            logger.warning(f"Error merging SME orders: {sme_e}")

    order_list.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return order_list

@router.get("/payment/config")
async def api_get_payment_config(business_id: str, current_user: dict = Depends(get_current_user)):
    real_bid = await resolve_business_id(business_id)
    if current_user.get("role") not in ["super_admin"] and current_user.get("business_id") != real_bid:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    cfg = await get_business_payment_config(real_bid)
    return {"status": "success", "config": cfg}

@router.get("/payment/banks")
async def api_get_banks(current_user: dict = Depends(get_current_user)):
    banks = await list_paystack_banks()
    return {"status": "success", "banks": banks}

@router.post("/payment/resolve-account")
async def api_resolve_account(data: AccountResolveRequest, current_user: dict = Depends(get_current_user)):
    res = await resolve_paystack_account(data.account_number, data.bank_code)
    if not res.get("status"):
        raise HTTPException(status_code=400, detail=res.get("message", "Unable to resolve account"))
    return res

@router.post("/payment/config")
async def api_save_payment_config(data: PayoutConfigRequest, current_user: dict = Depends(get_current_user)):
    real_bid = await resolve_business_id(data.business_id)
    if current_user.get("role") not in ["super_admin"] and current_user.get("business_id") != real_bid:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
        
    from database.models.general import Business
    async with AsyncSessionLocal() as session:
        b_res = await session.execute(select(Business.name).where(Business.id == real_bid))
        biz_name = b_res.scalars().first() or "Business Merchant"
        
    try:
        saved = await create_or_update_paystack_subaccount(
            business_id=real_bid,
            business_name=biz_name,
            bank_code=data.bank_code,
            account_number=data.account_number,
            bank_name=data.bank_name,
            account_name=data.account_name,
            percentage_charge=data.percentage_charge or 0.0
        )
        return {"status": "success", "config": saved}
    except Exception as e:
        logger.error(f"Error configuring payout account: {e}")
        raise HTTPException(status_code=400, detail=str(e))

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
    if not success or not order:
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
        "offer_slug": getattr(offer, "slug", "product-purchase"),
        "offer_id": getattr(offer, "id", None),
        "offer_title": getattr(offer, "title", "Product Purchase"),
        "user_id": order.customer_phone or order.customer_email,
        "from_number": order.customer_phone
    }
    logger.info(f"Verified payment {reference}. Triggering workflow.")
    await workflow_engine.trigger_workflow(order.business_id, "payment_received", trigger_data)
    
    return {"status": "success", "order_id": order.id}

@router.get("/public/{business_slug}/{offer_slug}")
async def public_get_offer_page(business_slug: str, offer_slug: str):
    real_bid = await resolve_business_id(business_slug)
    possible_ids = await get_all_possible_business_ids(business_slug)
    
    # 1. Try standard Offer
    offer = await get_offer_by_slug(real_bid, offer_slug)
    if offer:
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
        
    # 2. Fallback to SME product in entities_v2
    from database.models.dynamic_entity import EntityV2
    from database.models.general import Business
    
    clean_id = offer_slug.replace("sme-product-", "")
    async with AsyncSessionLocal() as session:
        stmt = select(EntityV2).where(
            EntityV2.org_id.in_(possible_ids),
            or_(
                EntityV2.id == clean_id,
                EntityV2.id == offer_slug,
                EntityV2.external_ref_id == clean_id
            )
        )
        res = await session.execute(stmt)
        sme_prod = res.scalars().first()
        
        if not sme_prod:
            raise HTTPException(status_code=404, detail="Offer not found")
            
        biz_stmt = select(Business.name).where(Business.id.in_(possible_ids))
        biz_name_res = await session.execute(biz_stmt)
        biz_name = biz_name_res.scalars().first() or "Our Store"
        
        attrs = sme_prod.attributes or {}
        title = attrs.get("name") or sme_prod.display_label or "Product"
        price = float(attrs.get("selling_price") or attrs.get("price") or 0.0)
        currency = attrs.get("currency") or "NGN"
        sku = attrs.get("sku") or "N/A"
        stock = int(float(attrs.get("current_stock") or 0))
        image_url = attrs.get("image_url") or attrs.get("image") or ""
        
        description = attrs.get("description")
        if not description:
            description = f"Purchase {title} directly from {biz_name}. SKU: {sku}."
            if stock > 0:
                description += f" In stock ({stock} units available) and ready for dispatch."
                
        features = attrs.get("features")
        if not features or not isinstance(features, list):
            features = [
                "100% Genuine product guaranteed",
                f"Fast fulfillment & dispatch from {biz_name}",
                f"Instant stock confirmation ({stock} in stock)" if stock > 0 else "Special order availability",
                "Secure and encrypted payment with Paystack"
            ]
            
        return {
            "offer": {
                "id": sme_prod.id,
                "title": title,
                "description": description,
                "price": price,
                "currency": currency,
                "stock": stock,
                "sku": sku,
                "is_sme": True
            },
            "page_content": {
                "subtitle": attrs.get("subtitle") or f"Direct order from {biz_name}",
                "image_url": image_url,
                "features": features
            },
            "assessment_template": []
        }

@router.post("/public/checkout")
async def public_checkout(req: OrderCreateRequest):
    """
    Creates an order and returns a Paystack authorization URL.
    Supports both traditional sales offers and SME products.
    """
    offer = None
    sme_product = None
    business_id = None
    amount = 0.0
    offer_title = ""
    sql_offer_id = None
    
    from database.models.dynamic_entity import EntityV2
    
    async with AsyncSessionLocal() as session:
        # Check standard Offer if offer_id is numeric
        is_num = False
        try:
            int_id = int(req.offer_id)
            is_num = True
        except (ValueError, TypeError):
            is_num = False
            
        if is_num:
            result = await session.execute(select(Offer).where(Offer.id == int_id))
            offer = result.scalars().first()
            if offer:
                business_id = offer.business_id
                amount = offer.price
                offer_title = offer.title
                sql_offer_id = offer.id

        # If not standard Offer, check SME product in entities_v2
        if not offer:
            prod_id = str(req.offer_id).replace("sme-product-", "")
            result = await session.execute(select(EntityV2).where(or_(EntityV2.id == prod_id, EntityV2.id == str(req.offer_id))))
            sme_product = result.scalars().first()
            if sme_product:
                business_id = sme_product.org_id
                attrs = sme_product.attributes or {}
                amount = float(attrs.get("selling_price") or attrs.get("price") or 0.0)
                offer_title = attrs.get("name") or sme_product.display_label
                sql_offer_id = None

    if not offer and not sme_product:
        raise HTTPException(status_code=404, detail="Offer or product not found")
        
    order = await create_pending_order(
        business_id=business_id, 
        offer_id=sql_offer_id, 
        amount=amount, 
        customer_email=req.customer_email, 
        customer_phone=req.customer_phone,
        currency=req.currency or "NGN",
        assessment_answers=req.assessment_answers
    )
    
    if not order:
        raise HTTPException(status_code=500, detail="Could not create order")

    # If it's an SME product, also mirror it into entities_v2 as a pending sme_order
    if sme_product:
        try:
            from services.sme_service import sme_service
            async with AsyncSessionLocal() as db_session:
                await sme_service.record_order(
                    db=db_session,
                    org_id=business_id,
                    order_data={
                        "customer_name": req.customer_email.split("@")[0],
                        "customer_email": req.customer_email,
                        "customer_phone": req.customer_phone,
                        "items": [{
                            "product_id": sme_product.id,
                            "name": offer_title,
                            "quantity": 1.0,
                            "price": amount
                        }],
                        "total_amount": amount,
                        "currency": req.currency or "NGN",
                        "payment_status": "PENDING",
                        "payment_method": "paystack",
                        "channel": "online_store",
                        "notes": f"Online order via landing page. Paystack Ref: {order.paystack_reference}"
                    }
                )
        except Exception as sme_err:
            logger.warning(f"Failed to record pending SME order: {sme_err}")
        
    # 3. Initialize Paystack
    auth_url = await initialize_paystack_transaction(
        email=req.customer_email,
        amount=order.amount,
        reference=order.paystack_reference,
        callback_url=req.callback_url,
        business_id=business_id
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
                    "offer_slug": getattr(offer, "slug", "product-purchase"),
                    "offer_id": getattr(offer, "id", None),
                    "offer_title": getattr(offer, "title", "Product Purchase"),
                    "user_id": order.customer_phone or order.customer_email, # Standardized key for workflow engine matching
                    "from_number": order.customer_phone # WhatsApp standard matching
                }
                logger.info(f"Triggering payment_received workflow for business {order.business_id}")
                await workflow_engine.trigger_workflow(order.business_id, "payment_received", trigger_data)
                
                # Emit observation to argus-core
                try:
                    from services.argus_core_client import emit_observation
                    import asyncio
                    asyncio.create_task(
                        emit_observation(
                            source_system="payments",
                            entity_type="invoice",
                            entity_id=order.id,
                            confidence=1.0,
                            metadata={
                                "amount": float(order.amount) if order.amount else 0.0,
                                "currency": order.currency,
                                "customer_email": order.customer_email,
                                "customer_phone": order.customer_phone,
                                "business_id": order.business_id,
                                "reference": reference,
                                "offer_id": offer.id,
                                "offer_title": offer.title
                            },
                            relationships=[
                                {
                                    "target_type": "customer",
                                    "target_id": order.customer_phone or order.customer_email or "unknown",
                                    "type": "LINKED_TO",
                                    "confidence": 1.0
                                },
                                {
                                    "target_type": "business",
                                    "target_id": order.business_id,
                                    "type": "OWNED_BY",
                                    "confidence": 1.0
                                }
                            ],
                            context=f"Payment received: {order.currency} {order.amount} from {order.customer_email} for {offer.title}",
                            severity="info"
                        )
                    )
                except Exception as obs_err:
                    logger.warning(f"Error initiating observation emission for sales payment: {obs_err}")
            
    return {"status": "success"}
    
    return {"status": "success"}
