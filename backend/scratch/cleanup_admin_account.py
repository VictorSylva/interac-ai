import asyncio
import os
import sys
from sqlalchemy import text, delete

# Set up paths
backend_path = os.path.join(os.getcwd(), 'backend')
sys.path.append(backend_path)

from database.session import AsyncSessionLocal
from database.models.general import Business, User, BusinessSettings, KnowledgeDoc, BusinessWhatsAppConfig
from database.models.chat import Message, Conversation
from database.models.workflow import Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, ExecutionStep
from database.models.crm import Lead, Ticket, LeadActivity
from database.models.scheduling import AppointmentType, AvailabilityRule, Appointment
from database.models.sales import Offer, SalesPage, Order, Delivery
from database.models.behavior_analytics import BASession, BAEvent, BAAggregate
from database.models.billing import BusinessSubscription, TokenWallet
from database.models.payment import PaymentTransaction

async def hard_delete_business(business_id: str):
    # Ensure ID is lowercase as per database audit
    business_id = business_id.lower()
    print(f"Starting hard delete for EXACT business ID: {business_id}")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if business exists first
            check_stmt = text(f"SELECT name FROM businesses WHERE id = '{business_id}'")
            res = await session.execute(check_stmt)
            biz_name = res.scalar()
            if not biz_name:
                print(f"❌ Business with ID {business_id} not found. Aborting.")
                return

            print(f"Purging data for business: {biz_name} ({business_id})...")

            # 1. Behavior Analytics
            await session.execute(delete(BAEvent).where(BAEvent.business_id == business_id))
            await session.execute(delete(BASession).where(BASession.business_id == business_id))
            await session.execute(delete(BAAggregate).where(BAAggregate.business_id == business_id))
            
            # 2. Sales
            order_ids_stmt = text(f"SELECT id FROM sales_orders WHERE business_id = '{business_id}'")
            res = await session.execute(order_ids_stmt)
            order_ids = [row[0] for row in res.fetchall()]
            if order_ids:
                await session.execute(delete(Delivery).where(Delivery.order_id.in_(order_ids)))
            
            await session.execute(delete(Order).where(Order.business_id == business_id))
            await session.execute(delete(SalesPage).where(SalesPage.business_id == business_id))
            await session.execute(delete(Offer).where(Offer.business_id == business_id))

            # 3. Workflow
            exec_ids_stmt = text(f"SELECT id FROM workflow_executions WHERE business_id = '{business_id}'")
            res = await session.execute(exec_ids_stmt)
            exec_ids = [row[0] for row in res.fetchall()]
            if exec_ids:
                await session.execute(delete(ExecutionStep).where(ExecutionStep.execution_id.in_(exec_ids)))
            
            await session.execute(delete(WorkflowExecution).where(WorkflowExecution.business_id == business_id))
            
            work_ids_stmt = text(f"SELECT id FROM workflows WHERE business_id = '{business_id}'")
            res = await session.execute(work_ids_stmt)
            work_ids = [row[0] for row in res.fetchall()]
            if work_ids:
                await session.execute(delete(WorkflowEdge).where(WorkflowEdge.workflow_id.in_(work_ids)))
                await session.execute(delete(WorkflowNode).where(WorkflowNode.workflow_id.in_(work_ids)))
            
            await session.execute(delete(Workflow).where(Workflow.business_id == business_id))

            # 4. Scheduling & CRM
            await session.execute(delete(Appointment).where(Appointment.business_id == business_id))
            await session.execute(delete(AvailabilityRule).where(AvailabilityRule.business_id == business_id))
            await session.execute(delete(AppointmentType).where(AppointmentType.business_id == business_id))
            await session.execute(delete(LeadActivity).where(LeadActivity.business_id == business_id))
            await session.execute(delete(Ticket).where(Ticket.business_id == business_id))
            await session.execute(delete(Lead).where(Lead.business_id == business_id))

            # 5. Chat
            await session.execute(delete(Message).where(Message.business_id == business_id))
            await session.execute(delete(Conversation).where(Conversation.business_id == business_id))
            
            # 6. Billing
            await session.execute(delete(PaymentTransaction).where(PaymentTransaction.business_id == business_id))
            await session.execute(delete(TokenWallet).where(TokenWallet.business_id == business_id))
            await session.execute(delete(BusinessSubscription).where(BusinessSubscription.business_id == business_id))

            # 7. General
            await session.execute(delete(User).where(User.business_id == business_id))
            await session.execute(delete(BusinessSettings).where(BusinessSettings.business_id == business_id))
            await session.execute(delete(KnowledgeDoc).where(KnowledgeDoc.business_id == business_id))
            await session.execute(delete(BusinessWhatsAppConfig).where(BusinessWhatsAppConfig.business_id == business_id))
            
            # 8. Final target
            await session.execute(delete(Business).where(Business.id == business_id))
            
            await session.commit()
            print(f"✅ Successfully deleted business '{biz_name}' and all related data.")
        except Exception as e:
            await session.rollback()
            print(f"❌ Error deleting business {business_id}: {e}")

if __name__ == "__main__":
    # TARGETING ONLY THE 'Admin' ACCOUNT FOUND IN AUDIT
    target_id = "1133335e-bcd2-4aff-9c07-cf7a764c88d4"
    asyncio.run(hard_delete_business(target_id))
