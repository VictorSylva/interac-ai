import sys
import os
sys.path.append(os.path.join(os.getcwd()))

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# 1. Setup temporary file SQLite database to ensure clean persistence across sessions
db_file = "scratch/test_temp.db"
if os.path.exists(db_file):
    try:
        os.remove(db_file)
    except Exception:
        pass
        
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{db_file}"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)

TestingSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# 2. Apply global session override BEFORE importing any models/services
import database.session
database.session.AsyncSessionLocal = TestingSessionLocal

# 3. Now import models and services safely
from database.base import Base
from database.models.general import User, Business, DepartmentConfig, NotificationEvent, BusinessSettings
from database.models.chat import Conversation
from services.routing_service import DepartmentRoutingService
from services.workflow_engine import should_notify_agent

async def run_tests():
    from database.models.general import Base as GenBase
    
    async with engine.begin() as conn:
        await conn.run_sync(GenBase.metadata.create_all)
    
    # Seed test data
    async with TestingSessionLocal() as session:
        # Create Business
        biz = Business(id="test_biz", name="Test Business")
        session.add(biz)
        
        # Create settings
        settings = BusinessSettings(
            business_id="test_biz",
            notification_cooldown_minutes=15 # Set to 15 mins for testing
        )
        session.add(settings)
        
        # Create Users
        owner = User(
            id="owner_1",
            business_id="test_biz",
            email="owner@test.com",
            role="owner",
            phone="2348000000000",
            receive_operational_alerts=True
        )
        agent = User(
            id="agent_1",
            business_id="test_biz",
            email="agent@test.com",
            role="agent",
            phone="2348111111111",
            receive_operational_alerts=True,
            department="sales"
        )
        manager = User(
            id="manager_1",
            business_id="test_biz",
            email="manager@test.com",
            role="admin",
            phone="2348222222222",
            receive_operational_alerts=True,
            department="sales"
        )
        session.add_all([owner, agent, manager])
        
        # Create DepartmentConfig
        dept_config = DepartmentConfig(
            business_id="test_biz",
            department="sales",
            display_name="Sales Team",
            notification_phone="2348333333333",
            notification_email="sales@test.com",
            primary_user_id="agent_1",
            routing_enabled=True,
            whatsapp_enabled=True,
            email_enabled=True,
            escalation_enabled=True,
            escalation_timeout_minutes=1, # 1 minute for fast testing
            escalation_user_id="manager_1"
        )
        session.add(dept_config)
        
        # Create Conversations
        convo1 = Conversation(
            id="test_biz:cust_1",
            business_id="test_biz",
            customer_name="Customer 1",
            platform="whatsapp",
            assigned_agent_id=None,
            department="sales"
        )
        convo2 = Conversation(
            id="test_biz:cust_2",
            business_id="test_biz",
            customer_name="Customer 2",
            platform="whatsapp",
            assigned_agent_id="agent_1", # Explicitly assigned
            department="sales"
        )
        session.add_all([convo1, convo2])
        await session.commit()

    print("Test database seeded successfully.")

    # Mocks for meta template/email sends during escalation
    import services.email_service
    import services.whatsapp_service
    email_sends = []
    whatsapp_sends = []
    
    async def mock_send_email(*args, **kwargs):
        email_sends.append((args, kwargs))
        return True
    async def mock_send_whatsapp_template(*args, **kwargs):
        whatsapp_sends.append((args, kwargs))
        return True
        
    services.email_service.email_service.send_email = mock_send_email
    services.whatsapp_service.send_whatsapp_template = mock_send_whatsapp_template

    # 3. Test resolve_recipient hierarchy
    print("\n--- Testing resolve_recipient ---")
    
    # Case 1: Level 1 (Assigned Agent on convo2)
    res1 = await DepartmentRoutingService.resolve_recipient("test_biz", "sales", conversation_id="test_biz:cust_2")
    assert res1["phone"] == "2348111111111"
    assert res1["recipient_type"] == "assigned_agent"
    print("Level 1 resolve_recipient (Assigned Agent) passed.")

    # Case 2: Level 2 (Department Primary Agent on convo1)
    res2 = await DepartmentRoutingService.resolve_recipient("test_biz", "sales", conversation_id="test_biz:cust_1")
    assert res2["phone"] == "2348111111111"
    assert res2["recipient_type"] == "primary_agent"
    print("Level 2 resolve_recipient (Primary Agent) passed.")

    # Case 3: Level 3 (Department phone number config fallback if primary agent is not set)
    async with TestingSessionLocal() as session:
        dc = await session.get(DepartmentConfig, dept_config.id)
        dc.primary_user_id = None # Clear primary user
        await session.commit()
        
    res3 = await DepartmentRoutingService.resolve_recipient("test_biz", "sales", conversation_id="test_biz:cust_1")
    assert res3["phone"] == "2348333333333"
    assert res3["recipient_type"] == "department_phone"
    print("Level 3 resolve_recipient (Department WhatsApp Number) passed.")

    # Case 4: Level 5 (Owner Fallback if routing disabled or department not configured)
    res4 = await DepartmentRoutingService.resolve_recipient("test_biz", "billing", conversation_id="test_biz:cust_1")
    assert res4["phone"] == "2348000000000"
    assert res4["recipient_type"] == "owner"
    print("Level 5 resolve_recipient (Business Owner Fallback) passed.")

    # 4. Test Cooldown / Throttling
    print("\n--- Testing Notification Cooldown ---")
    
    # Ensure initially we should notify
    should_notif = await should_notify_agent("test_biz", "cust_1", "workflow_1", channel="whatsapp")
    assert should_notif is True, "Should allow notification initially"
    
    # Save a NotificationEvent simulating sent alert
    async with TestingSessionLocal() as session:
        evt = NotificationEvent(
            business_id="test_biz",
            conversation_id="test_biz:cust_1",
            department="sales",
            recipient="2348333333333",
            channel="whatsapp",
            event_type="whatsapp_notification",
            status="sent",
            deduplication_key="test_biz:test_biz:cust_1:whatsapp",
            escalation_level=0
        )
        session.add(evt)
        await session.commit()
        
    # Check cooldown within 15 minutes window -> should skip (False)
    should_notif_2 = await should_notify_agent("test_biz", "cust_1", "workflow_1", channel="whatsapp")
    assert should_notif_2 is False, "Should block notification within cooldown window"
    print("Notification cooldown throttling passed.")

    # 5. Test Escalation trigger logic
    print("\n--- Testing Escalation Engine ---")
    
    # Manipulate NotificationEvent timestamp to be 2 minutes ago (exceeding 1 minute timeout)
    from datetime import datetime, timedelta
    async with TestingSessionLocal() as session:
        evt_db = await session.get(NotificationEvent, evt.id)
        evt_db.sent_at = datetime.utcnow() - timedelta(minutes=2)
        await session.commit()
        
    # Trigger escalation check
    await DepartmentRoutingService.check_and_trigger_escalations()
    
    # Verify manager received escalation WhatsApp template & email
    assert len(whatsapp_sends) == 1, "Should send WhatsApp template alert to manager"
    assert len(email_sends) == 1, "Should send email alert to manager"
    
    # Verify event escalation level updated
    async with TestingSessionLocal() as session:
        evt_db2 = await session.get(NotificationEvent, evt.id)
        assert evt_db2.escalation_level == 1
        assert evt_db2.status == "sent" # remains sent for L2 check
        
    print("Escalation trigger & notification dispatch passed.")
    print("\nALL routing, cooldown, and escalation test cases passed successfully!")

    # Clean up file database
    await engine.dispose()
    if os.path.exists("scratch/test_temp.db"):
        try:
            os.remove("scratch/test_temp.db")
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(run_tests())
