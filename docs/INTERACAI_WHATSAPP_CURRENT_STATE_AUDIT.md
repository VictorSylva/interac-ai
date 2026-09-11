# InteracAI WhatsApp Current State Architecture Audit
**Document Version:** 1.0.0  
**Audit Date:** 2026-09-11  
**Auditor Role:** Senior Staff Software Architect & Full-Stack Engineer  
**Codebase Base Path:** `c:\Users\HomePC\Desktop\interac-ai`  

---

## 1. Executive Summary & Objective

This document provides a comprehensive, ground-truth audit of the existing WhatsApp chatbot implementation within InteracAI. Every finding in this document is verified against active source code in `backend/` and `frontend/`. 

The objective of this audit is to:
1. Map the exact end-to-end lifecycle of WhatsApp events in InteracAI.
2. Identify what is production-critical vs. development/fallback behavior.
3. Catalogue all database models, routes, services, environment variables, and background tasks.
4. Establish the exact regression baseline so that expanding InteracAI into an **Omnichannel Business Signal Intelligence Platform** (adding Facebook Messenger, Instagram DMs, Facebook Comments, and Instagram Comments) preserves 100% of existing WhatsApp functionality without regression.

---

## 2. Complete End-to-End WhatsApp Message Lifecycle

```
META GRAPH API (WhatsApp Cloud API)
       │
       ▼ (HTTPS POST webhook)
[1] /whatsapp/webhook (backend/services/whatsapp_service.py:receive_message)
       │
       ├─► Quick Validation: checks data["entry"][0]["changes"][0]["value"]["messages"]
       ├─► Returns HTTP 200 {"status": "accepted_for_processing"} immediately
       └─► Background Task: process_whatsapp_message_task(from_number, msg_body, phone_id)
              │
              ▼
[2] Business Tenancy Resolution (db_service.py:get_business_id_by_phone_id)
       │
       ├─► Look up BusinessWhatsAppConfig by phone_number_id
       └─► Fallback if unconfigured: PRIMARY_BUSINESS_ID env or "groupcopac@gmail.com"
              │
              ▼
[3] Entitlement & Access Gate (subscription_service.py:check_access)
       │
       ├─► Check plan status, conversation limits, token balance
       └─► If rejected: sends "Access Denied" via WhatsApp & terminates
              │
              ▼
[4] Conversation Session Tracking (subscription_service.py:track_conversation)
       │
       └─► Tracks unique active user within 24h rolling window
              │
              ▼
[5] Conversation State & Mode Check (chat.py:Conversation)
       │
       ├─► Conversation ID: f"{business_id}:{from_number}"
       └─► IF mode == "human":
             ├─► Store message: db_service.py:store_message(..., sender="customer", platform="whatsapp")
             ├─► Emit Observation & WebSocket broadcast
             └─► Return immediately (AI response paused!)
              │
              ▼ (mode == "ai")
[6] Inbound Message Storage & Observation (db_service.py:store_message)
       │
       ├─► Insert Message record (sender="customer", platform="whatsapp")
       ├─► Update Conversation (last_message, last_timestamp, unread_count += 1)
       ├─► Emit observation to ARGUS Core client (emit_observation)
       └─► WebSocket Broadcast (NEW_MESSAGE event to business dashboard)
              │
              ▼
[7] Intent & Sentiment Detection (prompt_service.py)
       │
       ├─► detect_intent(msg_body) -> rule/keyword matching from prompts/intents.json
       └─► analyze_sentiment(msg_body) -> lexicon polarity score (0.0 to 1.0)
              │
              ▼
[8] Human Escalation Keywords Check (whatsapp_service.py:127-135)
       │
       ├─► Handover keywords: ["human", "agent", "support", "representative", "person", "talk to someone"]
       └─► IF auto_escalate_on_keyword is True AND keyword in message:
             ├─► set_conversation_mode(business_id, from_number, mode="human", status="waiting", department="support")
             ├─► send_whatsapp_message("I'm transferring you to a human agent now. Please wait...")
             └─► Return immediately
              │
              ▼
[9] Workflow Engine Trigger (workflow_engine.py:trigger_workflow)
       │
       ├─► Event: "message_created"
       ├─► Trigger data: {from_number, message_body, platform="whatsapp", business_id, intent, sentiment, keywords}
       ├─► Evaluates active workflows for business
       └─► IF workflow executes and takes_over_chat is True:
             └─► Return immediately (workflow script or human handoff handles conversation)
              │
              ▼ (No workflow takeover)
[10] Conversation History Retrieval (db_service.py:get_chat_history)
       │
       └─► Fetch last 5 messages for f"{business_id}:{from_number}"
              │
              ▼
[11] AI Response Generation (ai_service.py:generate_response)
       │
       ├─► Provider selection: Google Gemini (gemini-1.5-pro) or OpenRouter (deepseek-chat)
       ├─► Context resolution: Business profile, FAQ, custom instructions, leads, offers
       ├─► Token deduction pre-check: TOKEN_COSTS["ai_inference_base"]
       └─► LLM generation with action/analysis schema prompt
              │
              ▼
[12] AI Action Parsing & Extraction (whatsapp_service.py:164-247)
       │
       ├─► Lead Capture: [ACTION: LEAD_CAPTURE | {name, email, phone, ...}] -> db_service.save_lead()
       ├─► Funnel Progression: [ACTION: FUNNEL_PROGRESS | {offer_id, funnel_id, step}] -> behavior_analytics_service.track_event()
       ├─► Hotel Reservation: [ACTION: HOTEL_RESERVATION | {...}] -> hotel_reservation_service.create_reservation_from_ai()
       ├─► Text fallback reservation extraction if confirmation phrases detected
       ├─► Intent/Sentiment tag extraction: [ANALYSIS: intent | sentiment]
       └─► Strip raw action and analysis tags from customer-facing text
              │
              ▼
[13] Outbound Message Persistence (db_service.py:store_message)
       │
       ├─► Insert Message record (sender="agent", platform="whatsapp", intent=final_intent, sentiment=final_sentiment)
       ├─► Update Conversation (last_message, last_timestamp, unread_count = 0)
       └─► WebSocket Broadcast (NEW_MESSAGE event)
              │
              ▼
[14] Outbound WhatsApp API Delivery (whatsapp_service.py:send_whatsapp_message)
       │
       ├─► Normalize phone to E.164 without '+' (e.g. 2348000000000)
       ├─► Credential lookup: get_whatsapp_config(business_id) -> access_token, phone_number_id
       │     └─► Fallback to DEFAULT_API_TOKEN / DEFAULT_PHONE_ID
       ├─► HTTP POST https://graph.facebook.com/v17.0/{phone_id}/messages
       ├─► Payload: {"messaging_product": "whatsapp", "to": to_number, "text": {"body": text}}
       └─► On 200/201: Deduct outbound tokens (token_service.deduct_tokens)
```

