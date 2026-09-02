import os
import httpx
import logging
import json
from services.prompt_service import prompt_service
import re

logger = logging.getLogger(__name__)

def clean_markdown_for_chats(text: str) -> str:
    if not text:
        return text
    # Replace headers (e.g., "### Header") with just the header text
    text = re.sub(r'^(?:#+)\s*(.*?)$', r'\1', text, flags=re.MULTILINE)
    # Remove bold/italic markers like **, ***, *, __, _
    text = re.sub(r'\*\*+(.*?)\*\*+', r'\1', text)
    text = re.sub(r'\*+(.*?)\*+', r'\1', text)
    text = re.sub(r'__+(.*?)__+', r'\1', text)
    text = re.sub(r'_+(.*?)_+', r'\1', text)
    # Remove raw HTML-like tags
    text = re.sub(r'<[^>]*>', '', text)
    return text

from config import config

# --- CONFIGURATION & ENV LOADING ---
# Provider Keys
OPENROUTER_API_KEY = config.OPENROUTER_API_KEY
OPENROUTER_MODEL = config.OPENROUTER_MODEL
# OpenRouter strictly requires Referer and Title headers to prevent key invalidation.
OPENROUTER_REFERER = config.OPENROUTER_REFERER
OPENROUTER_TITLE = config.OPENROUTER_TITLE

GEMINI_API_KEY = config.GEMINI_API_KEY
GEMINI_MODEL = config.GEMINI_MODEL

# Structured Logging Config
class AIServiceLogger:
    @staticmethod
    def log_request(provider, model, user_id):
        logger.info(f"[AI REQUEST] Provider: {provider} | Model: {model} | User: {user_id}")

    @staticmethod
    def log_response(provider, status_code, char_count):
        logger.info(f"[AI RESPONSE] Provider: {provider} | Status: {status_code} | Chars: {char_count}")

    @staticmethod
    def log_error(provider, category, message, status_code=None):
        error_msg = f"[AI ERROR] Provider: {provider} | Category: {category} | Msg: {message}"
        if status_code:
            error_msg += f" | Status: {status_code}"
        logger.error(error_msg)

# Determine primary provider at startup
if GEMINI_API_KEY:
    PRIMARY_PROVIDER = "gemini"
    logger.info(f"AI Service Initialized with Provider: Google Gemini ({GEMINI_MODEL})")
elif OPENROUTER_API_KEY:
    PRIMARY_PROVIDER = "openrouter"
    logger.info(f"AI Service Initialized with Provider: OpenRouter ({OPENROUTER_MODEL})")
else:
    PRIMARY_PROVIDER = None
    logger.warning("No AI provider (GEMINI_API_KEY or OPENROUTER_API_KEY) found in environment.")

from services.db_service import log_prompt_execution

