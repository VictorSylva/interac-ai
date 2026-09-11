# InteracAI Omnichannel Conversation & Signal Intelligence Architecture
**Document Version:** 1.0.0  
**Architect:** Senior Staff Software Architect & Full-Stack Engineer  
**Status:** Approved Architectural Specification  
**Target Platform:** InteracAI Omnichannel Business Signal Intelligence Platform  

---

## 1. System Vision & Core Design Principles

InteracAI is evolving from a single-channel WhatsApp chatbot into an **Omnichannel Business Signal Intelligence Platform**.

### Critical Anti-Pattern to Avoid:
```
[DO NOT BUILD THREE INDEPENDENT CHATBOTS]
WhatsApp Chatbot  -->  [WhatsApp Logic] --> WhatsApp Customer
Messenger Chatbot -->  [Messenger Logic] --> Messenger Customer
Instagram Chatbot -->  [Instagram Logic] --> Instagram Customer
```

### The Target Architecture:
```
                            EXTERNAL SOCIAL & MESSAGING PLATFORMS
                     ┌──────────────────┬──────────────────┬──────────────────┐
                     │     WhatsApp     │ Facebook Page &  │ Instagram DMs &  │
                     │    Cloud API     │    Messenger     │     Comments     │
                     └─────────┬────────┴────────┬─────────┴────────┬─────────┘
                               │                 │                  │
                               ▼                 ▼                  ▼
                     ┌────────────────────────────────────────────────────────┐
                     │             INTERACAI CHANNEL ADAPTER LAYER            │
                     │  - WhatsAppAdapter       - MessengerAdapter            │
                     │  - InstagramDMAdapter    - FacebookCommentAdapter      │
                     │  - InstagramCommentAdapter                             │
                     └──────────────────────────┬─────────────────────────────┘
                                                │
                                                ▼  (Normalized)
                                     CANONICAL MESSAGE / EVENT
                                                │
                                                ▼
                     ┌────────────────────────────────────────────────────────┐
                     │          OMNICHANNEL CONVERSATION ENGINE               │
                     │  - Tenant Isolation (business_id)                      │
                     │  - Message Deduplication & Idempotency Store           │
                     │  - Channel Identity & Customer Profile Linking         │
                     │  - Human Mode / AI Takeover & Pause State              │
                     │  - Unified Message & Conversation Persistence          │
                     └─────────┬─────────────────┬──────────────────┬─────────┘
                               │                 │                  │
                               ▼                 ▼                  ▼
                      ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
                      │  AI GENERATION │ │    CUSTOMER    │ │ SIGNAL & INTENT│
                      │   (Gemini /    │ │  CRM PROFILE   │ │   DETECTION    │
                      │  DeepSeek)     │ │  (db_service)  │ │(prompt_service)│
                      └────────┬───────┘ └───────┬────────┘ └───────┬────────┘
                               │                 │                  │
                               └─────────────────┼──────────────────┘
                                                 │
                                                 ▼
                                     CANONICAL OBSERVATION BUS
                                   (services/observation_service)
                                                 │
                                                 ▼
                                          ARGUS CORE OS
                                   (services/argus_core_client)
                                                 │
                                                 ▼
                                     INTERACAI WORKFLOW ENGINE
                                    (services/workflow_engine)
                                                 │
                                                 ▼
                                     DEPARTMENT ROUTING ENGINE
                                     (services/routing_service)
                                                 │
                                ┌────────────────┴────────────────┐
                                ▼                                 ▼
                     DEPARTMENT NOTIFICATIONS              AUTOMATED ACTIONS
                     - Sales (WhatsApp/Push/Email)         - CRM Lead Update
                     - Customer Service (Escalation)       - Ticket Creation
                     - Management (Executive Alert)        - Hotel / POS Booking
```

---

## 2. Channel Adapter Pattern (`ChannelAdapter`)

Every incoming and outgoing message, comment, or event passes through a uniform, channel-agnostic interface:

