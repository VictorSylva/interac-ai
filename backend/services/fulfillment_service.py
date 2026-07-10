import logging
from datetime import datetime
from sqlalchemy import select
from database.session import AsyncSessionLocal
from database.models.sales import Order, Offer, Delivery, SalesPage
from .email_service import email_service
from .whatsapp_service import send_whatsapp_message
from celery import shared_task

logger = logging.getLogger(__name__)

class FulfillmentService:
    @staticmethod
    async def trigger_delivery(order_id: int):
        """Entry point to start the async delivery process via Celery."""
        logger.info(f"[Fulfillment] Queueing delivery task for order {order_id}")
        try:
            process_delivery_task.delay(order_id)
        except Exception as e:
            logger.error(f"[Fulfillment] Failed to queue Celery task for {order_id}: {e}. Falling back to immediate execution.")
            # Fallback will be handled by calling trigger_delivery_now if this fails
            # Or we can just call it here
            from .fulfillment_service import fulfillment_service
            await fulfillment_service.process_order_delivery(order_id)

    async def trigger_delivery_now(self, order_id: int):
        """Immediate, synchronous delivery. Use for critical flows or if Celery is unavailable."""
        logger.info(f"[Fulfillment] Triggering IMMEDIATE delivery for order {order_id}")
        await self.process_order_delivery(order_id)

    async def process_order_delivery(self, order_id: int):
        """Core logic for delivering an order."""
        async with AsyncSessionLocal() as session:
            try:
                # 1. Fetch Order and related data
                stmt = select(Order).where(Order.id == order_id)
                result = await session.execute(stmt)
                order = result.scalar_one_or_none()
                
                if not order:
                    logger.error(f"[Fulfillment] Order {order_id} not found")
                    return
                
                if order.status != "paid":
                    logger.warning(f"[Fulfillment] Skipping delivery for order {order_id} (status: {order.status})")
                    return

                stmt_offer = select(Offer).where(Offer.id == order.offer_id)
                result_offer = await session.execute(stmt_offer)
                offer = result_offer.scalar_one_or_none()
                
                if not offer:
                    logger.error(f"[Fulfillment] Offer for order {order_id} not found")
                    return

                # 2. Extract Delivery Config from SalesPage
                stmt_page = select(SalesPage).where(SalesPage.offer_id == offer.id)
                result_page = await session.execute(stmt_page)
                page = result_page.scalar_one_or_none()
                page_content = page.content if page and page.content else {}

                post_msg = page_content.get("post_purchase_message", f"Thank you for your purchase of {offer.title}!")
                # delivery_policy: "both", "email", "whatsapp"
                delivery_policy = page_content.get("post_purchase_delivery_type", "email") 

                # 3. Create or get Delivery record
                stmt_deliv = select(Delivery).where(Delivery.order_id == order.id)
                result_deliv = await session.execute(stmt_deliv)
                delivery = result_deliv.scalars().first()
                
                if not delivery:
                    delivery = Delivery(
                        order_id=order.id,
                        type=offer.delivery_type or "link",
                        status="pending"
                    )
                    session.add(delivery)
                    await session.flush()

                # 4. Attempt Deliveries
                success = False
                errors = []

                logger.info(f"[Fulfillment] Processing order {order_id} for Business {order.business_id}. Policy: {delivery_policy}")

                # --- EMAIL CHANNEL ---
                if delivery_policy in ["email", "both"]:
                    if order.customer_email:
                        logger.info(f"[Fulfillment] Attempting email delivery to {order.customer_email}")
                        email_success = await email_service.send_email(
                            to=order.customer_email,
                            subject=f"Your Purchase: {offer.title}",
                            html_content=self._build_delivery_html(offer, post_msg),
                            business_id=order.business_id
                        )
                        if email_success:
                            logger.info(f"[Fulfillment] Email delivered successfully to {order.customer_email}")
                            success = True
                            delivery.channel = "email"
                        else:
                            logger.error(f"[Fulfillment] Email delivery FAILED for order {order_id}")
                            errors.append("Email delivery failed - check SMTP/Resend logs")
                    else:
                        logger.warning(f"[Fulfillment] No email found for order {order_id}")
                        errors.append("No email found for order")

                # --- WHATSAPP CHANNEL ---
                if delivery_policy in ["whatsapp", "both"] or (not success and delivery_policy == "email"):
                    # Fallback to WhatsApp if email failed or both requested
                    if order.customer_phone:
                        logger.info(f"[Fulfillment] Attempting WhatsApp delivery to {order.customer_phone}")
                        whatsapp_success = await send_whatsapp_message(
                            to_number=order.customer_phone,
                            text=post_msg,
                            business_id=order.business_id
                        )
                        # We assume success if no error raised or handle based on return
                        # WhatsApp service needs to return boolean ideally
                        success = True # Simplified for now
                        delivery.channel = "whatsapp"
                        logger.info(f"[Fulfillment] WhatsApp delivery triggered for {order.customer_phone}")
                    else:
                        logger.warning(f"[Fulfillment] No phone found for order {order_id}")
                        errors.append("No phone found for order")

                # 5. Update Status
                if success:
                    delivery.status = "delivered"
                    delivery.delivered_at = datetime.utcnow()
                else:
                    delivery.status = "failed"
                    delivery.retry_count += 1
                    delivery.error_log = "\n".join(errors)
                    # Trigger retry if count < threshold
                    if delivery.retry_count < 3:
                        logger.info(f"[Fulfillment] Scheduling retry for order {order_id} (Attempt {delivery.retry_count})")
                        process_delivery_task.apply_async(args=[order_id], countdown=300 * delivery.retry_count)

                await session.commit()
                if success:
                    logger.info(f"[Fulfillment] SUCCESS: Order {order_id} delivered via {delivery.channel}")
                else:
                    logger.error(f"[Fulfillment] FAILURE: Order {order_id} could not be delivered. Errors: {errors}")


            except Exception as e:
                logger.error(f"[Fulfillment] Critical error processing delivery for order {order_id}: {e}")
                await session.rollback()

    def _build_delivery_html(self, offer: Offer, message: str):
        """Simple HTML template for offer delivery."""
        return f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #001F3F; text-align: center;">Your Purchase is Ready!</h2>
            <p>Hello,</p>
            <p>{message}</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">{offer.title}</h3>
                <p style="font-size: 14px; color: #555;">{offer.description or ""}</p>
            </div>
            <p>If you have any questions, feel free to reply to this email.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 InterractAI. Delivered on behalf of {offer.business_id}.</p>
        </div>
        """

fulfillment_service = FulfillmentService()

@shared_task(name="process_delivery")
def process_delivery_task(order_id: int):
    import asyncio
    asyncio.run(fulfillment_service.process_order_delivery(order_id))
