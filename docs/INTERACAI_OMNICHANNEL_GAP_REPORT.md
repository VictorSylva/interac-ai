# InteracAI Omnichannel Gap Report
**Document Version:** 1.0.0  
**Status:** Audit & Feasibility Assessment  
**Standard:** Truth-in-Architecture (Zero False Claims)  

---

## 1. Feature-by-Feature Implementation Status

| Feature / Component | Classification | Evidence & Current Code State | What Needs to be Implemented |
|---|---|---|---|
| **WhatsApp Inbound Webhook** | **REAL** | Active at `/whatsapp/webhook` (`services/whatsapp_service.py:21-78`). Receives and parses Meta payload. | Add cryptographic HMAC-SHA256 signature validation and message deduplication. |
| **WhatsApp Outbound API** | **REAL** | Active via `send_whatsapp_message()` (`services/whatsapp_service.py:260-305`). Graph API v17.0. | Encapsulate within `WhatsAppChannelAdapter`. |
| **WhatsApp Keyword Escalation** | **REAL** | Active in `whatsapp_service.py:127-135`. Detects human handover keywords. | Move into shared omnichannel routing pipeline. |
| **AI Generation Engine** | **REAL** | Active in `services/ai_service.py:67`. Supports Gemini & DeepSeek/OpenRouter. | Fully reusable without changes. |
| **Intent & Sentiment Detection** | **REAL** | Active in `services/prompt_service.py:44-82`. Rule-based keyword matching. | Extend taxonomy to support social comment intents (`PURCHASE_INTENT`, `AVAILABILITY_ENQUIRY`, `LOCATION_ENQUIRY`, `SPAM`). |
| **Observation Bus** | **REAL** | Active in `services/observation_service.py:93`. Inserts `ObservationV2` and syncs to ARGUS Core. | Connect all channel adapters to emit standardized observations. |
| **ARGUS Core Client** | **REAL** | Active in `services/argus_core_client.py:7`. Emits observations via HTTP POST. | Fully reusable without changes. |
| **Workflow Engine** | **REAL** | Active in `services/workflow_engine.py:17`. Triggers on `message_created`, `intelligence_event`, etc. | Add trigger types: `messenger_message`, `instagram_message`, `facebook_comment`, `instagram_comment`. |
| **Department Routing** | **REAL** | Active in `services/routing_service.py:10`. 6-level routing hierarchy. | Fully reusable without changes. |
| **Staff Notifications** | **REAL** | Active in `services/notification_service.py:141`. WhatsApp, WebPush, and Resend Email. | Fully reusable without changes. |
| **Facebook Messenger Ingestion** | **MISSING** | No dedicated Messenger webhook endpoint or PSID parser currently exists in `routes/` or `services/`. | Implement `MessengerChannelAdapter` and register webhook route. |
| **Facebook Messenger Outbound** | **MISSING** | Outbound messages are currently sent only to WhatsApp endpoints (`phone_id/messages`). | Implement Messenger outbound send using Page Access Token and PSID. |
| **Instagram DM Ingestion** | **MISSING** | No Instagram webhook handler or IGSID parser currently exists. | Implement `InstagramChannelAdapter` and register webhook route. |
| **Instagram DM Outbound** | **MISSING** | No Instagram outbound endpoint handler exists. | Implement Instagram outbound send adhering to Meta 24-hr window. |
| **Facebook Comments Ingestion** | **MISSING** | No `feed` webhook listener or comment classification exists. | Implement `FacebookCommentAdapter` and risk-based response policy. |
| **Instagram Comments Ingestion** | **MISSING** | No Instagram `comments` webhook listener exists. | Implement `InstagramCommentAdapter` and intent classification. |
| **Comment → Private Reply Flow** | **MISSING** | Meta's `POST /{PAGE_ID}/messages` with `comment_id` is not currently implemented. | Implement compliant Comment-to-DM flow adhering to 7-day and 1-reply limits. |
| **Meta Channel Credentials UI** | **PARTIAL** | UI has `WhatsAppSetup.js` for WhatsApp credentials only (`phone_number_id`, `access_token`). | Add Meta Omnichannel Settings tab / page for Facebook Page ID, Page Token, and Instagram Account ID. |
| **Omnichannel Inbox (Frontend)** | **PARTIAL** | `Conversations.js` displays conversations and has badges for `whatsapp` and `web`. | Add badges and filters for `messenger`, `instagram`, `facebook_comment`, `instagram_comment`. |

---

## 2. Technical Blockers & Third-Party Dependencies

1. **Meta App Review for Production:**
   - In development mode, Facebook Pages and Instagram accounts can interact with App Administrators and Test Users immediately.
   - For public external users, Meta requires submitting the Meta App for App Review for permissions:
     - `pages_messaging`
     - `pages_read_engagement`
     - `pages_manage_metadata`
     - `instagram_business_manage_messages`
     - `instagram_business_manage_comments`
   - *Mitigation:* The codebase will provide 100% production-compliant code, signature verification, and simulated test suites so development and testing proceed seamlessly prior to final Meta App Review.

2. **Instagram Personal Accounts Unsupported by Meta:**
   - Personal Instagram accounts cannot connect to the Meta Graph API.
   - *Mitigation:* Clear in-app UI guidance directing merchants to convert their Instagram account to a Professional (Business or Creator) account.
