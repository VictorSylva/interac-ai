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
        """Sends push notification to all agents in a specific department."""
        async with AsyncSessionLocal() as session:
            try:
                # Find all agents in the department for this business
                from database.models.general import User
                stmt = select(User.id).where(User.business_id == business_id, User.role == "agent")
                if department and department != "general":
                    from sqlalchemy import or_
                    # Notify agents in the specific department OR agents with no assigned department (generalists)
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

notification_service = NotificationService()
