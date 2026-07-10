from sqlalchemy import select, func, delete, text, update
from database.session import AsyncSessionLocal
from database.models.general import Business, User, BusinessSettings, KnowledgeDoc, BusinessWhatsAppConfig
from database.models.chat import Message, Conversation
from database.models.workflow import Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, ExecutionStep
from database.models.crm import Lead, Ticket, LeadActivity
from database.models.scheduling import AppointmentType, AvailabilityRule, Appointment
from database.models.sales import Offer, SalesPage, Order, Delivery
from database.models.behavior_analytics import BASession, BAEvent, BAAggregate
from database.models.admin import SystemLog, WebhookLog
from database.models.billing import BusinessSubscription, SubscriptionPlan, TokenWallet, TokenTransaction
from database.models.payment import PaymentTransaction
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class AdminService:
    async def check_is_super_admin(self, user_id: str):
        """Checks if a user has the super_admin role in SQL."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(User).where(User.id == user_id)
                result = await session.execute(stmt)
                user = result.scalar_one_or_none()
                return user and user.role in ["super_admin", "admin"]
            except Exception as e:
                logger.error(f"Error checking admin status: {e}")
                return False

    async def get_all_businesses(self, include_deleted: bool = False):
        """Fetches all businesses from the SQL database with billing info."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(Business, BusinessSubscription, SubscriptionPlan).join(
                    BusinessSubscription, Business.id == BusinessSubscription.business_id, isouter=True
                ).join(
                    SubscriptionPlan, BusinessSubscription.plan_id == SubscriptionPlan.id, isouter=True
                )
                
                if not include_deleted:
                    stmt = stmt.where(Business.is_deleted == False)
                
                result = await session.execute(stmt)
                rows = result.all()
                
                return [{
                    "business_id": b.id,
                    "name": b.name,
                    "is_deleted": b.is_deleted,
                    "created_at": b.created_at,
                    "status": sub.status if sub else "expired",
                    "plan_name": plan.id if plan else "starter"
                } for b, sub, plan in rows]
            except Exception as e:
                logger.error(f"Error fetching all businesses: {e}")
                return []

    async def update_business_status(self, business_id: str, status: str, admin_id: str = None):
        """Updates the status of a business (active, suspended, etc) in the subscription table."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == business_id)
                result = await session.execute(stmt)
                sub = result.scalar_one_or_none()
                if not sub:
                    from services.db_service import resolve_business_id
                    bid = await resolve_business_id(business_id)
                    stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == bid)
                    result = await session.execute(stmt)
                    sub = result.scalar_one_or_none()
                    if not sub: return False
                
                old_status = sub.status
                sub.status = status
                
                # Log action
                log = SystemLog(
                    admin_id=admin_id,
                    action="update_business_status",
                    target_id=business_id,
                    details={"old_status": old_status, "new_status": status}
                )
                session.add(log)
                
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error updating business status: {e}")
                await session.rollback()
                return False

    async def soft_delete_business(self, business_id: str, admin_id: str = None):
        """Marks a business as deleted and deactivates its subscription."""
        async with AsyncSessionLocal() as session:
            try:
                from services.db_service import resolve_business_id
                bid = await resolve_business_id(business_id)
                
                # 1. Mark Business as deleted
                stmt = update(Business).where(Business.id == bid).values(is_deleted=True)
                await session.execute(stmt)
                
                # 2. Deactivate Subscription
                stmt_sub = update(BusinessSubscription).where(BusinessSubscription.business_id == bid).values(status="canceled")
                await session.execute(stmt_sub)
                
                # 3. Log action
                log = SystemLog(
                    admin_id=admin_id,
                    action="soft_delete_business",
                    target_id=bid,
                    details={"business_id": business_id}
                )
                session.add(log)
                
                await session.commit()
                logger.info(f"Admin: Soft deleted business {bid}")
                return True
            except Exception as e:
                logger.error(f"Error soft deleting business {business_id}: {e}")
                await session.rollback()
                return False

    async def reactivate_business(self, business_id: str, admin_id: str = None):
        """Restores a soft-deleted business."""
        async with AsyncSessionLocal() as session:
            try:
                from services.db_service import resolve_business_id
                bid = await resolve_business_id(business_id)
                
                stmt = update(Business).where(Business.id == bid).values(is_deleted=False)
                await session.execute(stmt)
                
                stmt_sub = update(BusinessSubscription).where(BusinessSubscription.business_id == bid).values(status="active")
                await session.execute(stmt_sub)
                
                log = SystemLog(
                    admin_id=admin_id,
                    action="reactivate_business",
                    target_id=bid,
                    details={"business_id": business_id}
                )
                session.add(log)
                
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error reactivating business {business_id}: {e}")
                await session.rollback()
                return False

    async def get_all_payments(self, limit: int = 50):
        """Fetches recent payment transactions."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(PaymentTransaction, Business.name).join(
                    Business, PaymentTransaction.business_id == Business.id
                ).order_by(PaymentTransaction.created_at.desc()).limit(limit)
                result = await session.execute(stmt)
                rows = result.all()
                return [{
                    "id": p.id,
                    "business_name": b_name,
                    "amount": p.amount,
                    "currency": p.currency,
                    "status": p.status,
                    "reference": p.reference,
                    "created_at": p.created_at
                } for p, b_name in rows]
            except Exception as e:
                logger.error(f"Error fetching payments: {e}")
                return []

    async def get_system_logs(self, limit: int = 50):
        """Fetches recent system logs."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(SystemLog, User.email).join(
                    User, SystemLog.admin_id == User.id, isouter=True
                ).order_by(SystemLog.created_at.desc()).limit(limit)
                result = await session.execute(stmt)
                rows = result.all()
                return [{
                    "id": log.id,
                    "admin_email": email or "System",
                    "action": log.action,
                    "target_id": log.target_id,
                    "details": log.details,
                    "created_at": log.created_at
                } for log, email in rows]
            except Exception as e:
                logger.error(f"Error fetching logs: {e}")
                return []

    async def get_webhook_logs(self, limit: int = 50):
        """Fetches recent webhook logs."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(WebhookLog).order_by(WebhookLog.created_at.desc()).limit(limit)
                result = await session.execute(stmt)
                return [row for row in result.scalars().all()]
            except Exception as e:
                logger.error(f"Error fetching webhook logs: {e}")
                return []

    async def manual_token_credit(self, business_id: str, amount: int, admin_id: str = None):
        """Manually credits tokens to a business."""
        from services.token_service import token_service
        async with AsyncSessionLocal() as session:
            try:
                from services.db_service import resolve_business_id
                bid = await resolve_business_id(business_id)
                
                # Check wallet exists
                stmt = select(TokenWallet).where(TokenWallet.business_id == bid)
                res = await session.execute(stmt)
                wallet = res.scalar_one_or_none()
                if not wallet:
                    wallet = TokenWallet(business_id=bid, sub_balance=0, payg_balance=0)
                    session.add(wallet)
                
                wallet.payg_balance += amount
                
                # Record transaction
                transaction = TokenTransaction(
                    business_id=bid,
                    amount=amount,
                    token_pool="payg",
                    action_type="manual_credit",
                    transaction_metadata={"admin_id": admin_id}
                )
                session.add(transaction)
                
                # System Log
                log = SystemLog(
                    admin_id=admin_id,
                    action="manual_token_credit",
                    target_id=bid,
                    details={"amount": amount}
                )
                session.add(log)
                
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error crediting tokens: {e}")
                await session.rollback()
                return False

    async def get_platform_stats(self):
        """Aggregates platform-wide stats from SQL."""
        async with AsyncSessionLocal() as session:
            try:
                total_businesses = (await session.execute(select(func.count(Business.id)).where(Business.is_deleted == False))).scalar() or 0
                total_users = (await session.execute(select(func.count(User.id)))).scalar() or 0
                total_messages = (await session.execute(select(func.count(Message.id)))).scalar() or 0
                total_revenue = (await session.execute(select(func.sum(PaymentTransaction.amount)).where(PaymentTransaction.status == "success"))).scalar() or 0

                return {
                    "total_businesses": total_businesses,
                    "total_users": total_users,
                    "total_messages_processed": total_messages,
                    "total_revenue": total_revenue,
                    "active_subscriptions": total_businesses # Placeholder
                }
            except Exception as e:
                logger.error(f"Error getting platform stats: {e}")
                return {
                    "total_businesses": 0, "total_users": 0, "total_messages_processed": 0, "total_revenue": 0, "active_subscriptions": 0
                }

admin_service = AdminService()
