import logging
from typing import Optional, Dict, Any, List, Union
from sqlalchemy.future import select
from database.session import AsyncSessionLocal
from database.models.sales import Offer, SalesPage, Order, Delivery
from database.models.crm import Lead
from datetime import datetime

logger = logging.getLogger(__name__)

from sqlalchemy.orm import selectinload

async def get_offers(business_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Offer).options(selectinload(Offer.pages)).where(Offer.business_id == business_id)
        )
        return result.scalars().all()

async def get_offer_by_slug(business_id: str, slug: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Offer).where(Offer.business_id == business_id, Offer.slug == slug)
        )
        return result.scalars().first()

async def get_offer_by_id(business_id: str, offer_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Offer).where(Offer.business_id == business_id, Offer.id == offer_id)
        )
        return result.scalars().first()

async def create_offer(business_id: str, data: dict):
    async with AsyncSessionLocal() as session:
        try:
            new_offer = Offer(
                business_id=business_id,
                title=data.get("title"),
                description=data.get("description"),
                price=data.get("price"),
                currency=data.get("currency", "USD"),
                delivery_type=data.get("delivery_type", "link"),
                slug=data.get("slug"),
                ai_metadata=data.get("ai_metadata", {})
            )
            
            # Check slug uniqueness for this business
            existing_offer = await get_offer_by_slug(business_id, new_offer.slug)
            if existing_offer:
                logger.warning(f"Slug collision detected: {new_offer.slug} for business {business_id}")
                return None
            session.add(new_offer)
            await session.flush() # Get ID
            
            # Auto-create SalesPage
            content = data.get("content", {})
            assessment_template = content.pop("assessment_template", []) # Move from generic content to its own column
            page = SalesPage(
                business_id=business_id, 
                offer_id=new_offer.id, 
                content=content,
                assessment_template=assessment_template
            )
            session.add(page)
            
            await session.commit()
            await session.refresh(new_offer)
            return new_offer, None
        except Exception as e:
            await session.rollback()
            error_msg = str(e)
            logger.error(f"Error creating offer: {error_msg}")
            return None, error_msg

async def save_sales_page(business_id: str, offer_id: int, content: dict):
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                select(SalesPage).where(SalesPage.business_id == business_id, SalesPage.offer_id == offer_id)
            )
            page = result.scalars().first()
            if page:
                page.content = content
            else:
                page = SalesPage(business_id=business_id, offer_id=offer_id, content=content)
                session.add(page)
            
            await session.commit()
            return True
        except Exception as e:
            await session.rollback()
            logger.error(f"Error saving sales page: {e}")
            return False

async def update_offer(business_id: str, offer_id: int, data: dict):
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Offer).where(Offer.id == offer_id, Offer.business_id == business_id))
            offer = result.scalars().first()
            if not offer:
                return False
                
            for key, value in data.items():
                if key != "content" and hasattr(offer, key):
                    setattr(offer, key, value)
                    
            if "content" in data:
                res_p = await session.execute(select(SalesPage).where(SalesPage.offer_id == offer.id))
                page = res_p.scalars().first()
                content = data["content"]
                assessment_template = content.pop("assessment_template", [])
                
                if page:
                    page.content = content
                    page.assessment_template = assessment_template
                else:
                    page = SalesPage(
                        business_id=business_id, 
                        offer_id=offer.id, 
                        content=content,
                        assessment_template=assessment_template
                    )
                    session.add(page)
            
            if "ai_metadata" in data:
                offer.ai_metadata = data["ai_metadata"]
                    
            await session.commit()
            return True
        except Exception as e:
            await session.rollback()
            logger.error(f"Error saving sales page: {e}")
            return False

async def get_sales_page(business_id: str, offer_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SalesPage).where(SalesPage.business_id == business_id, SalesPage.offer_id == offer_id)
        )
        return result.scalars().first()