---

## 3. Detailed Component Map (Stage-by-Stage)

### Stage 1: Webhook Verification (GET)
- **File:** `backend/services/whatsapp_service.py` (lines 21–40)
- **Route:** `GET /whatsapp/webhook` (included via `app.include_router(whatsapp_router, prefix="/whatsapp")` in `backend/main.py:453`)
- **Parameters:** `hub.mode`, `hub.verify_token`, `hub.challenge`
- **Environment Variable:** `WHATSAPP_VERIFY_TOKEN` (default: `"interact_secret_token"`)
- **Current Behavior:** If `hub.mode == "subscribe"` and `hub.verify_token == WHATSAPP_VERIFY_TOKEN`, returns `int(hub.challenge)` with HTTP 200. Otherwise raises `HTTPException(403, "Verification failed")`.
- **Limitation:** Single global verify token check. Does not dynamically resolve verify tokens per business from database during the handshake.

### Stage 2: Webhook Event Ingestion (POST)
- **File:** `backend/services/whatsapp_service.py` (lines 42–78)
- **Route:** `POST /whatsapp/webhook`
- **Payload Structure Expected:**
  ```json
  {
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "<WABA_ID>",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": { "display_phone_number": "...", "phone_number_id": "..." },
          "contacts": [{ "profile": { "name": "..." }, "wa_id": "..." }],
          "messages": [{ "from": "...", "id": "wamid....", "timestamp": "...", "text": { "body": "..." }, "type": "text" }]
        },
        "field": "messages"
      }]
    }]
  }
  ```
