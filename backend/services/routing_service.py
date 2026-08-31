import logging
from datetime import datetime, timedelta
from sqlalchemy import select, text
from database.session import AsyncSessionLocal
from database.models.general import User, DepartmentConfig, NotificationEvent, BusinessSettings
from database.models.chat import Conversation

logger = logging.getLogger(__name__)

class DepartmentRoutingService:
    @staticmethod
    async def resolve_recipient(business_id: str, department: str, conversation_id: str = None, property_id: str = None):
        """
        Resolves the recipient destination for a notification using the 6-level hierarchy:
        Level 1: Assigned agent on the active conversation.
        Level 2: Department primary agent.
        Level 3: Department WhatsApp notification number.
        Level 4: Department Email address.
        Level 5: Business owner fallback.
        Level 6: System fallback.
        """
        from services.db_service import resolve_business_id
        real_business_id = await resolve_business_id(business_id)
        
        phone = None
        email = None
        recipient_name = "Agent"
        routing_reason = "System fallback"
        recipient_id = None
        recipient_type = "system"
        
        async with AsyncSessionLocal() as session:
            try:
                # Level 1: Explicit Conversation Assignment
                if conversation_id:
                    convo = await session.get(Conversation, conversation_id)
                    if convo and convo.assigned_agent_id:
                        agent = await session.get(User, convo.assigned_agent_id)
                        if agent and agent.receive_operational_alerts:
                            # Verify property matching if property_id is specified
                            if not property_id or agent.property_id == property_id:
                                phone = agent.phone
                                email = agent.email
                                recipient_name = agent.email.split("@")[0].capitalize()
                                recipient_id = agent.id
                                recipient_type = "assigned_agent"
                                routing_reason = f"Level 1: Assigned Agent ({agent.email})"
                                return {
                                    "phone": phone,
                                    "email": email,
                                    "recipient_name": recipient_name,
                                    "recipient_id": recipient_id,
                                    "recipient_type": recipient_type,
                                    "routing_reason": routing_reason,
                                    "escalation_level": 0
                                }

                # Query Department Config
                dept_config = None
                if department:
                    stmt = select(DepartmentConfig).where(
                        DepartmentConfig.business_id == real_business_id,
                        DepartmentConfig.department == department
                    )
                    if property_id:
                        stmt = stmt.where(DepartmentConfig.property_id == property_id)
                    res = await session.execute(stmt)
                    dept_config = res.scalar_one_or_none()

                if dept_config and dept_config.routing_enabled:
                    # Level 2: Department Primary Agent
                    if dept_config.primary_user_id:
                        primary_agent = await session.get(User, dept_config.primary_user_id)
                        if primary_agent and primary_agent.receive_operational_alerts:
                            phone = primary_agent.phone
                            email = primary_agent.email
                            recipient_name = primary_agent.email.split("@")[0].capitalize()
                            recipient_id = primary_agent.id
                            recipient_type = "primary_agent"
                            routing_reason = f"Level 2: Department Primary Agent ({primary_agent.email})"
                            return {
                                "phone": phone,
                                "email": email,
                                "recipient_name": recipient_name,
                                "recipient_id": recipient_id,
                                "recipient_type": recipient_type,
                                "routing_reason": routing_reason,
                                "escalation_level": 0
                            }

                    # Level 3: Department WhatsApp
                    if dept_config.whatsapp_enabled and dept_config.notification_phone:
                        phone = dept_config.notification_phone
                        recipient_type = "department_phone"
                        routing_reason = f"Level 3: Department WhatsApp ({phone})"
                        
                    # Level 4: Department Email
                    if dept_config.email_enabled and dept_config.notification_email:
                        email = dept_config.notification_email
                        if not phone:
                            recipient_type = "department_email"
                            routing_reason = f"Level 4: Department Email ({email})"

                    if phone or email:
                        return {
                            "phone": phone,
                            "email": email,
                            "recipient_name": dept_config.display_name or department.capitalize(),
                            "recipient_id": dept_config.id,
                            "recipient_type": recipient_type,
                            "routing_reason": routing_reason,
                            "escalation_level": 0
                        }

                # Level 5: Business Owner Fallback
                owner_stmt = select(User).where(User.business_id == real_business_id, User.role == "owner")
                owner_res = await session.execute(owner_stmt)
                owner = owner_res.scalars().first()
                if owner:
                    phone = owner.phone
                    email = owner.email
                    recipient_name = owner.email.split("@")[0].capitalize()
                    recipient_id = owner.id
                    recipient_type = "owner"
                    routing_reason = f"Level 5: Business Owner Fallback ({owner.email})"
                    return {
                        "phone": phone,
                        "email": email,
                        "recipient_name": recipient_name,
                        "recipient_id": recipient_id,
                        "recipient_type": recipient_type,
                        "routing_reason": routing_reason,
                        "escalation_level": 0
                    }

            except Exception as e:
                logger.error(f"[RoutingService] Error resolving routing: {e}", exc_info=True)

            # Level 6: System Fallback
            return {
                "phone": None,
                "email": None,
                "recipient_name": "System Fallback",
                "recipient_id": None,
                "recipient_type": "system",
                "routing_reason": "Level 6: System Fallback (No matching rules found)",
                "escalation_level": 0
            }

    @classmethod
    async def check_and_trigger_escalations(cls):
        """
        Scans for unacknowledged notification events that exceed their escalation timeout,
        and escalates them to managers.
        """
        async with AsyncSessionLocal() as session:
            try:
                # Query all active department configs with escalation enabled
                stmt = select(DepartmentConfig).where(DepartmentConfig.escalation_enabled == True)
                res = await session.execute(stmt)
                configs = res.scalars().all()
                
                for config in configs:
                    timeout_mins = config.escalation_timeout_minutes or 30
                    cutoff = datetime.utcnow() - timedelta(minutes=timeout_mins)
                    
                    # Find unacknowledged events that were sent before cutoff
                    event_stmt = (
                        select(NotificationEvent)
                        .where(
                            NotificationEvent.business_id == config.business_id,
                            NotificationEvent.department == config.department,
                            NotificationEvent.status == "sent",
                            NotificationEvent.sent_at <= cutoff
                        )
                    )
                    event_res = await session.execute(event_stmt)
                    events = event_res.scalars().all()
                    
                    for event in events:
                        # Escalate to next level
                        next_level = event.escalation_level + 1
                        manager = None
                        
                        if next_level == 1 and config.escalation_user_id:
                            manager = await session.get(User, config.escalation_user_id)
                        elif next_level == 2 and config.escalation_level2_user_id:
                            manager = await session.get(User, config.escalation_level2_user_id)
                            
                        if manager and manager.receive_operational_alerts:
                            logger.info(f"[Escalation] Escales event {event.id} to level {next_level} (Manager: {manager.email})")
                            
                            # Dispatch alerts to manager
                            subject = f"ESCALATION Level {next_level}: Unresolved Conversation Alert"
                            body = (
                                f"<h2>Alert Escalation</h2>"
                                f"<p>A conversation alert has not been acknowledged by the department team within {timeout_mins} minutes.</p>"
                                f"<p><strong>Department</strong>: {event.department.capitalize()}<br/>"
                                f"<strong>Customer</strong>: {event.recipient}</p>"
                                f"<p>Please log in to the InteracAI dashboard to assign and resolve this conversation.</p>"
                            )
                            
                            # Send Email (Resend)
                            if manager.email and (manager.notification_preference in ["all", "email"]):
                                from services.email_service import email_service
                                await email_service.send_email(
                                    to=manager.email,
                                    subject=subject,
                                    html_content=body,
                                    business_id=config.business_id
                                )
                                
                            # Send WhatsApp Template
                            if manager.phone and (manager.notification_preference in ["all", "whatsapp"]):
                                from services.whatsapp_service import send_whatsapp_template
                                time_str = datetime.utcnow().strftime("%d %B %Y, %I:%M %p")
                                components = [
                                    {
                                        "type": "body",
                                        "parameters": [
                                            {"type": "text", "text": manager.email.split("@")[0].capitalize()},
                                            {"type": "text", "text": f"Escalation L{next_level} ({event.department})"},
                                            {"type": "text", "text": time_str}
                                        ]
                                    }
                                ]
                                await send_whatsapp_template(
                                    to_number=manager.phone,
                                    template_name="interacai_agent_chat_notification",
                                    language_code="en",
                                    components=components,
                                    business_id=config.business_id
                                )
                            
                            # Update Event Status to reflect escalation
                            event.escalation_level = next_level
                            event.sent_at = datetime.utcnow() # Reset timer for next timeout
                            session.add(event)
                        else:
                            # Cannot escalate further or no manager found
                            event.status = "escalated_max"
                            session.add(event)
                            
                await session.commit()
            except Exception as e:
                logger.error(f"[RoutingService] Error in escalation checker: {e}", exc_info=True)
