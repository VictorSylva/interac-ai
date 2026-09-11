import json
import logging
import os
from pywebpush import webpush, WebPushException
from sqlalchemy import select
from database.session import AsyncSessionLocal
from database.models.general import PushSubscription, User

logger = logging.getLogger(__name__)

# VAPID Keys from environment (provided by user)
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_CLAIMS = {
    "sub": os.getenv("VAPID_EMAIL", "mailto:interacai.int@gmail.com")
}

class NotificationService:
    async def save_subscription(self, user_id: str, subscription_info: dict):
        async with AsyncSessionLocal() as session:
            try:
                # Check if already exists
                stmt = select(PushSubscription).where(PushSubscription.endpoint == subscription_info['endpoint'])
                res = await session.execute(stmt)
                existing = res.scalar_one_or_none()
                
                if existing:
                    existing.user_id = user_id
                    existing.p256dh = subscription_info['keys']['p256dh']
                    existing.auth = subscription_info['keys']['auth']
                else:
                    new_sub = PushSubscription(
                        user_id=user_id,
                        endpoint=subscription_info['endpoint'],
                        p256dh=subscription_info['keys']['p256dh'],
                        auth=subscription_info['keys']['auth']
                    )
                    session.add(new_sub)
                
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error saving push subscription: {e}")
                await session.rollback()
                return False

    async def send_push_notification(self, user_id: str, title: str, body: str, url: str = "/conversations"):
        if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
            logger.warning("VAPID keys not configured. Skipping push notification.")
            return False

        async with AsyncSessionLocal() as session:
            try:
                stmt = select(PushSubscription).where(PushSubscription.user_id == user_id)
                res = await session.execute(stmt)
                subscriptions = res.scalars().all()
                
                if not subscriptions:
                    logger.info(f"No push subscriptions found for user {user_id}")
                    return False

                payload = {
                    "title": title,
                    "body": body,
                    "url": url,
                    "icon": "/logo192.png", # Default icon
                    "badge": "/logo192.png"
                }

                success_count = 0
                for sub in subscriptions:
                    try:
                        webpush(
                            subscription_info={
                                "endpoint": sub.endpoint,
                                "keys": {
                                    "p256dh": sub.p256dh,
                                    "auth": sub.auth
                                }
                            },
                            data=json.dumps(payload),
                            vapid_private_key=VAPID_PRIVATE_KEY,
                            vapid_claims=VAPID_CLAIMS
                        )
                        success_count += 1
                    except WebPushException as ex:
                        logger.error(f"WebPush error for user {user_id}: {ex}")
                        # If 410 Gone, the subscription is no longer valid
                        if ex.response and ex.response.status_code == 410:
                            await session.delete(sub)
                
                await session.commit()
                return success_count > 0
            except Exception as e:
                logger.error(f"Error sending push notification: {e}")
                return False

    async def notify_department(self, business_id: str, department: str, title: str, body: str, url: str = "/conversations"):
        """Sends push notification to all agents and owners in a specific department."""
        from services.db_service import resolve_business_id
        real_business_id = await resolve_business_id(business_id)
        
        async with AsyncSessionLocal() as session:
            try:
                # Find all agents and owners for this business
                from database.models.general import User
                stmt = select(User.id).where(
                    User.business_id == real_business_id, 
                    User.role.in_(["agent", "owner", "admin"])
                )
                if department and department != "general":
                    from sqlalchemy import or_
                    stmt = stmt.where(or_(
                        User.department == department, 
                        User.department.like(f"%{department}%"),
                        User.department == None,
                        User.department == ""
                    ))
                
                res = await session.execute(stmt)
                agent_ids = res.scalars().all()
                
                for aid in agent_ids:
                    await self.send_push_notification(aid, title, body, url)
                    
                return True
            except Exception as e:
                logger.error(f"Error notifying department: {e}")
                return False

    async def notify_agent_and_owner(
        self,
        business_id: str,
        title: str,
        message: str,
        customer_identifier: str = "Customer",
        department: str = "general",
        conversation_id: str = None,
        url: str = "/conversations"
    ):
        """
        Dispatches chat and escalation notifications to both assigned agents and business owners
        via WhatsApp, Email (Resend), and WebPush.
        Enforces a cooldown to prevent notification spam per conversation.
        """
        from services.db_service import resolve_business_id
        from services.email_service import email_service
        from services.whatsapp_service import send_whatsapp_message, send_whatsapp_template
        from database.models.general import User, DepartmentConfig, NotificationEvent, BusinessSettings
        from datetime import datetime, timedelta
        import re

        real_business_id = await resolve_business_id(business_id)
        convo_id = conversation_id or f"{real_business_id}:{customer_identifier}"

        async with AsyncSessionLocal() as session:
            try:
                # 1. Cooldown Throttling Check
                cooldown_minutes = 5
                settings_stmt = select(BusinessSettings).where(BusinessSettings.business_id == real_business_id)
                settings_res = await session.execute(settings_stmt)
                settings = settings_res.scalar_one_or_none()
                if settings and getattr(settings, "notification_cooldown_minutes", None):
                    cooldown_minutes = settings.notification_cooldown_minutes or 5

                cutoff = datetime.utcnow() - timedelta(minutes=cooldown_minutes)
                cooldown_stmt = select(NotificationEvent).where(
                    NotificationEvent.business_id == real_business_id,
                    NotificationEvent.conversation_id == convo_id,
                    NotificationEvent.sent_at >= cutoff
                )
                existing_alert = (await session.execute(cooldown_stmt)).scalars().first()
                if existing_alert:
                    logger.info(f"[NotificationService] Skipping duplicate alert for convo {convo_id} (throttled by {cooldown_minutes}m cooldown)")
                    return {"status": "throttled", "cooldown_minutes": cooldown_minutes}

                # 2. Query Agents and Owners
                stmt = select(User).where(
                    User.business_id == real_business_id,
                    User.role.in_(["agent", "owner", "admin"])
                )
                res = await session.execute(stmt)
                users = res.scalars().all()

                # 3. Query Department Routing Config
                dept_config = None
                if department:
                    dept_stmt = select(DepartmentConfig).where(
                        DepartmentConfig.business_id == real_business_id,
                        DepartmentConfig.department == department
                    )
                    dept_res = await session.execute(dept_stmt)
                    dept_config = dept_res.scalar_one_or_none()

                email_recipients = set()
                phone_recipients = set()
                push_user_ids = set()

                for u in users:
                    push_user_ids.add(u.id)
                    if getattr(u, "receive_operational_alerts", True) is not False:
                        if u.email and "@" in u.email:
                            email_recipients.add(u.email.strip())
                        if getattr(u, "phone", None):
                            phone_recipients.add(re.sub(r'\D', '', str(u.phone)))

                # Add department-level email / phone overrides
                if dept_config:
                    if dept_config.notification_email and "@" in dept_config.notification_email:
                        email_recipients.add(dept_config.notification_email.strip())
                    if dept_config.notification_phone:
                        phone_recipients.add(re.sub(r'\D', '', str(dept_config.notification_phone)))

                logger.info(f"[NotificationService] Dispatching alert '{title}' to {len(email_recipients)} emails, {len(phone_recipients)} phones, {len(push_user_ids)} push users")

                # 4. Dispatch WebPush
                for uid in push_user_ids:
                    try:
                        await self.send_push_notification(uid, title, f"{customer_identifier}: {message}", url)
                    except Exception as push_err:
                        logger.warning(f"[NotificationService] Push delivery error for {uid}: {push_err}")

                # 5. Dispatch Email (Resend HTTP API)
                email_html = f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                    <div style="margin-bottom: 20px;">
                        <span style="background-color: #001F3F; color: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                            {department.capitalize()} Alert
                        </span>
                    </div>
                    <h2 style="color: #001F3F; margin: 0 0 12px 0; font-size: 20px;">{title}</h2>
                    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">{message}</p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;"><strong>Customer:</strong> {customer_identifier}</p>
                        <p style="margin: 0; color: #64748b; font-size: 13px;"><strong>Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</p>
                    </div>

                    <a href="https://interacai.com{url}" style="background-color: #001F3F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                        Open Live Chat &rarr;
                    </a>
                    
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        InteracAI Live Agent Dispatch &bull; <a href="https://interacai.com" style="color: #64748b;">interacai.com</a>
                    </p>
                </div>
                """

                for email_addr in email_recipients:
                    try:
                        await email_service.send_email(
                            to=email_addr,
                            subject=f"[InteracAI] {title} - {customer_identifier}",
                            html_content=email_html,
                            business_id=real_business_id
                        )
                    except Exception as mail_err:
                        logger.error(f"[NotificationService] Email send error to {email_addr}: {mail_err}")

                # 6. Dispatch WhatsApp
                wa_text = f"🔔 *{title}*\n\n{message}\n\n👤 *Customer:* {customer_identifier}\n📂 *Department:* {department.capitalize()}\n🔗 *Dashboard:* https://interacai.com{url}"
                time_str = datetime.utcnow().strftime("%d %B %Y, %I:%M %p")

                for phone_num in phone_recipients:
                    if not phone_num:
                        continue
                    try:
                        # Attempt template first
                        components = [
                            {
                                "type": "body",
                                "parameters": [
                                    {"type": "text", "text": "Agent"},
                                    {"type": "text", "text": customer_identifier},
                                    {"type": "text", "text": time_str}
                                ]
                            }
                        ]
                        sent_tpl = await send_whatsapp_template(
                            to_number=phone_num,
                            template_name="interacai_agent_chat_notification",
                            language_code="en",
                            components=components,
                            business_id=real_business_id
                        )
                        if not sent_tpl:
                            # Fallback to direct text message
                            await send_whatsapp_message(
                                to_number=phone_num,
                                message_text=wa_text,
                                business_id=real_business_id
                            )
                    except Exception as wa_err:
                        logger.error(f"[NotificationService] WhatsApp send error to {phone_num}: {wa_err}")

                # 7. Record NotificationEvent for cooldown tracking
                import uuid
                dedup_key = f"{real_business_id}:{convo_id}:{int(datetime.utcnow().timestamp())}"
                evt = NotificationEvent(
                    id=str(uuid.uuid4()),
                    business_id=real_business_id,
                    conversation_id=convo_id,
                    department=department,
                    recipient=f"{len(email_recipients)} emails, {len(phone_recipients)} phones",
                    channel="all",
                    event_type="agent_owner_alert",
                    status="sent",
                    deduplication_key=dedup_key,
                    escalation_level=0,
                    sent_at=datetime.utcnow()
                )
                session.add(evt)
                await session.commit()

                return {
                    "status": "success",
                    "emails_sent": len(email_recipients),
                    "phones_sent": len(phone_recipients),
                    "push_sent": len(push_user_ids)
                }

            except Exception as e:
                logger.error(f"[NotificationService] Error in notify_agent_and_owner: {e}", exc_info=True)
                await session.rollback()
                return {"status": "error", "message": str(e)}

notification_service = NotificationService()