```python
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class CanonicalEvent(BaseModel):
    event_id: str                      # Unique platform message ID or comment ID
    business_id: str                   # Tenant isolation ID
    channel: str                       # 'whatsapp' | 'messenger' | 'instagram' | 'facebook_comment' | 'instagram_comment' | 'web'
    event_type: str                    # 'message' | 'comment' | 'reaction' | 'post'
    direction: str                     # 'inbound' | 'outbound'
    external_account_id: str           # Phone Number ID / Facebook Page ID / Instagram Business Account ID
    external_user_id: str              # Customer Phone / PSID (Page-Scoped ID) / IGSID (Instagram Scoped ID)
    customer_name: Optional[str] = None
    content: str                       # Normalized text body
    timestamp: str                     # ISO UTC timestamp
    attachments: List[Dict[str, Any]] = []
    reply_to_id: Optional[str] = None
    source_post_id: Optional[str] = None     # For comments
    source_comment_id: Optional[str] = None  # For comment replies / private responses
    raw_payload: Dict[str, Any] = {}         # Audit reference

class BaseChannelAdapter(ABC):
    @abstractmethod
    def verify_webhook(self, params: Dict[str, str], verify_token: str) -> Optional[int]:
        """Validates the hub.mode and verify_token during Meta subscription handshake."""
        pass

    @abstractmethod
    def validate_signature(self, raw_body: bytes, signature_header: str, app_secret: str) -> bool:
        """Validates HMAC-SHA256 signature (X-Hub-Signature-256) using tenant App Secret."""
        pass

    @abstractmethod
    def parse_inbound_payload(self, raw_json: Dict[str, Any]) -> List[CanonicalEvent]:
        """Normalizes platform-specific JSON payload into CanonicalEvents."""
        pass

    @abstractmethod
    async def send_outbound(self, business_id: str, recipient_id: str, content: str, reply_to_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Dispatches an outbound message or comment response through platform API."""
        pass
```

### Concrete Adapter Implementations:
1. `WhatsAppChannelAdapter`: Handles WhatsApp Cloud API messages, template messages, and delivery receipts.
2. `MessengerChannelAdapter`: Handles Facebook Messenger incoming messages, quick-replies, and outbound PSID sends.
3. `InstagramChannelAdapter`: Handles Instagram Direct Messages, 24-hour messaging window enforcement, and outbound IGSID sends.
4. `FacebookCommentAdapter`: Handles Facebook Page post comments (`feed` webhook) and outbound comment responses.
5. `InstagramCommentAdapter`: Handles Instagram media comments and comment-to-private-reply flows.
6. `WebChannelAdapter`: Preserves web embed widget chat functionality.

---

## 3. Canonical Message & Conversation Model

To prevent breaking existing WhatsApp production data while supporting omnichannel messaging and social comments:

### Strategy: Extend Existing Schema (Safe & Backwards Compatible)
The existing `conversations` and `messages` tables already have `platform` fields and clean relational foreign keys. We extend them with safe, non-destructive columns:

#### `conversations` Table Additions:
- `external_account_id`: String (Phone ID, Page ID, or IG Account ID).
- `external_user_id`: String (WhatsApp Phone, Messenger PSID, Instagram IGSID).
- `channel`: String (`whatsapp`, `messenger`, `instagram`, `facebook_comment`, `instagram_comment`, `web`).
- `channel_metadata`: JSONB / JSON (stores post_id, media_url, permalink, etc.).
- `is_private_reply_eligible`: Boolean (tracks 7-day private reply window for comments).

#### `messages` Table Additions:
- `external_message_id`: String (Indexed, for deduplication e.g. `wamid`, Messenger `mid`, Facebook `comment_id`).
- `message_type`: String (`text`, `comment`, `private_reply`, `template`, `image`, `audio`).
- `channel`: String.
- `source_post_id`: String (nullable, for comment tracking).
- `source_comment_id`: String (nullable, for comment threading).
- `raw_metadata`: JSONB / JSON.

---

## 4. Channel Identity & Customer Profile Model