- **Current Behavior:** Validates presence of `data["entry"][0]["changes"][0]["value"]["messages"]`. Returns `{"status": "accepted_for_processing"}` immediately to satisfy Meta's 3-second SLA and spawns `background_tasks.add_task(process_whatsapp_message_task, from_number, msg_body, phone_id)`.
- **Limitations:**
  1. Only extracts the first message (`value["messages"][0]`).
  2. Does not handle non-text messages (e.g. images, audio, documents, location, interactive quick-replies) — ignores payloads where `msg_body` is empty.
  3. Does not validate `X-Hub-Signature-256` request header using `APP_SECRET`.
  4. Does not deduplicate based on `message["id"]` (`wamid`) at ingestion; retries will re-trigger background processing.

### Stage 3: Business Tenancy Resolution
- **File:** `backend/services/whatsapp_service.py` (lines 87–93) & `backend/services/db_service.py` (lines 537–545, 1274–1285)
- **Function:** `get_business_id_by_phone_id(phone_id: str)`
- **Database Model:** `BusinessWhatsAppConfig` (table: `business_whatsapp_configs`)
- **Behavior:** Queries `BusinessWhatsAppConfig.business_id` where `phone_number_id == phone_id`.
- **Fallback:** If not found in DB, falls back to `PRIMARY_BUSINESS_ID` environment variable, or `"groupcopac@gmail.com"`, then calls `resolve_business_id()`.
- **Security Check:** Ensures the business exists in `businesses` table.

### Stage 4: Access & Entitlement Checks
- **File:** `backend/services/subscription_service.py`
- **Function:** `check_access(business_id)`
- **Checks:**
  - Business subscription status (`active`, `trialing`, `past_due`, `cancelled`).
  - Active conversation allowance under current tier (Starter, Growth, Pro, Enterprise).
  - Token balance in `TokenWallet`.
- **Behavior on Failure:** Sends notification to user: `"Access Denied: {reason}"` via WhatsApp and halts execution.

### Stage 5: Conversation State & Human Takeover Handling
- **File:** `backend/services/whatsapp_service.py` (lines 107–116)
- **Database Model:** `Conversation` (table: `conversations`)
- **Key Fields:** `id` (`f"{business_id}:{from_number}"`), `mode` (`"ai"` | `"human"`), `status` (`"active"` | `"waiting"` | `"closed"`), `assigned_agent_id`, `department`.
- **Behavior:**
  - If `convo.mode == "human"`, InteracAI stores the inbound message via `store_message()`, broadcasts via WebSocket to the live agent dashboard, triggers notification to assigned agent / owner, and skips AI generation.
  - This prevents AI from interrupting an active human conversation.

### Stage 6: Inbound Message Persistence & Canonical Store
- **File:** `backend/services/db_service.py` (lines 143–263)
- **Function:** `store_message(business_id, user_id, text, sender, platform="web", intent=None, sentiment=None)`
- **Database Models:**
  - `Conversation` (finds or creates with `id=f"{business_id}:{user_id}"`, `platform=platform`, `customer_name=user_id`).
  - `Message` (table: `messages`, `business_id`, `conversation_id`, `text`, `sender`, `platform`, `timestamp`, `intent`, `sentiment`).
- **Stats Updated:** `last_message`, `last_timestamp`, `unread_count` (+1 for customer, reset to 0 for agent), `last_intent`, `last_sentiment`.

### Stage 7: Real-Time Signal & ARGUS Emission
- **File:** `backend/services/db_service.py` (lines 198–228) & `backend/services/argus_core_client.py`
- **Function:** `emit_observation(...)`
- **Payload Emitted:**
  - `source_system`: `platform` (`"whatsapp"`)
  - `entity_type`: `"customer"`
  - `entity_id`: `user_id`
  - `confidence`: `1.0`
  - `metadata`: `{message_text, sender, intent, sentiment, business_id}`
  - `relationships`: `[{"target_type": "business", "target_id": business_id, "type": "COMMUNICATED_WITH"}]`
  - `severity`: `"info"`
