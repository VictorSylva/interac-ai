from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
import os
import logging
import re
import json
from .ai_service import generate_response
from .ai_service import generate_response
# from .db_service import db # Deprecated
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

from .db_service import get_whatsapp_config, get_business_id_by_phone_id

WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "interact_secret_token")
# Global fallbacks for backward compatibility or system-level messages
DEFAULT_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN")
DEFAULT_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")

@router.get("/webhook")
async def verify_webhook(request: Request):
    """
    Verifies the webhook for WhatsApp (Meta).
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode and token:
        # We can support either a global verify token or business-specific ones.
        # For simplicity in the Meta developer portal, we'll keep one global verify token.
        if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
            logger.info("Webhook verified successfully.")
            return int(challenge)
        else:
            raise HTTPException(status_code=403, detail="Verification failed")
    
    return {"status": "error", "message": "Missing parameters"}

@router.post("/webhook")
async def receive_message(request: Request, background_tasks: BackgroundTasks):
    """
    Receives messages from WhatsApp. Returns 200 OK immediately and processes in background.
    """
    try:
        data = await request.json()
        
        # Validate structure quickly
        if not data.get("entry") or not data["entry"][0].get("changes"):
            return {"status": "ignored"}
            
        value = data["entry"][0]["changes"][0].get("value", {})
        if "messages" not in value:
            return {"status": "no_messages"}

        # Extract core info to pass to background task
        message = value["messages"][0]
        from_number = message["from"]
        msg_body = message.get("text", {}).get("body", "")
        metadata = value.get("metadata", {})
        phone_id = metadata.get("phone_number_id")

        if msg_body:
            # Kick off background processing
            background_tasks.add_task(
                process_whatsapp_message_task, 
                from_number, 
                msg_body, 
                phone_id
            )

        return {"status": "accepted_for_processing"}
    except Exception as e:
        logger.error(f"Error accepting webhook: {e}")
        return {"status": "error"}

async def process_whatsapp_message_task(from_number: str, msg_body: str, phone_id: str):
    """
    Background worker for processing the message logic.
    """
    try:
        logger.info(f"Background processing message from {from_number}: {msg_body}")
        
        # 1. Resolve Business ID
        from .db_service import get_business_id_by_phone_id, resolve_business_id
        business_id = await get_business_id_by_phone_id(phone_id)
        
        if not business_id:
            business_id_input = os.getenv("PRIMARY_BUSINESS_ID", "groupcopac@gmail.com")
            business_id = await resolve_business_id(business_id_input)

        # 1.1 Access Check
        from services.subscription_service import check_access, track_conversation
        access = await check_access(business_id)
        if not access["allowed"]:
            await send_whatsapp_message(from_number, f"Access Denied: {access['reason']}", business_id=business_id)
            return

        await track_conversation(business_id, from_number)

        from .db_service import store_message, get_chat_history, set_conversation_mode, get_business_profile
        from database.models.chat import Conversation
        from database.session import AsyncSessionLocal
        
        # 1.3 Check Conversation State
        async with AsyncSessionLocal() as session:
            convo_id = f"{business_id}:{from_number}"
            convo = await session.get(Conversation, convo_id)
            if convo and convo.mode == "human":
                logger.info(f"[WhatsApp] Conversation {convo_id} is in HUMAN mode. Storing and skipping AI.")
                await store_message(business_id, from_number, msg_body, "customer", platform="whatsapp")
                return

        await store_message(business_id, from_number, msg_body, "customer", platform="whatsapp")
        
        # 1.5 Trigger Workflow / Keywords
        from .workflow_engine import workflow_engine
        from .prompt_service import prompt_service
        
        detected_intent = await prompt_service.detect_intent(msg_body)
        sentiment_data = await prompt_service.analyze_sentiment(msg_body)
        
        biz_profile = await get_business_profile(business_id)
        auto_escalate = biz_profile.get("auto_escalate_on_keyword", False)
        handover_keywords = ["human", "agent", "support", "representative", "person", "talk to someone"]
        
        keyword_match = any(kw in msg_body.lower() for kw in handover_keywords)
        
        if auto_escalate and keyword_match:
            await set_conversation_mode(business_id, from_number, mode="human", status="waiting", department="support")
            await send_whatsapp_message(from_number, "I'm transferring you to a human agent now. Please wait...", business_id=business_id)
            return

        trigger_cmd = {
            "from_number": from_number,
            "message_body": msg_body,
            "platform": "whatsapp",
            "business_id": business_id,
            "intent": detected_intent,
            "sentiment": sentiment_data.get("sentiment", "neutral"),
            "sentiment_score": sentiment_data.get("score", 0.5),
            "keywords": [kw for kw in handover_keywords if kw in msg_body.lower()]
        }
        
        executions = await workflow_engine.trigger_workflow(business_id, "message_created", trigger_cmd)
        if executions:
            return

        # 2. AI Response
        raw_history = await get_chat_history(business_id, from_number, limit=5)
        formatted_history = []
        for msg in raw_history:
            role = "user" if msg['sender'] == 'customer' else "assistant"
            formatted_history.append({"role": role, "content": msg['text']})

        ai_reply = await generate_response(msg_body, formatted_history, from_number, business_id=business_id)
        
        # 4. Cleanup & Action Parsers
        import re
        import json as json_lib

        # Lead Capture
        lead_pattern = r'\[ACTION: LEAD_CAPTURE \| (?P<json>.*?)\]'
        lead_match = re.search(lead_pattern, ai_reply)
        if lead_match:
            try:
                lead_data = json_lib.loads(lead_match.group('json'))
                from .db_service import save_lead
                await save_lead(business_id, lead_data)
            except Exception as e:
                logger.error(f"Error parsing lead capture: {e}")

        # Funnel Progress
        funnel_match = re.search(r'\[ACTION: FUNNEL_PROGRESS \| (?P<json>.*?)\]', ai_reply, re.IGNORECASE)
        if funnel_match:
            try:
                from .behavior_analytics_service import behavior_analytics_service
                funnel_data = json_lib.loads(funnel_match.group('json'))
                await behavior_analytics_service.track_event(business_id, f"wa_{from_number}", {
                    "type": "funnel_progression",
                    "offer_id": funnel_data.get("offer_id"),
                    "funnel_id": funnel_data.get("funnel_id"),
                    "properties": {"step": funnel_data.get("step"), "platform": "whatsapp"}
                })
            except Exception as e:
                logger.error(f"Error parsing funnel progression: {e}")

        # Analysis Tags
        analysis_match = re.search(r'\[ANALYSIS:\s*(?P<intent>.*?)\s*\|\s*(?P<sentiment>.*?)\s*\]', ai_reply, re.IGNORECASE)
        final_intent = detected_intent
        final_sentiment = sentiment_data.get("sentiment", "neutral")
        if analysis_match:
            ai_intent = analysis_match.group('intent').strip().lower()
            if ai_intent in ["booking", "enquiry", "pricing", "support", "greeting", "features", "integration", "complaint", "feedback", "human"]:
                final_intent = ai_intent
                final_sentiment = analysis_match.group('sentiment').strip()

        # Final cleanup
        ai_reply = re.sub(r'\[ACTION:.*?\]', '', ai_reply).strip()
        ai_reply = re.sub(r'\[ANALYSIS:.*?\]', '', ai_reply).strip()

        # 5. Store & Send
        await store_message(business_id, from_number, ai_reply, "agent", platform="whatsapp", intent=final_intent, sentiment=final_sentiment)
        await send_whatsapp_message(from_number, ai_reply, business_id=business_id)

    except Exception as e:
        logger.error(f"Error in background task: {e}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Error processing webhook: {e}")
        return {"status": "error"}

async def send_whatsapp_message(to_number: str, text: str, business_id: str = None):
    # Normalize number
    to_number = normalize_phone_number(to_number)
    
    # Determine credentials
    api_token = DEFAULT_API_TOKEN
    phone_id = DEFAULT_PHONE_ID
    
    if business_id:
        config = await get_whatsapp_config(business_id)
        if config and config.get("is_active"):
            api_token = config.get("access_token")
            phone_id = config.get("phone_number_id")
            logger.info(f"Using business-specific WhatsApp credentials for {business_id}")
    
    if not api_token or not phone_id:
        logger.error(f"WhatsApp credentials missing for business {business_id or 'System'}")
        return False

    url = f"https://graph.facebook.com/v17.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "text": {"body": text}
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code in [200, 201]:
                # Token Deduction on Success
                if business_id:
                    from services.token_service import token_service, TOKEN_COSTS
                    await token_service.deduct_tokens(business_id, TOKEN_COSTS["whatsapp_outbound"], "whatsapp_outbound")
                return True
            else:
                logger.error(f"WhatsApp Send Failed: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Error calling WhatsApp API: {e}")
        return False

async def send_whatsapp_template(to_number: str, template_name: str, language_code: str = "en", components: list = None, business_id: str = None):
    """
    Sends a WhatsApp message using a pre-approved template.
    Required for business-initiated conversations.
    """
    to_number = normalize_phone_number(to_number)
    
    api_token = DEFAULT_API_TOKEN
    phone_id = DEFAULT_PHONE_ID
    
    if business_id:
        config = await get_whatsapp_config(business_id)
        if config and config.get("is_active"):
            api_token = config.get("access_token")
            phone_id = config.get("phone_number_id")
    
    if not api_token or not phone_id:
        return False

    url = f"https://graph.facebook.com/v17.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code}
        }
    }
    
    if components:
        payload["template"]["components"] = components

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code in [200, 201]:
                if business_id:
                    from services.token_service import token_service, TOKEN_COSTS
                    await token_service.deduct_tokens(business_id, TOKEN_COSTS["whatsapp_outbound"], "whatsapp_template_send")
                return True
            return False
    except Exception as e:
        logger.error(f"Error sending WhatsApp template: {e}")
        return False

def normalize_phone_number(phone: str) -> str:
    """
    Normalizes phone numbers to E.164 format (without + for WhatsApp API).
    Example: +234 810 123 4567 -> 2348101234567
    """
    if not phone: return ""
    # Remove all non-numeric characters
    clean_phone = re.sub(r'\D', '', phone)
    return clean_phone
