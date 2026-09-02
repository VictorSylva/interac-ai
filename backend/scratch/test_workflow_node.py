import sys
import os
sys.path.append(os.path.join(os.getcwd()))

import asyncio
from services.workflow_engine import execute_node_logic, should_notify_agent
from database.models.workflow import WorkflowNode

async def test_notify_agent_whatsapp():
    # 1. Create a mock WorkflowNode pointing to target agent phone number
    node = WorkflowNode(
        type="action",
        label="Notify Agent (WhatsApp)",
        config={
            "action_type": "notify_agent_whatsapp",
            "to_number": "+2348131608061", # Mbasiti's phone number
            "template": "Ongoing chat! Platform: {{trigger.platform}}, Message: {{trigger.message_body}}"
        }
    )
    
    # 2. Mock context data
    context = {
        "business_id": "test_business_123",
        "trigger": {
            "platform": "whatsapp",
            "message_body": "Hello, I want to book an appointment.",
            "from_number": "2348012345678"
        }
    }
    
    print("Executing notify_agent_whatsapp template node test...")
    
    template_calls = []
    message_calls = []
    
    # Mocking Meta template call
    import services.whatsapp_service
    async def mock_send_whatsapp_template(to_number: str, template_name: str, language_code: str = "en", components: list = None, business_id: str = None):
        template_calls.append((to_number, template_name, components, business_id))
        print(f"[MOCK] send_whatsapp_template called: to_number={to_number}, template={template_name}, components={components}")
        return True
        
    async def mock_send_whatsapp_message(to_number: str, text: str, business_id: str = None):
        message_calls.append((to_number, text, business_id))
        print(f"[MOCK] send_whatsapp_message called: to_number={to_number}, text='{text}'")
        return True
        
    services.whatsapp_service.send_whatsapp_template = mock_send_whatsapp_template
    services.whatsapp_service.send_whatsapp_message = mock_send_whatsapp_message
    
    # CASE 1: First message (no history) -> Should send template
    try:
        # Mock should_notify_agent to return True
        import services.workflow_engine
        async def mock_should_notify_agent_true(*args, **kwargs):
            return True
        services.workflow_engine.should_notify_agent = mock_should_notify_agent_true
        
        res = await execute_node_logic(node, context)
        print("Case 1 Result:", res)
        
        # Verify template call parameters
        assert len(template_calls) == 1, "send_whatsapp_template should be called exactly once"
        to_num, temp_name, comp, biz_id = template_calls[0]
        assert to_num == "+2348131608061"
        assert temp_name == "interacai_agent_chat_notification"
        
        # Verify 3 template parameters are correct
        params = comp[0]["parameters"]
        assert len(params) == 3
        assert params[0]["text"] == "Mbasiti"
        assert params[1]["text"] == "+2348012345678"
        assert len(params[2]["text"]) > 10 # Has formatted time
        
        assert res["action_result"] == "sent_agent_notification_template"
        print("Case 1 Passed.")
    except Exception as e:
        print("Case 1 Failed:", e)
        raise e

    # CASE 2: Throttled message -> Should skip
    template_calls.clear()
    message_calls.clear()
    try:
        # Mock should_notify_agent to return False
        async def mock_should_notify_agent_false(*args, **kwargs):
            return False
        services.workflow_engine.should_notify_agent = mock_should_notify_agent_false
        
        res = await execute_node_logic(node, context)
        print("Case 2 Result:", res)
        
        assert len(template_calls) == 0, "send_whatsapp_template should not be called"
        assert len(message_calls) == 0, "send_whatsapp_message should not be called"
        assert res["action_result"] == "skipped"
        assert res["reason"] == "notification_throttled"
        print("Case 2 Passed.")
    except Exception as e:
        print("Case 2 Failed:", e)
        raise e

    print("\nSuccess! WhatsApp template mappings and throttling verified successfully.")

if __name__ == "__main__":
    asyncio.run(test_notify_agent_whatsapp())