- **Target:** `ARGUS_CORE_URL` (`http://argus_core:8003/api/v1/observations/`).
- **Resilience:** Fails gracefully without throwing if ARGUS Core is offline.

### Stage 8: Real-Time UI Broadcast (WebSocket)
- **File:** `backend/services/socket_manager.py` (lines 230–243)
- **Function:** `socket_manager.broadcast_to_business(business_id, event_dict)`
- **Event:** `NEW_MESSAGE` containing conversation ID, user ID, message text, sender, platform, mode, status, and department. Updates agent UI instantly.

### Stage 9: Keyword Auto-Escalation & Intent Analysis
- **File:** `backend/services/prompt_service.py` & `backend/services/whatsapp_service.py` (lines 122–135)
- **Functions:**
  - `prompt_service.detect_intent(msg_body)` -> Matches against `prompts/intents.json`.
  - `prompt_service.analyze_sentiment(msg_body)` -> Heuristic polarity scoring.
- **Auto-escalation logic:**
  - Handover keywords: `["human", "agent", "support", "representative", "person", "talk to someone"]`.
  - If `biz_profile.get("auto_escalate_on_keyword")` is true and keyword matched:
    - Sets `Conversation.mode = "human"`, `status = "waiting"`, `department = "support"`.
    - Dispatches response: `"I'm transferring you to a human agent now. Please wait..."`.
    - Halts further AI generation.

### Stage 10: Workflow Engine Execution
- **File:** `backend/services/workflow_engine.py` (lines 17–168)
- **Function:** `workflow_engine.trigger_workflow(business_id, trigger_type, trigger_data)`
- **Trigger Type:** `"message_created"`
- **Matches:** Active workflows where `trigger_type in ["message_created", "keyword", "intent", "keyword_detected", "intent_detected", "ai_sentiment"]`.
- **Takeover Logic:** If workflow contains customer-facing action nodes (`"send_message"`, `"route_to_department"`, `"assign_agent"`, `"escalate_to_human"`, `"wait_for_reply"`), `takes_over_chat = True`.
- **Result:** If `executions and takes_over_chat`, WhatsApp service yields control to the workflow and skips default AI generation.

### Stage 11: AI Response Generation
- **File:** `backend/services/ai_service.py` (lines 67–200)
- **Function:** `generate_response(user_message, conversation_history, user_id, system_instruction, business_id)`
- **Providers Supported:**
  - Primary: Google Gemini (`gemini-1.5-pro`) via `GEMINI_API_KEY`.
  - Alternative: OpenRouter (`deepseek/deepseek-chat`) via `OPENROUTER_API_KEY`.
- **Context Assembled:**
  - Business profile (industry, description, services, tone, faq, custom_instructions, location, hours).
  - Knowledge documents (RAG / uploaded files / scraped URLs).
  - Active offers / catalog products from `services.sales_service`.
  - Lead context (existing contact details, tags, previous interactions).
- **Instruction Prompts:** Uses structured output tags for autonomous business actions:
  - `[ACTION: LEAD_CAPTURE | {...}]`
  - `[ACTION: FUNNEL_PROGRESS | {...}]`
  - `[ACTION: HOTEL_RESERVATION | {...}]`
  - `[ANALYSIS: <intent> | <sentiment>]`

### Stage 12: Action Execution & Tag Stripping
- **File:** `backend/services/whatsapp_service.py` (lines 160–247)
- **Parsers:**
  1. Regex parses `[ACTION: LEAD_CAPTURE]` and calls `db_service.save_lead()`.
  2. Regex parses `[ACTION: FUNNEL_PROGRESS]` and tracks progression in `behavior_analytics_service`.
  3. Regex parses `[ACTION: HOTEL_RESERVATION]` and executes booking via `hotel_reservation_service.create_reservation_from_ai()`.
  4. Extracts `[ANALYSIS: intent | sentiment]` to update conversation metadata.
  5. Strips all bracketed action tags from `ai_reply` so customer receives clean text.

