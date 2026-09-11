# InteracAI Channel Configuration & Credentials Management
**Document Version:** 1.0.0  
**Status:** Implementation Specification  
**Scope:** Multi-Tenant Credential Storage & Environment Configuration  

---

## 1. Multi-Tenant Meta Configuration Architecture

InteracAI is a multi-tenant platform. Each business connects its own Meta assets (WhatsApp Phone ID, Facebook Page ID, and Instagram Business Account).

### Backward Compatibility Principle:
- The existing `business_whatsapp_configs` table and its associated endpoints (`GET /api/whatsapp/config`, `POST /api/whatsapp/config`) remain **100% functional and untouched**.
- For Omnichannel Meta assets (Facebook Page, Messenger, Instagram DMs, and Comments), we introduce `business_meta_configs`.

---

## 2. Database Schema: `business_meta_configs`

```sql
CREATE TABLE IF NOT EXISTS business_meta_configs (
    id SERIAL PRIMARY KEY,
    business_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
    
    -- Facebook Page Credentials
    facebook_page_id VARCHAR,
    facebook_page_name VARCHAR,
    facebook_page_access_token TEXT, -- Encrypted using Fernet
    
    -- Instagram Credentials
    instagram_account_id VARCHAR,
    instagram_username VARCHAR,
    
    -- Shared Meta App Settings
    app_id VARCHAR,
    app_secret TEXT,                 -- Encrypted using Fernet
    verify_token VARCHAR,            -- Unique per business or app default
    
    -- Channel Feature Toggles
    messenger_active BOOLEAN DEFAULT FALSE,
    instagram_dm_active BOOLEAN DEFAULT FALSE,
    facebook_comments_active BOOLEAN DEFAULT FALSE,
    instagram_comments_active BOOLEAN DEFAULT FALSE,
    
    -- Webhook Verification & Connection Telemetry
    webhook_verified BOOLEAN DEFAULT FALSE,
    last_webhook_received_at TIMESTAMP,
    last_message_sent_at TIMESTAMP,
    connection_error TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_biz_meta_page_id ON business_meta_configs(facebook_page_id);
CREATE INDEX IF NOT EXISTS ix_biz_meta_ig_id ON business_meta_configs(instagram_account_id);
```

---

## 3. Environment Variables Specification

| Variable Name | Environment | Required? | Purpose | Sensitive? |
|---|---|---|---|---|
| `META_VERIFY_TOKEN` | All | Yes | Default verify token for webhook handshake | Yes |
| `META_APP_ID` | Production / Staging | Optional | Global default Meta application ID | No |
| `META_APP_SECRET` | Production / Staging | Optional | Global default Meta app secret for HMAC validation | Yes |
| `WHATSAPP_VERIFY_TOKEN` | All | Yes | Existing WhatsApp verify token (backward compatibility) | Yes |
| `WHATSAPP_API_TOKEN` | All | Optional | Fallback WhatsApp access token | Yes |
| `WHATSAPP_PHONE_NUMBER_ID`| All | Optional | Fallback WhatsApp phone number ID | No |
| `SECRET_KEY` | All | Yes | Fernet encryption key for encrypting tokens in DB | Yes |

---

## 4. API Endpoints for Meta Integrations Management

### 1. `GET /api/integrations/meta/config?business_id={bid}`
- **Authorization:** Bearer token (owner or admin).
- **Response:**
  ```json
  {
    "status": "success",
    "config": {
      "facebook_page_id": "1048107078375556",
      "facebook_page_name": "InteracAI Demo Page",
      "instagram_account_id": "17841400000000001",
      "instagram_username": "interacai_demo",
      "messenger_active": true,
      "instagram_dm_active": true,
      "facebook_comments_active": true,
      "instagram_comments_active": true,
      "webhook_verified": true,
      "last_webhook_received_at": "2026-09-11T14:30:00Z",
      "connection_error": null
    }
  }
  ```
- **Security Rule:** Sensitive tokens (`facebook_page_access_token`, `app_secret`) are **NEVER returned** to the frontend.

### 2. `POST /api/integrations/meta/config`
- **Request Body:**
  ```json
  {
    "business_id": "0bbd48c4-...",
    "facebook_page_id": "1048107078375556",
    "facebook_page_name": "InteracAI Store",
    "facebook_page_access_token": "EAAX...",
    "instagram_account_id": "17841400000000001",
    "instagram_username": "interacai_store",
    "app_id": "123456789",
    "app_secret": "abcdef...",
    "messenger_active": true,
    "instagram_dm_active": true,
    "facebook_comments_active": true,
    "instagram_comments_active": true
  }
  ```
- **Behavior:**
  - Encrypts `facebook_page_access_token` and `app_secret` via Fernet before storing in DB.
  - Updates `updated_at = datetime.utcnow()`.
