# InteracAI Instagram Direct Messages (DM) Implementation Specification
**Document Version:** 1.0.0  
**Status:** Implementation Blueprint  
**Target Channel:** Instagram Direct Messages (via Meta Graph API for Instagram)  

---

## 1. Overview & Account Prerequisites

Instagram Direct Messages integration allows businesses to converse with Instagram users directly through InteracAI's unified engine.

### Strict Meta Prerequisites:
1. **Account Type:** Must be an Instagram Professional Account (Business or Creator). Personal accounts are **not** supported by Meta APIs.
2. **Page Link:** The Instagram Professional account must be connected to a Facebook Page managed by the business.
3. **In-App Permissions:** The toggle **"Allow Access to Messages"** must be active inside the Instagram app:
   `Settings and privacy` -> `Messages and story replies` -> `Message controls` -> `Connected tools` -> `Allow access to messages` = **ON**.
4. **Meta Permissions:** `instagram_business_manage_messages`, `pages_manage_metadata`, `pages_show_list`.

---

## 2. Inbound Webhook Handling

### Webhook Event Details:
- **Object:** `instagram`
- **Field:** `messages`
- **Payload Schema:**
  ```json
  {
    "object": "instagram",
    "entry": [
      {
        "id": "<INSTAGRAM_BUSINESS_ACCOUNT_ID>",
        "time": 1736883512,
        "messaging": [
          {
            "sender": { "id": "<IGSID>" },
            "recipient": { "id": "<INSTAGRAM_BUSINESS_ACCOUNT_ID>" },
            "timestamp": 1736883512000,
            "message": {
              "mid": "aWdfZAG1faXRlbToxOklHTWVzc2FnZUlEOjE...",
              "text": "Do you have this dress in size 38?"
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
   - `external_account_id` = `entry.id` (Instagram Business Account ID).
   - `external_user_id` = `messaging[0].sender.id` (Customer IGSID).
   - `external_message_id` = `messaging[0].message.mid`.
   - `content` = `messaging[0].message.text`.

2. **Tenant Resolution:**
   - Looks up `BusinessMetaConfig` where `instagram_account_id == entry.id` or linked to `page_id`.
   - Resolves `business_id`.

3. **Message Deduplication:**
   - Deduplication key: `msg_dedup:{business_id}:instagram:{mid}`.
   - Prevents duplicate message rows, duplicate AI calls, and duplicate staff notifications.

4. **Conversation Entity:**
   - `conversation_id` = `f"{business_id}:ig_{igsid}"`.
   - Sets `channel = "instagram"`, `platform = "instagram"`.
   - If `mode == "human"`, skips AI processing and sends real-time alert to dashboard.

5. **24-Hour Messaging Window Enforcement:**
   - Meta imposes a strict 24-hour window from the customer's last incoming message.
   - InteracAI logs `last_customer_message_at = datetime.utcnow()` on the conversation.
   - If a human agent attempts to reply after 24 hours without an approved tag, the UI warns the agent.

6. **AI Response & Outbound Dispatch:**
   - Endpoint: `POST https://graph.facebook.com/v19.0/{PAGE_ID}/messages`
   - Authorization: `Bearer {PAGE_ACCESS_TOKEN}`
   - Payload:
     ```json
     {
       "recipient": { "id": "<IGSID>" },
       "messaging_type": "RESPONSE",
       "message": { "text": "<AI_REPLY>" }
     }
     ```
   - On HTTP 200/201: Outbound message stored in `messages`, tokens debited, WebSocket updated.

7. **Signal Intelligence & Observation:**
   - Normalized observation recorded via `observation_service.record_observation(db, org_id=business_id, source_channel="instagram", observation_type="product_enquiry", ...)`
   - ARGUS Core receives the observation.
   - Workflow engine triggers any active `"instagram_enquiry"` or `"purchase_intent"` workflows.