### Stage 13: Outbound WhatsApp Delivery
- **File:** `backend/services/whatsapp_service.py` (lines 260–305)
- **Function:** `send_whatsapp_message(to_number, text, business_id)`
- **Credentials:**
  - Encrypted credentials retrieved via `get_whatsapp_config(business_id)`.
  - Decrypted in memory using `decrypt_token()`: `access_token`, `phone_number_id`.
  - Fallback to `DEFAULT_API_TOKEN` and `DEFAULT_PHONE_ID`.
- **Endpoint:** `POST https://graph.facebook.com/v17.0/{phone_id}/messages`
- **Token Deduction:** On HTTP 200/201, calls `token_service.deduct_tokens(business_id, TOKEN_COSTS["whatsapp_outbound"], "whatsapp_outbound")`.

### Stage 14: Department Routing & Staff Notification
- **Files:** `backend/services/routing_service.py` & `backend/services/notification_service.py`
- **6-Level Routing Hierarchy:**
  - Level 1: Explicitly assigned agent on `Conversation.assigned_agent_id`.
  - Level 2: Department primary agent (`DepartmentConfig.primary_user_id`).
  - Level 3: Department WhatsApp phone (`DepartmentConfig.notification_phone`).
  - Level 4: Department Email (`DepartmentConfig.notification_email`).
  - Level 5: Business owner fallback.
  - Level 6: System administrator fallback.
- **Channels:** WebPush (VAPID), WhatsApp Template/Message, Resend Email.
- **Anti-Spam:** Enforces conversation notification cooldown (default 5–30 minutes) and records deduplication keys in `business_notification_events`.

---

## 4. WhatsApp Configuration & Settings UI Audit

### Backend Endpoints:
- `GET /api/whatsapp/config?business_id={bid}`: Returns phone number ID, business account ID, app ID, activation status, and webhook verification status (tokens masked/decrypted internally).
- `POST /api/whatsapp/config`: Receives `WhatsAppConfigRequest`, encrypts `app_secret` and `access_token` via Fernet (`encrypt_token`), and upserts `BusinessWhatsAppConfig`.
- `POST /api/whatsapp/test-message?business_id={bid}&phone={phone}`: Sends a live test ping through Meta Cloud API to verify credentials, and on success marks `is_active = True`.

### Frontend Component:
- **File:** `frontend/src/pages/WhatsAppSetup.js`
- **Route:** `/dashboard/whatsapp-setup` (nav item: `"WhatsApp Integration"`)
- **Features:** 3-step wizard (Credentials Input -> Webhook Setup Instructions -> Live Connection Test & Verification).

---

## 5. Database Schema Baseline

### `business_whatsapp_configs` Table:
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | Integer | No | Primary Key |
| `business_id` | String | No | Foreign Key (`businesses.id`), Unique |
| `phone_number_id` | String | Yes | Meta Phone Number ID |
| `business_account_id` | String | Yes | Meta WABA ID |
| `app_id` | String | Yes | Meta App ID |
| `app_secret` | Text | Yes | Fernet Encrypted |
| `access_token` | Text | Yes | Fernet Encrypted |
| `webhook_verified` | Boolean | No | Default `False` |
| `is_active` | Boolean | No | Default `False` |
| `created_at` | DateTime | No | UTC default |
| `updated_at` | DateTime | No | UTC default |

### `conversations` Table:
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | String | No | Primary Key (format: `{business_id}:{user_id}`) |
| `business_id` | String | No | Foreign Key (`businesses.id`) |
| `customer_name` | String | Yes | Contact name or phone |
| `platform` | String | Yes | `"whatsapp"`, `"web"`, etc. |
| `mode` | String | No | `"ai"` (default) or `"human"` |
| `assigned_agent_id` | String | Yes | Foreign Key (`users.id`) |
| `status` | String | No | `"active"`, `"waiting"`, `"closed"` |
| `last_message` | Text | Yes | Text snippet of latest message |
| `last_timestamp` | DateTime | Yes | Indexed timestamp of last activity |
| `last_message_at` | DateTime | Yes | UTC timestamp |
| `conversation_start_at` | DateTime | Yes | UTC timestamp |
| `is_active` | Boolean | No | Default `True` |
| `unread_count` | Integer | No | Default `0` |
| `last_intent` | String | Yes | e.g. `"pricing"`, `"support"` |
| `last_sentiment` | String | Yes | `"Positive"`, `"Negative"`, `"Neutral"` |
| `department` | String | Yes | `"sales"`, `"support"`, `"billing"`, etc. |

