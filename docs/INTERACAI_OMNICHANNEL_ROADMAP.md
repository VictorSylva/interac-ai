# InteracAI Omnichannel Implementation Roadmap
**Document Version:** 1.0.0  
**Status:** Engineering Roadmap & Milestones  
**Target Completion:** Comprehensive Omnichannel Business Signal Intelligence Platform  

---

## 1. Engineering Roadmap Overview

```
[MILESTONE 1] Audit & Architectural Baseline (Completed)
      │
      ▼
[MILESTONE 2] Database Migration & Multi-Tenant Channel Config Foundation
      │
      ▼
[MILESTONE 3] Canonical Message Model & ChannelAdapter Framework
      │
      ▼
[MILESTONE 4] Facebook Messenger Integration (Ingress + Outbound)
      │
      ▼
[MILESTONE 5] Instagram Direct Messages Integration (Ingress + Outbound)
      │
      ▼
[MILESTONE 6] Social Comment Intelligence (Facebook & Instagram Comments + Comment-to-DM)
      │
      ▼
[MILESTONE 7] Omnichannel Observation Bus, ARGUS & Workflow Engine Integration
      │
      ▼
[MILESTONE 8] Frontend Omnichannel Inbox & Meta Configuration UI
      │
      ▼
[MILESTONE 9] End-to-End Verification & WhatsApp Regression Suite
```

---

## 2. Detailed Milestone Breakdown

### Milestone 1: Comprehensive Codebase Audit (COMPLETED)
- Audited existing WhatsApp chatbot implementation end-to-end.
- Catalogued routes, services, database models, background tasks, and environment variables.
- Verified ARGUS Core client, Observation Bus, Workflow Engine, and Department Routing services.
- Produced 11 foundational architectural blueprints in `docs/`.

### Milestone 2: Database Schema & Configuration Foundation
- Create `business_meta_configs` table supporting Facebook Page and Instagram credentials with Fernet encryption.
- Extend `conversations` and `messages` tables with `external_account_id`, `external_user_id`, `external_message_id`, `channel`, `source_post_id`, `source_comment_id`.
- Ensure non-destructive migrations compatible with both SQLite and PostgreSQL.

### Milestone 3: Canonical Message Model & ChannelAdapter Framework
- Implement `BaseChannelAdapter` abstract class in `services/channel_adapters/base.py`.
- Implement `WhatsAppChannelAdapter` wrapping existing WhatsApp logic without changing public behavior.
- Build `OmnichannelEngine` orchestrating message deduplication, conversation state, CRM linking, and AI response generation.

### Milestone 4: Facebook Messenger Ingestion & Outbound Integration
- Implement `MessengerChannelAdapter` with HMAC-SHA256 signature verification.
- Mount webhook endpoint `GET /meta/webhook` and `POST /meta/webhook`.
- Implement PSID-scoped conversation tracking and outbound Messenger API delivery.

### Milestone 5: Instagram Direct Messages Integration
- Implement `InstagramChannelAdapter` parsing Instagram-scoped events (`IGSID`).
- Enforce 24-hour messaging window rule.
- Implement outbound Instagram DM delivery via Meta Graph API.

### Milestone 6: Social Comment Intelligence & Comment-to-DM
- Ingest Facebook Page post comments (`feed` webhook) and Instagram media comments (`comments` webhook).
- Implement comment intent & sentiment classification (`PRICE_ENQUIRY`, `PURCHASE_INTENT`, `CUSTOMER_COMPLAINT`, etc.).
- Build risk-based response policy engine.
- Implement Comment-to-Private-Message workflow complying with Meta 7-day and 1-reply rules.

### Milestone 7: Observation Bus, ARGUS & Workflow Engine Wiring
- Normalize all channel events into canonical InteracAI observations (`ObservationV2`).
- Feed observations to ARGUS Core (`argus_core_client.emit_observation`).
- Wire channel triggers into `WorkflowEngine` (`messenger_message`, `instagram_message`, `facebook_comment`, `instagram_comment`).
- Connect department routing and staff notification cooldowns.

### Milestone 8: Frontend Omnichannel UI
- Enhance `Conversations.js` to render channel indicators (`[WhatsApp]`, `[Messenger]`, `[Instagram]`, `[Facebook Comment]`, `[Instagram Comment]`).
- Add channel filtering tabs.
- Add Meta Connection status in Integrations settings.

### Milestone 9: End-to-End Testing & WhatsApp Regression Verification
- Run automated simulation tests across all channels.
- Verify WhatsApp regression suite (100% pass).
- Verify human takeover and AI pause states across channels.

### Milestone 10: Future Channels (Phase Next)
- TikTok Direct Messages and Video Comments.
- X (formerly Twitter) Mentions and Direct Messages.
- Telegram Bot API.
- SMS / USSD (Twilio / Africa's Talking).