### Cross-Business Identity Isolation:
- A customer interacting with Business A will **NEVER** be merged with or visible to Business B.
- All customer identifiers are scoped to `business_id`.

### Identity Hierarchy:
1. **Channel-Specific Scoped Identity:**
   - WhatsApp: E.164 Phone Number (e.g. `2348000000000`).
   - Messenger: Page-Scoped ID (PSID) (e.g. `8500456493393924`).
   - Instagram DM / Comment: Instagram-Scoped ID (IGSID) (e.g. `17841400000000000`).
   - Web Chat: Session UUID or Cookie ID (e.g. `web_user_...`).

2. **Unified Customer Linking (CRM):**
   - Stored in `leads` table.
   - The `leads` model already contains `phones: JSON` and `emails: JSON`.
   - We extend `leads` with `external_identities: JSON` mapping:
     ```json
     {
       "whatsapp": ["2348000000000"],
       "messenger": ["8500456493393924"],
       "instagram": ["17841400000000000", "ig_username_chelsea"],
       "facebook": ["fb_john_doe"]
     }
     ```
   - Auto-linking is performed ONLY when verified identity markers match (e.g., customer provides their phone number or email during a Messenger/Instagram conversation). Unverified platform IDs are kept cleanly separate to prevent identity pollution.

---

## 5. Message Deduplication & Idempotency Store

Meta retries unacknowledged or delayed webhooks. The deduplication layer ensures zero duplicates across messages, workflows, AI replies, and staff alerts:

### Deduplication Architecture:
```
Incoming Webhook
      │
      ▼
Compute Deduplication Key:
f"msg_dedup:{business_id}:{channel}:{external_message_id}"
      │
      ├─► Step 1: Redis `SETNX` with 86400s (24h) TTL
      │     └─► If key exists: Log warning and return HTTP 200 {"status": "duplicate_ignored"} immediately.
      │
      └─► Step 2: Database Check
            └─► Check `messages.external_message_id == external_message_id AND messages.business_id == business_id`.
                  └─► If found: abort processing immediately.
```

---

## 6. Decoupled Processing: Customer AI Response vs Staff Notification

These two flows are strictly decoupled so customers receive immediate AI service while staff receive non-blocking, throttled intelligence alerts:

```
                          CANONICAL CUSTOMER MESSAGE
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        CUSTOMER RESPONSE FLOW                 STAFF NOTIFICATION FLOW
                   │                                     │
          Check Human Mode?                              │
          ├─► If HUMAN: Pause AI.                        │
          └─► If AI:                                     ▼
                Retrieve Context               Convert to Canonical Observation
                Generate LLM Reply             Submit to Observation Bus
                Strip Action Tags                        │
                Send Outbound Channel Msg                ▼
                                                    ARGUS CORE
                                                         │
                                                         ▼
                                                  WORKFLOW ENGINE
                                                         │
                                                         ▼
                                             DEPARTMENT ROUTING ENGINE
                                             (Checks notification cooldown)
                                                         │
                                                         ▼
                                              Staff Push / WhatsApp / Email
```

---

## 7. Human Takeover & Channel Ownership Preservation

### Native Meta Asset Ownership:
- Connecting Facebook Page or Instagram to InteracAI operates via official Meta Graph API webhooks and permissions.
- The business owner and their native Page managers retain full access to Facebook Page, Meta Business Suite, and the native Instagram mobile app. InteracAI does **not** take over or lock out native apps.

### Dual-Inbox Synchronization & Conflict Prevention:
1. **AI Mode (`mode="ai"`):**
   - InteracAI automatically responds to incoming inquiries.
   - Outbound messages are tagged with `sender="bot"`.
2. **Human Mode (`mode="human"`):**
   - When a human agent sends a message from InteracAI Dashboard, `mode` is set to `"human"`.
   - When native Meta Business Suite responses are detected (messages where `is_echo: true` or `sender_id == PAGE_ID`), InteracAI marks `mode="human"` to avoid bot conflict.
3. **Agent Release / Resolve:**
   - Clicking "Resolve" or `/resolve` switches the conversation back to `mode="ai"`.