### `messages` Table:
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | Integer | No | Primary Key, Indexed |
| `business_id` | String | No | Foreign Key (`businesses.id`) |
| `conversation_id` | String | No | Foreign Key (`conversations.id`) |
| `text` | Text | Yes | Message text content |
| `sender` | String | No | `"customer"`, `"agent"`, `"bot"` |
| `timestamp` | DateTime | No | Indexed UTC timestamp |
| `platform` | String | Yes | `"whatsapp"`, `"web"`, etc. |
| `status` | String | No | `"sent"`, `"pending"`, `"failed"` |
| `intent` | String | Yes | Detected intent |
| `sentiment` | String | Yes | Detected sentiment |

---

## 6. Environment Variables Catalogue

| Variable Name | Required? | Sensitive? | Purpose | Location Used |
|---|---|---|---|---|
| `WHATSAPP_VERIFY_TOKEN` | Yes | Yes | Meta Webhook subscription handshake token | `whatsapp_service.py:16`, `config/__init__.py:40` |
| `WHATSAPP_API_TOKEN` | Optional | Yes | Global fallback system access token | `whatsapp_service.py:18` |
| `WHATSAPP_PHONE_NUMBER_ID`| Optional | No | Global fallback phone number ID | `whatsapp_service.py:19` |
| `PRIMARY_BUSINESS_ID` | Optional | No | Fallback business ID if phone ID unmapped | `whatsapp_service.py:91` |
| `OPENROUTER_API_KEY` | Conditional| Yes | DeepSeek AI response generation | `ai_service.py:28` |
| `GEMINI_API_KEY` | Conditional| Yes | Google Gemini AI response generation | `ai_service.py:34` |
| `ARGUS_CORE_URL` | Yes | No | ARGUS Core service endpoint | `argus_core_client.py:23` |
| `REDIS_URL` | Yes | No | PubSub for ARGUS surveillance alerts | `argus_listener.py:12` |
| `SECRET_KEY` | Yes | Yes | Token encryption & JWT signing | `session.py`, `auth_service.py` |
| `DATABASE_URL` | Yes | Yes | PostgreSQL / SQLite connection string | `session.py:12` |

---

## 7. Known Limitations of Existing WhatsApp Implementation

1. **No Cryptographic Webhook Validation:** WhatsApp webhook (`/whatsapp/webhook`) does not verify the `X-Hub-Signature-256` HMAC signature using Meta App Secret. Anyone can send forged POST requests.
2. **Missing Message Deduplication:** Meta retries unacknowledged or delayed webhooks. The current endpoint generates duplicate messages and duplicate AI responses if a webhook payload is retransmitted.
3. **Hardcoded Text-Only Support:** Non-text media (images, audio, videos, documents, location pins) are ignored without recording an interaction or notifying the customer.
4. **Single-Message Processing:** `value["messages"][0]` only processes the first message in an array; batched messages from Meta are dropped.
5. **No Public Comment Processing:** Meta WhatsApp API is strictly private messaging; there is no social comment or public interaction processing in the current architecture.
6. **Platform Hardcoding:** Several files (e.g. `main.py:523`) check `if platform == "whatsapp": send_whatsapp_message(...)` rather than delegating to an omnichannel adapter.

---

## 8. Summary of Reusability for Omnichannel Expansion

- **100% Reusable:** AI generation engine (`ai_service.py`), Prompt & Intent service (`prompt_service.py`), Lead/CRM capture (`db_service.save_lead`), Observation Bus (`observation_service.py`), ARGUS Core client (`argus_core_client.py`), Workflow Engine (`workflow_engine.py`), Department Routing (`routing_service.py`), Notification Service (`notification_service.py`), Token Wallet & Billing (`token_service.py`).
- **Needs Abstraction:** Channel ingress & egress, webhook signature validation, external ID resolution, message deduplication, conversation model (`Conversation.platform` and `Conversation.id`), and human reply dispatching.
