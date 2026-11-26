from sqlalchemy import select, func, delete, text, update
from database.session import AsyncSessionLocal
from database.models.general import Business, User, BusinessSettings, KnowledgeDoc, BusinessWhatsAppConfig, Property, Role
from database.models.chat import Message, Conversation
from database.models.workflow import Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, ExecutionStep
from database.models.crm import Lead, Ticket, LeadActivity
from database.models.scheduling import AppointmentType, AvailabilityRule, Appointment
from database.models.sales import Offer, SalesPage, Order, Delivery
from database.models.behavior_analytics import BASession, BAEvent, BAAggregate
from database.models.admin import SystemLog, WebhookLog
from database.models.billing import BusinessSubscription, SubscriptionPlan, TokenWallet, TokenTransaction, BusinessUsageMetrics
from database.models.payment import PaymentTransaction
from database.models.entitlement import (
    BusinessEntitlement, EntitlementOverride, AdminAuditLog, CommercialProfile,
    CustomInvoice, CustomInvoiceItem, SignalAuditLead
)
from services.entitlement_service import entitlement_service, INDUSTRY_CAPABILITIES_CATALOG
import logging
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger(__name__)

class AdminService:
    async def check_is_super_admin(self, user_id: str):
        """Checks if a user has super_admin, admin, or platform master privileges."""
        if not user_id or str(user_id).strip().lower() in ["undefined", "null", ""]:
            return False
            
        clean_id = str(user_id).strip()
        # Direct email / master check
        if clean_id.lower() in ["interacai.int@gmail.com", "mbasitisylva@gmail.com"]:
            return True
            
        async with AsyncSessionLocal() as session:
            try:
                from sqlalchemy import or_
                stmt = select(User).where(or_(User.id == clean_id, User.email.ilike(clean_id)))
                result = await session.execute(stmt)
                user = result.scalar_one_or_none()
                if user:
                    return (
                        user.role == "super_admin" or
                        user.email.lower() in ["interacai.int@gmail.com", "mbasitisylva@gmail.com"] or
                        (user.business_id in ["0bbd48c4-b066-435a-be3d-c095b55897c6", "INTERAC_HQ"] and user.role in ["super_admin", "admin"])
                    )
                return False
            except Exception as e:
                logger.error(f"Error checking admin status: {e}")
                return False

    async def get_all_businesses(self, include_deleted: bool = False):
        """Fetches all businesses enriched with commercial profile & usage limits."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(
                    Business, BusinessSettings, CommercialProfile, BusinessSubscription, TokenWallet
                ).join(
                    BusinessSettings, Business.id == BusinessSettings.business_id, isouter=True
                ).join(
                    CommercialProfile, Business.id == CommercialProfile.business_id, isouter=True
                ).join(
                    BusinessSubscription, Business.id == BusinessSubscription.business_id, isouter=True
                ).join(
                    TokenWallet, Business.id == TokenWallet.business_id, isouter=True
                )
                
                if not include_deleted:
                    stmt = stmt.where(Business.is_deleted == False)
                
                result = await session.execute(stmt)
                rows = result.all()
                
                # Fetch primary user / owner emails mapped to business
                user_stmt = select(User.business_id, User.email).where(User.business_id.isnot(None))
                user_res = await session.execute(user_stmt)
                biz_emails = {}
                for ubid, uemail in user_res.all():
                    if ubid and ubid not in biz_emails:
                        biz_emails[ubid] = uemail
                
                businesses = []
                for b, s, cp, sub, w in rows:
                    total_tokens = (w.sub_balance or 0) + (w.payg_balance or 0) if w else 0
                    businesses.append({
                        "business_id": b.id,
                        "name": b.name,
                        "owner_email": biz_emails.get(b.id),
                        "is_deleted": b.is_deleted,
                        "created_at": b.created_at.isoformat() if b.created_at else None,
                        "industry": s.industry if s and s.industry else "general",
                        "installed_modules": s.installed_modules if s and s.installed_modules else [],
                        "status": sub.status if sub else "active",
                        "commercial_status": cp.commercial_status if cp else "customer_active",
                        "billing_interval": cp.billing_interval if cp else "monthly",
                        "account_manager": cp.account_manager_name if cp else "Victor Sylva",
                        "pilot_enabled": cp.pilot_enabled if cp else False,
                        "pilot_end_date": cp.pilot_end_date.isoformat() if cp and cp.pilot_end_date else None,
                        "conversations_used": sub.conversations_used if sub else 0,
                        "tokens_available": total_tokens
                    })
                return businesses
            except Exception as e:
                logger.error(f"Error fetching all businesses: {e}", exc_info=True)
                return []

    async def get_business_detail(self, business_id: str):
        """Fetches full operational bundle for a business."""
        from services.db_service import resolve_business_id
        real_id = await resolve_business_id(business_id)
        bundle = await entitlement_service.get_business_entitlement_bundle(real_id)
        
        async with AsyncSessionLocal() as session:
            # Also get staff list
            stmt_users = select(User).where(User.business_id == real_id)
            res_users = await session.execute(stmt_users)
            users = res_users.scalars().all()
            bundle["staff_members"] = [{
                "id": u.id,
                "email": u.email,
                "role": u.role,
                "department": u.department or "general",
                "status": u.status
            } for u in users]
            
            # Catalog template for this business industry
            ind = bundle.get("industry", "general")
            bundle["catalog_template"] = INDUSTRY_CAPABILITIES_CATALOG.get(ind, INDUSTRY_CAPABILITIES_CATALOG["general"])
            
        return bundle

    async def update_business_status(self, business_id: str, status: str, admin_id: str = None, reason: str = None):
        """Updates the status of a business (active, suspended, etc)."""
        async with AsyncSessionLocal() as session:
            try:
                from services.db_service import resolve_business_id
                bid = await resolve_business_id(business_id)
                
                # Update subscription status
                stmt = select(BusinessSubscription).where(BusinessSubscription.business_id == bid)
                result = await session.execute(stmt)
                sub = result.scalar_one_or_none()
                if sub:
                    old_status = sub.status
                    sub.status = status
                else:
                    old_status = "unknown"
                    sub = BusinessSubscription(business_id=bid, status=status)
                    session.add(sub)
                
                # Update CommercialProfile status
                cp_stmt = select(CommercialProfile).where(CommercialProfile.business_id == bid)
                cp_res = await session.execute(cp_stmt)
                cp = cp_res.scalar_one_or_none()
                if cp:
                    cp.commercial_status = "suspended" if status == "suspended" else "customer_active"
                
                # Log audit
                audit = AdminAuditLog(
                    admin_id=admin_id,
                    business_id=bid,
                    action="business.status_update",
                    target_resource=f"business:{bid}:status",
                    previous_state={"status": old_status},
                    new_state={"status": status},
                    reason=reason or f"Administrative status change to {status}"
                )
                session.add(audit)
                
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error updating business status: {e}")
                await session.rollback()
                return False

    async def update_commercial_profile(self, business_id: str, profile_data: dict, admin_id: str = None):
        """Updates commercial parameters, pilot dates, or account manager."""
        async with AsyncSessionLocal() as session:
            try:
                from services.db_service import resolve_business_id
                bid = await resolve_business_id(business_id)
                
                stmt = select(CommercialProfile).where(CommercialProfile.business_id == bid)
                res = await session.execute(stmt)
                profile = res.scalar_one_or_none()
                
                if not profile:
                    profile = CommercialProfile(business_id=bid)
                    session.add(profile)
                
                prev = {
                    "commercial_status": profile.commercial_status,
                    "pilot_enabled": profile.pilot_enabled,
                    "billing_interval": profile.billing_interval
                }
                
                if "commercial_status" in profile_data: profile.commercial_status = profile_data["commercial_status"]
                if "billing_interval" in profile_data: profile.billing_interval = profile_data["billing_interval"]
                if "account_manager_name" in profile_data: profile.account_manager_name = profile_data["account_manager_name"]
                if "business_size" in profile_data: profile.business_size = profile_data["business_size"]
                if "num_employees" in profile_data: profile.num_employees = profile_data["num_employees"]
                if "num_branches" in profile_data: profile.num_branches = profile_data["num_branches"]
                if "pilot_enabled" in profile_data: profile.pilot_enabled = bool(profile_data["pilot_enabled"])
                if "pilot_notes" in profile_data: profile.pilot_notes = profile_data["pilot_notes"]
                
                if profile_data.get("pilot_start_date"):
                    try: profile.pilot_start_date = datetime.fromisoformat(profile_data["pilot_start_date"])
                    except Exception: pass
                if profile_data.get("pilot_end_date"):
                    try: profile.pilot_end_date = datetime.fromisoformat(profile_data["pilot_end_date"])
                    except Exception: pass

                audit = AdminAuditLog(
                    admin_id=admin_id,
                    business_id=bid,
                    action="commercial_profile.update",
                    target_resource=f"commercial_profile:{bid}",
                    previous_state=prev,
                    new_state=profile_data,
                    reason="Commercial profile adjustment"
                )
                session.add(audit)
                
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error updating commercial profile for {business_id}: {e}")
                await session.rollback()
                return False

    async def soft_delete_business(self, business_id: str, admin_id: str = None, reason: str = None):
        """Marks a business as deleted."""
        async with AsyncSessionLocal() as session:
            try:
                from services.db_service import resolve_business_id
                bid = await resolve_business_id(business_id)
                
                stmt = update(Business).where(Business.id == bid).values(is_deleted=True)
                await session.execute(stmt)
                
                stmt_sub = update(BusinessSubscription).where(BusinessSubscription.business_id == bid).values(status="canceled")
                await session.execute(stmt_sub)
                
                audit = AdminAuditLog(
                    admin_id=admin_id,
                    business_id=bid,
                    action="business.soft_delete",
                    target_resource=f"business:{bid}",
                    reason=reason or "Administrative business deletion"
                )
                session.add(audit)
                
                await session.commit()
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
                
                audit = AdminAuditLog(
                    admin_id=admin_id,
                    business_id=bid,
                    action="business.reactivate",
                    target_resource=f"business:{bid}",
                    reason="Administrative business restoration"
                )
                session.add(audit)
                
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error reactivating business {business_id}: {e}")
                await session.rollback()
                return False

    async def hard_delete_business(self, business_id: str, admin_id: str = None, reason: str = None):
        """
        Permanently purges a business tenant and all associated records 
        (users, billing, settings, chats, workflows, etc.) from the database.
        Frees up user email addresses for immediate reuse.
        """
        from services.db_service import resolve_business_id
        bid = await resolve_business_id(business_id)

        # Safety Check: Never allow deleting the primary HQ system business
        if str(bid).upper() in ["INTERAC_HQ", "0BBD48C4-B066-435A-BE3D-C095B55897C6"]:
            raise ValueError("Cannot permanently delete the primary InteracAI HQ system business.")

        async with AsyncSessionLocal() as session:
            try:
                # 1. Check if business exists
                res_biz = await session.execute(text("SELECT id, name FROM businesses WHERE id = :bid"), {"bid": bid})
                biz_row = res_biz.first()
                if not biz_row:
                    logger.warning(f"Business {bid} not found for permanent deletion.")
                    return False
                biz_name = biz_row[1]

                # 2. Get all user emails belonging to this business for logging
                res_users = await session.execute(text("SELECT id, email FROM users WHERE business_id = :bid"), {"bid": bid})
                user_rows = res_users.fetchall()
                user_emails = [r[1] for r in user_rows]
                logger.info(f"Purging business {biz_name} ({bid}) and associated users: {user_emails}")

                # 3. Clean up user-dependent records first
                # Push subscriptions & login audit logs
                await session.execute(text("""
                    DELETE FROM push_subscriptions WHERE user_id IN (
                        SELECT id FROM users WHERE business_id = :bid
                    )
                """), {"bid": bid})

                try:
                    await session.execute(text("""
                        DELETE FROM login_audit_logs WHERE user_id IN (
                            SELECT id FROM users WHERE business_id = :bid
                        )
                    """), {"bid": bid})
                except Exception:
                    pass

                # Nullify references in admin_audit_logs and system_logs so foreign keys don't fail
                try:
                    await session.execute(text("""
                        UPDATE admin_audit_logs SET admin_id = NULL WHERE admin_id IN (
                            SELECT id FROM users WHERE business_id = :bid
                        )
                    """), {"bid": bid})
                except Exception:
                    pass

                try:
                    await session.execute(text("""
                        UPDATE system_logs SET admin_id = NULL WHERE admin_id IN (
                            SELECT id FROM users WHERE business_id = :bid
                        )
                    """), {"bid": bid})
                except Exception:
                    pass

                # 4. Clean up child records of child records:
                # Sales orders -> sales deliveries
                try:
                    await session.execute(text("""
                        DELETE FROM sales_deliveries WHERE order_id IN (
                            SELECT id FROM sales_orders WHERE business_id = :bid
                        )
                    """), {"bid": bid})
                except Exception as e:
                    logger.warning(f"Error clearing sales_deliveries: {e}")

                # Sales tables
                for tbl in ["sales_orders", "sales_pages", "sales_offers"]:
                    try:
                        await session.execute(text(f"DELETE FROM {tbl} WHERE business_id = :bid"), {"bid": bid})
                    except Exception as e:
                        logger.warning(f"Error clearing {tbl}: {e}")

                # Workflows: execution_steps -> workflow_executions, workflow_edges, workflow_nodes -> workflows
                try:
                    await session.execute(text("""
                        DELETE FROM execution_steps WHERE execution_id IN (
                            SELECT id FROM workflow_executions WHERE business_id = :bid
                        )
                    """), {"bid": bid})
                except Exception as e:
                    logger.warning(f"Error clearing execution_steps: {e}")

                try:
                    await session.execute(text("DELETE FROM workflow_executions WHERE business_id = :bid"), {"bid": bid})
                except Exception as e:
                    logger.warning(f"Error clearing workflow_executions: {e}")

                try:
                    await session.execute(text("""
                        DELETE FROM workflow_edges WHERE workflow_id IN (
                            SELECT id FROM workflows WHERE business_id = :bid
                        )
                    """), {"bid": bid})
                    await session.execute(text("""
                        DELETE FROM workflow_nodes WHERE workflow_id IN (
                            SELECT id FROM workflows WHERE business_id = :bid
                        )
                    """), {"bid": bid})
                    await session.execute(text("DELETE FROM workflows WHERE business_id = :bid"), {"bid": bid})
                except Exception as e:
                    logger.warning(f"Error clearing workflows: {e}")

                # Behavior Analytics
                for tbl in ["ba_events", "ba_sessions", "ba_aggregates"]:
                    try:
                        await session.execute(text(f"DELETE FROM {tbl} WHERE business_id = :bid"), {"bid": bid})
                    except Exception as e:
                        logger.warning(f"Error clearing {tbl}: {e}")

                # Appointments & Scheduling
                for tbl in ["appointments", "availability_rules", "appointment_types"]:
                    try:
                        await session.execute(text(f"DELETE FROM {tbl} WHERE business_id = :bid"), {"bid": bid})
                    except Exception as e:
                        logger.warning(f"Error clearing {tbl}: {e}")

                # CRM & Activities
                for tbl in ["lead_activities", "tickets", "leads"]:
                    try:
                        await session.execute(text(f"DELETE FROM {tbl} WHERE business_id = :bid"), {"bid": bid})
                    except Exception as e:
                        logger.warning(f"Error clearing {tbl}: {e}")

                # Chat & Notifications
                for tbl in ["business_notification_events", "messages", "conversations"]:
                    try:
                        await session.execute(text(f"DELETE FROM {tbl} WHERE business_id = :bid"), {"bid": bid})
                    except Exception as e:
                        logger.warning(f"Error clearing {tbl}: {e}")

                # Invoicing
                try:
                    await session.execute(text("""
                        DELETE FROM custom_invoice_items WHERE invoice_id IN (
                            SELECT id FROM custom_invoices WHERE business_id = :bid
                        )
                    """), {"bid": bid})
                    await session.execute(text("DELETE FROM custom_invoices WHERE business_id = :bid"), {"bid": bid})
                except Exception as e:
                    logger.warning(f"Error clearing custom_invoices: {e}")

                # Entitlements & Overrides
                for tbl in ["entitlement_overrides", "business_entitlements", "commercial_profiles"]:
                    try:
                        await session.execute(text(f"DELETE FROM {tbl} WHERE business_id = :bid"), {"bid": bid})
                    except Exception as e:
                        logger.warning(f"Error clearing {tbl}: {e}")

                # Billing & Subscriptions
                for tbl in [
                    "payment_transactions", "token_transactions", "token_wallets", 
                    "business_usage_metrics", "business_subscriptions"
                ]:
                    try:
                        await session.execute(text(f"DELETE FROM {tbl} WHERE business_id = :bid"), {"bid": bid})
                    except Exception as e:
                        logger.warning(f"Error clearing {tbl}: {e}")

                # Business Configs & General
                for tbl in [
                    "business_whatsapp_configs", "business_meta_configs", "business_email_configs",
                    "business_department_configs", "business_settings", "knowledge_docs",
                    "properties", "user_invitations"
                ]:
                    try:
                        await session.execute(text(f"DELETE FROM {tbl} WHERE business_id = :bid"), {"bid": bid})
                    except Exception as e:
                        logger.warning(f"Error clearing {tbl}: {e}")

                # Delete audit logs targeting this business so foreign key doesn't block deletion
                try:
                    await session.execute(text("DELETE FROM admin_audit_logs WHERE business_id = :bid"), {"bid": bid})
                except Exception as e:
                    logger.warning(f"Error clearing admin_audit_logs for business {bid}: {e}")

                # Delete Users for this business (frees the email address)
                await session.execute(text("DELETE FROM users WHERE business_id = :bid"), {"bid": bid})

                # Delete Roles
                try:
                    await session.execute(text("DELETE FROM roles WHERE business_id = :bid"), {"bid": bid})
                except Exception as e:
                    logger.warning(f"Error clearing roles: {e}")

                # Finally, delete Business itself
                await session.execute(text("DELETE FROM businesses WHERE id = :bid"), {"bid": bid})

                # Record an audit log for this permanent deletion (with business_id=None)
                try:
                    audit = AdminAuditLog(
                        admin_id=admin_id,
                        business_id=None,
                        action="business.permanent_delete",
                        target_resource=f"business:{bid}",
                        reason=reason or f"Permanently deleted business '{biz_name}' ({bid}) and freed emails ({', '.join(user_emails)})"
                    )
                    session.add(audit)
                except Exception as e:
                    logger.warning(f"Could not write audit log for permanent deletion: {e}")

                await session.commit()
                logger.info(f"✅ Successfully permanently deleted business '{biz_name}' ({bid}) and all related records.")
                return True
            except Exception as e:
                logger.error(f"Error permanently deleting business {business_id}: {e}", exc_info=True)
                await session.rollback()
                raise

    async def manual_token_credit(self, business_id: str, amount: int, admin_id: str = None, reason: str = None):
        """Manually credits tokens to a business wallet with full audit trail."""
        from services.token_service import token_service
        from services.db_service import resolve_business_id
        bid = await resolve_business_id(business_id)
        
        success = await token_service.refill_tokens(
            business_id=bid,
            amount=amount,
            pool="payg",
            action_type="manual_admin_credit",
            metadata={"admin_id": admin_id, "reason": reason}
        )
        
        if success:
            async with AsyncSessionLocal() as session:
                audit = AdminAuditLog(
                    admin_id=admin_id,
                    business_id=bid,
                    action="tokens.manual_credit",
                    target_resource=f"wallet:{bid}",
                    new_state={"credited_amount": amount},
                    reason=reason or f"Manual allowance credit of {amount} tokens"
                )
                session.add(audit)
                await session.commit()
        return success

    # --- Custom Invoicing Management ---
    async def create_custom_invoice(self, invoice_data: dict, admin_id: str = None):
        """Generates an itemized enterprise invoice."""
        async with AsyncSessionLocal() as session:
            try:
                from services.db_service import resolve_business_id
                bid = await resolve_business_id(invoice_data["business_id"])
                
                inv_id = str(uuid.uuid4())
                inv_number = f"INV-{datetime.utcnow().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
                
                items_data = invoice_data.get("items", [])
                total = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items_data)
                
                invoice = CustomInvoice(
                    id=inv_id,
                    business_id=bid,
                    invoice_number=inv_number,
                    title=invoice_data.get("title", "InteracAI Custom Operating System Agreement"),
                    currency=invoice_data.get("currency", "NGN"),
                    total_amount=total,
                    status=invoice_data.get("status", "issued"),
                    due_date=datetime.utcnow() + timedelta(days=14),
                    entitlements_snapshot=invoice_data.get("entitlements_snapshot", {}),
                    notes=invoice_data.get("notes"),
                    created_by=admin_id
                )
                session.add(invoice)
                
                for item in items_data:
                    q = item.get("quantity", 1)
                    up = item.get("unit_price", 0.0)
                    inv_item = CustomInvoiceItem(
                        invoice_id=inv_id,
                        description=item.get("description", "Custom Capability"),
                        quantity=q,
                        unit_price=up,
                        total_price=q * up
                    )
                    session.add(inv_item)

                audit = AdminAuditLog(
                    admin_id=admin_id,
                    business_id=bid,
                    action="invoice.create",
                    target_resource=f"invoice:{inv_number}",
                    new_state={"invoice_number": inv_number, "total": total},
                    reason="Enterprise invoice generated"
                )
                session.add(audit)
                
                await session.commit()
                return {"status": "success", "invoice_id": inv_id, "invoice_number": inv_number, "total": total}
            except Exception as e:
                logger.error(f"Error creating custom invoice: {e}")
                await session.rollback()
                return None

    async def list_custom_invoices(self, business_id: str = None, limit: int = 50):
        """Lists custom invoices with item details."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(CustomInvoice, Business.name).join(
                    Business, CustomInvoice.business_id == Business.id
                ).order_by(CustomInvoice.created_at.desc()).limit(limit)
                
                if business_id:
                    from services.db_service import resolve_business_id
                    bid = await resolve_business_id(business_id)
                    stmt = stmt.where(CustomInvoice.business_id == bid)
                    
                res = await session.execute(stmt)
                rows = res.all()
                
                invoices = []
                for inv, b_name in rows:
                    # Fetch items
                    items_stmt = select(CustomInvoiceItem).where(CustomInvoiceItem.invoice_id == inv.id)
                    items_res = await session.execute(items_stmt)
                    items = items_res.scalars().all()
                    
                    invoices.append({
                        "id": inv.id,
                        "invoice_number": inv.invoice_number,
                        "business_id": inv.business_id,
                        "business_name": b_name,
                        "title": inv.title,
                        "currency": inv.currency,
                        "total_amount": inv.total_amount,
                        "status": inv.status,
                        "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
                        "due_date": inv.due_date.isoformat() if inv.due_date else None,
                        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
                        "payment_reference": inv.payment_reference,
                        "notes": inv.notes,
                        "items": [{
                            "description": it.description,
                            "quantity": it.quantity,
                            "unit_price": it.unit_price,
                            "total_price": it.total_price
                        } for it in items]
                    })
                return invoices
            except Exception as e:
                logger.error(f"Error listing custom invoices: {e}")
                return []

    async def approve_and_provision_invoice(self, invoice_id: str, admin_id: str = None, payment_reference: str = None):
        """Approves payment for custom invoice and activates associated entitlements."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(CustomInvoice).where(CustomInvoice.id == invoice_id)
                res = await session.execute(stmt)
                inv = res.scalar_one_or_none()
                if not inv:
                    return False
                
                inv.status = "paid"
                inv.paid_at = datetime.utcnow()
                inv.payment_reference = payment_reference or f"MANUAL_APPROVE_{datetime.utcnow().timestamp()}"
                
                # Provision any configured entitlements snapshot
                if inv.entitlements_snapshot:
                    ents = inv.entitlements_snapshot.get("entitlements", [])
                    if ents:
                        await entitlement_service.set_entitlements_for_business(
                            business_id=inv.business_id,
                            entitlements_list=ents,
                            admin_id=admin_id,
                            reason=f"Fulfilled custom invoice {inv.invoice_number}"
                        )
                
                audit = AdminAuditLog(
                    admin_id=admin_id,
                    business_id=inv.business_id,
                    action="invoice.approve_payment",
                    target_resource=f"invoice:{inv.invoice_number}",
                    new_state={"status": "paid", "paid_at": inv.paid_at.isoformat()},
                    reason="Invoice marked as paid and entitlements activated"
                )
                session.add(audit)
                
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error approving custom invoice {invoice_id}: {e}")
                await session.rollback()
                return False

    # --- Compliance Audit Logs ---
    async def get_admin_audit_logs(self, business_id: str = None, limit: int = 100):
        """Fetches compliance audit records."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit)
                if business_id:
                    from services.db_service import resolve_business_id
                    bid = await resolve_business_id(business_id)
                    stmt = stmt.where(AdminAuditLog.business_id == bid)
                    
                res = await session.execute(stmt)
                logs = res.scalars().all()
                return [{
                    "id": l.id,
                    "admin_id": l.admin_id,
                    "admin_email": l.admin_email or "admin@interac.ai",
                    "business_id": l.business_id,
                    "action": l.action,
                    "target_resource": l.target_resource,
                    "previous_state": l.previous_state,
                    "new_state": l.new_state,
                    "reason": l.reason,
                    "created_at": l.created_at.isoformat() if l.created_at else None
                } for l in logs]
            except Exception as e:
                logger.error(f"Error fetching admin audit logs: {e}")
                return []

    # --- Signal Audit Leads ---
    async def submit_signal_audit_lead(self, lead_data: dict):
        """Stores prospective business signal audit request."""
        async with AsyncSessionLocal() as session:
            try:
                lead = SignalAuditLead(
                    business_name=lead_data["business_name"],
                    contact_name=lead_data["contact_name"],
                    email=lead_data["email"],
                    phone=lead_data.get("phone"),
                    industry=lead_data.get("industry", "general"),
                    employee_count=lead_data.get("employee_count"),
                    primary_challenges=lead_data.get("primary_challenges", []),
                    current_systems=lead_data.get("current_systems"),
                    audit_scope=lead_data.get("audit_scope")
                )
                session.add(lead)
                await session.commit()
                await session.refresh(lead)
                return {"status": "success", "lead_id": lead.id}
            except Exception as e:
                logger.error(f"Error submitting signal audit lead: {e}")
                await session.rollback()
                return None

    async def list_signal_audit_leads(self, limit: int = 50):
        """Lists incoming business audit requests."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(SignalAuditLead).order_by(SignalAuditLead.created_at.desc()).limit(limit)
                res = await session.execute(stmt)
                leads = res.scalars().all()
                return [{
                    "id": l.id,
                    "business_name": l.business_name,
                    "contact_name": l.contact_name,
                    "email": l.email,
                    "phone": l.phone,
                    "industry": l.industry,
                    "employee_count": l.employee_count,
                    "primary_challenges": l.primary_challenges,
                    "current_systems": l.current_systems,
                    "audit_scope": l.audit_scope,
                    "status": l.status,
                    "created_at": l.created_at.isoformat() if l.created_at else None
                } for l in leads]
            except Exception as e:
                logger.error(f"Error listing signal audit leads: {e}")
                return []

    async def update_signal_audit_lead_status(self, lead_id: str, status: str, admin_id: str = None):
        """Updates lead lifecycle stage."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(SignalAuditLead).where(SignalAuditLead.id == lead_id)
                res = await session.execute(stmt)
                lead = res.scalar_one_or_none()
                if not lead: return False
                lead.status = status
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error updating lead status: {e}")
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
                    "created_at": p.created_at.isoformat() if p.created_at else None
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
                    "created_at": log.created_at.isoformat() if log.created_at else None
                } for log, email in rows]
            except Exception as e:
                logger.error(f"Error fetching logs: {e}")
                return []

    async def get_platform_stats(self):
        """Aggregates platform-wide stats."""
        async with AsyncSessionLocal() as session:
            try:
                total_businesses = (await session.execute(select(func.count(Business.id)).where(Business.is_deleted == False))).scalar() or 0
                total_users = (await session.execute(select(func.count(User.id)))).scalar() or 0
                total_messages = (await session.execute(select(func.count(Message.id)))).scalar() or 0
                total_revenue = (await session.execute(select(func.sum(PaymentTransaction.amount)).where(PaymentTransaction.status == "success"))).scalar() or 0
                total_audits = (await session.execute(select(func.count(SignalAuditLead.id)))).scalar() or 0

                return {
                    "total_businesses": total_businesses,
                    "total_users": total_users,
                    "total_messages_processed": total_messages,
                    "total_revenue": total_revenue,
                    "total_signal_audits": total_audits,
                    "active_operating_tenants": total_businesses
                }
            except Exception as e:
                logger.error(f"Error getting platform stats: {e}")
                return {
                    "total_businesses": 0, "total_users": 0, "total_messages_processed": 0, "total_revenue": 0, "total_signal_audits": 0, "active_operating_tenants": 0
                }

admin_service = AdminService()