async def generate_response(user_message: str, conversation_history: list = None, user_id: str = "unknown", system_instruction: str = None, business_id: str = None):
    """
    Main entry point for generating AI responses. 
    Routes to the configured provider and handles common errors.
    """
    if not PRIMARY_PROVIDER:
        return "AI Service Error: No provider configured. Please check your API keys."

    if business_id:
        from services.subscription_service import check_access, track_conversation
        from services.token_service import token_service, TOKEN_COSTS
        
        # 1. Global Access Check (Subscription -> Conv Limit -> Tokens)
        # We pre-check for the base AI cost
        access = await check_access(business_id, required_tokens=TOKEN_COSTS["ai_inference_base"])
        if not access["allowed"]:
            logger.warning(f"[AI Service] Access Denied for {business_id}: {access['reason']} ({access['code']})")
            return f"ACCESS_DENIED: {access['reason']}"

        # 2. Track Conversation (24h window)
        # This will increment the counter only if it's a new 24h session for this user
        if user_id and user_id != "unknown":
            await track_conversation(business_id, user_id)
    
    # Resolve Context (Phase 3)
    lead_context = None
    offers_context = None
    
    # NEW: AI Intelligence Context Injection (Phase 3)
    # Only resolve context if system_instruction wasn't already provided by the route
    if business_id and not system_instruction:
        try:
            import asyncio
            from services.db_service import (
                get_lead_by_conversation, 
                get_active_offers_intelligence,
                get_business_profile, 
                get_knowledge_documents
            )
            
            # Fetch all context in parallel to reduce latency
            tasks = [
                get_lead_by_conversation(business_id, user_id),
                get_active_offers_intelligence(business_id),
                get_business_profile(business_id),
                get_knowledge_documents(business_id)
            ]
            
            lead_obj, offers_context, profile, knowledge_docs = await asyncio.gather(*tasks)

            lead_context = {
                "status": lead_obj.status if lead_obj else "new",
                "custom_fields": lead_obj.custom_fields if lead_obj else {}
            } if lead_obj else None
            
            if knowledge_docs:
                profile['knowledge_docs'] = knowledge_docs
            
            system_instruction = prompt_service.build_system_prompt(profile, lead_context=lead_context, offers_context=offers_context)
        except Exception as e:
            logger.error(f"Error resolving AI Context for Phase 3: {e}")
            # Fallback to provided or default prompt if resolution fails
            pass

    # Inject Hotel Room Directory & Availability if applicable and not already included
    if business_id and "HOTEL ROOMS DIRECTORY" not in (system_instruction or ""):
        try:
            from services.hotel_reservation_service import hotel_reservation_service
            hotel_rooms_context = await hotel_reservation_service.get_rooms_context_for_ai(business_id)
            if hotel_rooms_context:
                system_instruction = f"{system_instruction}\n\n{hotel_rooms_context}" if system_instruction else hotel_rooms_context
        except Exception as e:
            logger.error(f"Error appending hotel rooms context: {e}")

    # Enforce plain text output with no raw markdown headers/bolding in chats
    format_instruction = "IMPORTANT: Do NOT use markdown headers (e.g. #, ##, ###, ####) or markdown bolding/italics (e.g. **). Instead, format headers using normal text in UPPERCASE, and use plain text spacing and dashes for lists."
    if system_instruction:
        system_instruction = f"{system_instruction}\n\n{format_instruction}"
    else:
        system_instruction = format_instruction

    # Safety Check (Prompt Injection / Harmful Content)
    if not prompt_service.check_safety(user_message):
        logger.error(f"Safety violation detected from user {user_id}")
        return "I cannot answer that question as it violates our safety guidelines."

    messages = await prompt_service.construct_messages(user_message, conversation_history, system_instruction)

    try:
        # DEBUG: Log payload to file since we can't see the console
        debug_info = {
            "business_id": business_id,
            "user_id": user_id,
            "provider": PRIMARY_PROVIDER,
            "messages": messages
        }
        with open("last_ai_debug_payload.json", "w") as f:
            json.dump(debug_info, f, indent=2)
            
        AIServiceLogger.log_request(PRIMARY_PROVIDER, 
                                   GEMINI_MODEL if PRIMARY_PROVIDER == "gemini" else OPENROUTER_MODEL, 
                                   user_id)
        
        if PRIMARY_PROVIDER == "gemini":
            ai_content = await _call_gemini(messages)
        else:
            ai_content = await _call_openrouter(messages)
        
        # Log to DB (non-blocking)
        if business_id:
            try:
                model_used = GEMINI_MODEL if PRIMARY_PROVIDER == "gemini" else OPENROUTER_MODEL
                await log_prompt_execution(business_id, user_id, messages, ai_content, 
                                         meta={"model": model_used, "provider": PRIMARY_PROVIDER})
                
                # 3. Deduct Tokens after successful generation
                # Dynamic cost: 100 base + 1 per 10 characters
                cost = TOKEN_COSTS["ai_inference_base"] + (len(ai_content) // 10)
                await token_service.deduct_tokens(business_id, cost, "ai_inference", 
                                                metadata={"char_count": len(ai_content), "model": model_used})
            except Exception as e:
                logger.error(f"Post-AI token/log error: {e}")
        
        return clean_markdown_for_chats(ai_content)
                
    except httpx.TimeoutException:
        logger.error(f"AI TIMEOUT: Provider {PRIMARY_PROVIDER} did not respond within 40s.")
        return "The AI service is taking too long to respond. Please try again in a moment."
    
    except Exception as e:
        logger.error(f"CRITICAL AI FAILURE: {e}", exc_info=True)
        return f"I'm having trouble thinking right now. (Error: {str(e)})"


async def _call_gemini(messages: list) -> str:
    """Internal helper to call Google Gemini API"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    # Convert OpenAI-style messages
    system_instruction = None
    gemini_contents = []
    
    # Pre-process: Group and sanitize messages for Gemini's strict turn-taking
    current_role = None
    current_content = []
    
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        
        if role == "system":
            system_instruction = content
            continue
            
        # Map assistant to model
        mapped_role = "model" if role == "assistant" else "user"
        
        if mapped_role == current_role:
            # Merge adjacent messages of the same role
            current_content.append(content)
        else:
            # Save previous turn
            if current_role and current_content:
                gemini_contents.append({"role": current_role, "parts": [{"text": "\n\n".join(current_content)}]})
            
            # Start new turn
            current_role = mapped_role
            current_content = [content]
            
    # Add last turn
    if current_role and current_content:
        gemini_contents.append({"role": current_role, "parts": [{"text": "\n\n".join(current_content)}]})
        
    # Gemini CRITICAL: Must start with 'user'
    while gemini_contents and gemini_contents[0]["role"] != "user":
        gemini_contents.pop(0)

    # Gemini CRITICAL: Must not be empty
    if not gemini_contents:
        gemini_contents.append({"role": "user", "parts": [{"text": "Hello"}]})

    payload = {
        "contents": gemini_contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1000,
        }
    }
    
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, timeout=40.0)
        response.raise_for_status()
        
        data = response.json()
        if 'candidates' in data and data['candidates']:
            content = data['candidates'][0]['content']['parts'][0]['text']
            AIServiceLogger.log_response("gemini", response.status_code, len(content))
            return content
        
        raise ValueError(f"Empty or malformed Gemini response: {data}")

async def _call_openrouter(messages: list) -> str:
    """Internal helper to call OpenRouter API with mandatory headers"""
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    # FAIL FAST if mandatory headers are missing or improperly configured
    # OpenRouter strictly requires these to prevent key invalidation.
    valid_referer = OPENROUTER_REFERER and str(OPENROUTER_REFERER).strip() not in ["", "None", "undefined", "https://interact-ai.com"] # Force real referer in prod
    # Actually, let's just ensure it's not empty or "undefined"
    clean_referer = str(OPENROUTER_REFERER).strip()
    clean_title = str(OPENROUTER_TITLE).strip()

    if not clean_referer or clean_referer in ["None", "undefined"]:
        AIServiceLogger.log_error("openrouter", "config_error", f"Invalid OPENROUTER_REFERER: '{OPENROUTER_REFERER}'")
        raise ValueError("OpenRouter requires a valid HTTP-Referer header. Check your environment variables.")

    if not clean_title or clean_title in ["None", "undefined"]:
        AIServiceLogger.log_error("openrouter", "config_error", f"Invalid OPENROUTER_TITLE: '{OPENROUTER_TITLE}'")
        raise ValueError("OpenRouter requires a valid X-Title header. Check your environment variables.")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-Title": OPENROUTER_TITLE,
    }
    
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1000
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=40.0)
        
        # Explicitly handle 401/403 before raise_for_status to avoid keys being disabled if possible
        if response.status_code in [401, 403]:
            AIServiceLogger.log_error("openrouter", "authentication", response.text, response.status_code)
            # We raise so generate_response can catch and categorize
            response.raise_for_status()

        response.raise_for_status()
        
        data = response.json()
        if 'choices' in data and data['choices']:
            content = data['choices'][0]['message']['content']
            AIServiceLogger.log_response("openrouter", response.status_code, len(content))
            return content
        
        raise ValueError(f"Empty or malformed OpenRouter response: {data}")
