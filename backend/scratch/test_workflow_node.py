import sys
import os
sys.path.append(os.path.join(os.getcwd()))

import asyncio
from datetime import datetime, timedelta
from services.workflow_engine import execute_node_logic, should_notify_agent
from database.models.workflow import WorkflowNode
from database.models.chat import Message

async def test_notify_agent_whatsapp():
    # 1. Create a mock WorkflowNode
    node = WorkflowNode(
        type="action",
        label="Notify Agent (WhatsApp)",
        config={
            "action_type": "notify_agent_whatsapp",
            "to_number": "2348101234567",
            "template": "Ongoing chat! Platform: {{trigger.platform}}, Message: {{trigger.message_body}}"
        }
    )
    
    # 2. Mock context data
    context = {
        "business_id": "test_business_123",
        "trigger": {
            "platform": "whatsapp",
            "message_body": "Hello, I want to book an appointment.",
            "from_number": "1234567890"
        }
    }
    
    print("Executing notify_agent_whatsapp node...")
    
    # We will mock send_whatsapp_message to verify it gets called with correct parameters
    called_args = []
    
    # Mocking send_whatsapp_message function in services.whatsapp_service
    import services.whatsapp_service
    async def mock_send_whatsapp_message(to_number: str, text: str, business_id: str = None):
        called_args.append((to_number, text, business_id))
        print(f"[MOCK] send_whatsapp_message called: to_number={to_number}, text='{text}', business_id={business_id}")
        return True
        
    services.whatsapp_service.send_whatsapp_message = mock_send_whatsapp_message
    
    # CASE 1: First message (no history) -> Should send
    try:
        # Mock should_notify_agent to return True
        import services.workflow_engine
        async def mock_should_notify_agent_true(business_id: str, user_id: str):
            return True
        services.workflow_engine.should_notify_agent = mock_should_notify_agent_true
        
        res = await execute_node_logic(node, context)
        print("Case 1 Result:", res)
        
        # Verify call arguments
        assert len(called_args) == 1, "send_whatsapp_message should be called exactly once"
        assert res["action_result"] == "sent_agent_notification"
        print("Case 1 Passed.")
    except Exception as e:
        print("Case 1 Failed:", e)
        raise e

    # CASE 2: Throttled message -> Should skip
    called_args.clear()
    try:
        # Mock should_notify_agent to return False
        async def mock_should_notify_agent_false(business_id: str, user_id: str):
            return False
        services.workflow_engine.should_notify_agent = mock_should_notify_agent_false
        
        res = await execute_node_logic(node, context)
        print("Case 2 Result:", res)
        
        # Verify it skipped and did not call WhatsApp
        assert len(called_args) == 0, "send_whatsapp_message should not be called"
        assert res["action_result"] == "skipped"
        assert res["reason"] == "notification_throttled"
        print("Case 2 Passed.")
    except Exception as e:
        print("Case 2 Failed:", e)
        raise e

    print("\nSuccess! Backend notify_agent_whatsapp logic & throttling verified successfully.")

if __name__ == "__main__":
    asyncio.run(test_notify_agent_whatsapp())