async def create_pending_order(business_id: str, offer_id: Optional[int] = None, amount: float = 0.0, customer_email: str = "", customer_phone: str = None, currency: str = "USD", assessment_answers: dict = None) -> Order:
    async with AsyncSessionLocal() as session:
        try:
            # Robust identity resolution
            from services.db_service import save_lead
            lead_data = {
                "email": customer_email,
                "phone": customer_phone,
                "source": "checkout",
                "notes": f"Initiated checkout for Offer {offer_id}" if offer_id else "Initiated online checkout",
                "custom_fields": assessment_answers or {}
            }
            # save_lead handles merging and creating
            lead_id = await save_lead(business_id, lead_data)

            # Generate local reference
            import uuid
            reference = f"ORD_{uuid.uuid4().hex[:12].upper()}"

            new_order = Order(
                business_id=business_id,
                offer_id=offer_id,
                lead_id=lead_id,
                amount=amount,
                currency=currency,
                customer_email=customer_email,
                customer_phone=customer_phone,
                status="pending",
                paystack_reference=reference
            )
            session.add(new_order)
            await session.commit()
            await session.refresh(new_order)
            return new_order
        except Exception as e:
            await session.rollback()
            logger.error(f"Error creating pending order: {e}")
            return None

async def get_orders(business_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Order).where(Order.business_id == business_id).order_by(Order.created_at.desc()))
        return result.scalars().all()

async def process_successful_payment(reference: str):
    """Called by Webhook and manual verification"""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Order).where(Order.paystack_reference == reference))
            order = result.scalars().first()
            
            if not order:
                logger.error(f"Webhook error: Order {reference} not found")
                return False, None, None
                
            offer = None
            if order.offer_id:
                result_offer = await session.execute(select(Offer).where(Offer.id == order.offer_id))
                offer = result_offer.scalars().first()
            
            order.status = "paid"
            
            # Log LeadActivity for purchase
            from database.models.crm import LeadActivity
            if order.lead_id:
                item_title = offer.title if offer else "Product Purchase"
                activity = LeadActivity(
                    business_id=order.business_id,
                    lead_id=order.lead_id,
                    type="purchase",
                    content={"text": f"Purchased '{item_title}' for {order.amount} {order.currency}"},
                    created_by="system"
                )
                session.add(activity)
                
            await session.commit()
            
            # If this is linked to an SME order, mark it PAID and deduct stock
            try:
                from services.sme_service import sme_service
                from database.models.dynamic_entity import EntityV2, EntityType
                
                type_res = await session.execute(
                    select(EntityType.id).where(
                        EntityType.org_id == order.business_id,
                        EntityType.code == "sme_order"
                    )
                )
                type_id = type_res.scalars().first()
                if type_id:
                    sme_res = await session.execute(
                        select(EntityV2).where(
                            EntityV2.org_id == order.business_id,
                            EntityV2.entity_type_id == type_id
                        )
                    )
                    sme_orders = sme_res.scalars().all()
                    for so in sme_orders:
                        attrs = so.attributes or {}
                        notes = attrs.get("notes") or ""
                        if reference in notes or so.external_ref_id == reference:
                            await sme_service.update_order_status(
                                db=session,
                                org_id=order.business_id,
                                order_id=so.id,
                                payment_status="PAID"
                            )
                            logger.info(f"Marked SME order {so.id} as PAID and processed stock deduction")
                            break
            except Exception as sme_err:
                logger.warning(f"Error updating SME order status on payment: {sme_err}")

            # Trigger fulfillment if regular sales offer exists
            if offer:
                from .fulfillment_service import fulfillment_service
                await fulfillment_service.trigger_delivery_now(order.id)
            else:
                # Provide a fallback object with title/slug/id for callers
                class DummyOffer:
                    id = None
                    slug = "sme-product"
                    title = "Store Product"
                offer = DummyOffer()
            
            return True, order, offer
        except Exception as e:
            await session.rollback()
            logger.error(f"Error processing successful payment: {e}")
            return False, None, None
