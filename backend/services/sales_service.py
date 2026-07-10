import logging
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

async def create_pending_order(business_id: str, offer_id: int, amount: float, customer_email: str, customer_phone: str = None, currency: str = "USD", assessment_answers: dict = None) -> Order:
    async with AsyncSessionLocal() as session:
        try:
            # Robust identity resolution
            from services.db_service import save_lead
            lead_data = {
                "email": customer_email,
                "phone": customer_phone,
                "source": "checkout",
                "notes": f"Initiated checkout for Offer {offer_id}",
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
    """Called by Webhook"""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Order).where(Order.paystack_reference == reference))
            order = result.scalars().first()
            
            if not order:
                logger.error(f"Webhook error: Order {reference} not found")
                return False, None, None
                
            result_offer = await session.execute(select(Offer).where(Offer.id == order.offer_id))
            offer = result_offer.scalars().first()
            
            if not offer:
                logger.error(f"Error processing payment: Offer {order.offer_id} not found")
                return False, None, None
            
            order.status = "paid"
            
            # Log LeadActivity for purchase
            from database.models.crm import LeadActivity
            if order.lead_id:
                activity = LeadActivity(
                    business_id=order.business_id,
                    lead_id=order.lead_id,
                    type="purchase",
                    content={"text": f"Purchased '{offer.title}' for {order.amount} {order.currency}"},
                    created_by="system"
                )
                session.add(activity)
                
            await session.commit()
            
            # --- NEW: Trigger Asynchronous Fulfillment ---
            from .fulfillment_service import fulfillment_service
            # We use trigger_delivery_now here to ensure the email is sent 
            # as part of the primary transaction flow for maximum reliability.
            await fulfillment_service.trigger_delivery_now(order.id)
            
            return True, order, offer
        except Exception as e:
            await session.rollback()
            logger.error(f"Error processing successful payment: {e}")
            return False, None, None
        except Exception as e:
            await session.rollback()
            logger.error(f"Error processing successful payment: {e}")
            return False, None, None
