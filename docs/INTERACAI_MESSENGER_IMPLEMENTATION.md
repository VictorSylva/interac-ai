# InteracAI Facebook Messenger Implementation Specification
**Document Version:** 1.0.0  
**Status:** Implementation Blueprint  
**Target Channel:** Facebook Messenger (via Meta Graph API)  

---

## 1. Overview & Architecture

Facebook Messenger messages arrive at InteracAI via Meta Webhook subscriptions on the `page` object (`messages` field). The Messenger adapter ingests these events, normalizes them into `CanonicalEvent` structures, ensures message deduplication, manages conversation state, generates AI responses, and dispatches outbound messages back to the customer's Page-Scoped ID (PSID).

---

## 2. Inbound Webhook Handling & Verification

### Webhook Verification (`GET /meta/webhook` or `/messenger/webhook`)
- **Query Parameters:** `hub.mode`, `hub.verify_token`, `hub.challenge`
- **Verification Rule:** Matches `hub.verify_token` against `META_VERIFY_TOKEN` (global default) or the business-specific verify token stored in `BusinessMetaConfig`.
- **Response:** HTTP 200 with `int(hub.challenge)`.

### Signature Verification (`POST`)
- Every incoming webhook from Meta includes the header `X-Hub-Signature-256: sha256=<HMAC_HEX>`.
- The adapter computes `hmac.new(app_secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()`.
- If the signature does not match, returns HTTP 403 immediately to reject spoofed requests.

### Inbound Payload Schema:
```json
{
  "object": "page",
  "entry": [
    {
      "id": "<PAGE_ID>",
      "time": 1736883512,
      "messaging": [
        {
          "sender": { "id": "<PSID>" },
          "recipient": { "id": "<PAGE_ID>" },
          "timestamp": 1736883512000,
          "message": {
            "mid": "m_mid.1457764197618:41d10a3e22e0436987",
            "text": "Hello, how much is your service?"
          }
        }
      ]
    }
  ]
}
```

---

## 3. Data Processing & Normalization Flow

1. **Extract Identifiers:**
   - `external_account_id` = `entry.id` (Facebook Page ID).
   - `external_user_id` = `messaging[0].sender.id` (Customer PSID).
   - `external_message_id` = `messaging[0].message.mid`.
   - `content` = `messaging[0].message.text`.

2. **Tenant Resolution:**
   - Queries `BusinessMetaConfig` where `page_id == entry.id` to retrieve `business_id`.
   - If not found, falls back to `PRIMARY_BUSINESS_ID`.

3. **Message Deduplication (Idempotency):**
   - Key: `msg_dedup:{business_id}:messenger:{mid}`.
   - Checked in Redis / Cache and verified against `messages.external_message_id`. If duplicate, exits immediately with HTTP 200.

4. **Conversation Lookup / Creation:**
   - `conversation_id` = `f"{business_id}:fb_{psid}"`.
   - Sets `channel = "messenger"`, `platform = "messenger"`.
   - If `mode == "human"`, message is stored and AI response is skipped.

5. **Customer Profiling & CRM Association:**
   - Queries `leads` where `external_identities->'messenger' ? psid`.
   - If not found, creates or links lead with source `"facebook_messenger"`.

6. **Signal Detection & Observation Bus:**
   - Intent & Sentiment detected via `prompt_service`.
   - Normalized observation emitted via `observation_service.record_observation` to ARGUS Core.

7. **AI Generation & Action Execution:**
   - Uses unified `ai_service.generate_response(user_message, history, psid, business_id=business_id)`.
   - Action tags parsed (Leads, Appointments, PMS bookings).

8. **Outbound API Delivery:**
   - Endpoint: `POST https://graph.facebook.com/v19.0/{PAGE_ID}/messages`
   - Authorization: `Bearer {PAGE_ACCESS_TOKEN}`
   - Payload:
     ```json
     {
       "recipient": { "id": "<PSID>" },
       "messaging_type": "RESPONSE",
       "message": { "text": "<AI_REPLY>" }
     }
     ```
   - On HTTP 200/201: Message stored in `messages` table (`sender="agent"`), token wallet debited.
