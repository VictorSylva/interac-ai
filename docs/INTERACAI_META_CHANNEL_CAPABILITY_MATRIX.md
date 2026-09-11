# InteracAI Meta Channel Capability Matrix & API Reality Check
**Document Version:** 1.0.0  
**Verification Standard:** Official Meta Graph API (v17.0–v20.0) Specifications  
**Status:** Ground-Truth Specification (No Placeholder / No Fake Capabilities)  

---

## 1. Meta Channel Capability Matrix

| Channel / Feature | Supported by Meta? | Account Type Required | Required Meta Permissions | Webhook Object & Field | Outbound API Endpoint | Limitations & Rules | Implementation Status in InteracAI |
|---|---|---|---|---|---|---|---|
| **WhatsApp Cloud API** | Yes | WhatsApp Business Account (WABA) + Verified Phone | `whatsapp_business_management`, `whatsapp_business_messaging` | Object: `whatsapp_business_account`<br>Field: `messages` | `POST https://graph.facebook.com/v17.0/{PHONE_ID}/messages` | - 24-hr customer service window for free-form replies.<br>- Approved templates required outside 24-hr window.<br>- Phone number cannot be used on standard consumer WhatsApp app simultaneously. | **REAL / PRODUCTION-READY**<br>(Active in `services/whatsapp_service.py`) |
| **Facebook Messenger** | Yes | Facebook Page (Any Category) | `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement` | Object: `page`<br>Field: `messages`, `messaging_postbacks` | `POST https://graph.facebook.com/v19.0/{PAGE_ID}/messages` | - Standard 24-hour messaging window for free-form responses.<br>- Message tags required outside 24-hr window (e.g. `CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`, `ACCOUNT_UPDATE`, `HUMAN_AGENT`).<br>- Recipient identifier is PSID (Page-Scoped ID), not a phone number or Facebook Profile ID. | **DESIGNED / READY FOR IMPLEMENTATION** (Phase 6) |
| **Instagram Direct Messages (DMs)** | Yes | Instagram Professional (Business or Creator) connected to a Facebook Page | `instagram_business_manage_messages`, `pages_manage_metadata`, `pages_show_list` | Object: `instagram`<br>Field: `messages` | `POST https://graph.facebook.com/v19.0/{PAGE_ID}/messages` (or `{IG_USER_ID}/messages`) | - **PERSONAL ACCOUNTS ARE NOT SUPPORTED BY META API**.<br>- Account must be converted to Professional/Business or Creator.<br>- "Allow Access to Messages" toggle must be enabled in Instagram App Settings -> Privacy -> Messages.<br>- Standard 24-hour messaging window applies.<br>- Recipient identifier is IGSID (Instagram-Scoped ID). | **DESIGNED / READY FOR IMPLEMENTATION** (Phase 7) |
| **Facebook Page Comments** | Yes | Facebook Page | `pages_manage_metadata`, `pages_read_engagement` | Object: `page`<br>Field: `feed`<br>(Filter: `value.item == "comment"` & `value.verb == "add"`) | `POST https://graph.facebook.com/v19.0/{COMMENT_ID}/comments` | - Webhook event is on `feed`, NOT a separate "comments" field.<br>- Can post public replies to comments.<br>- Subject to Page rate limits and spam filters. | **DESIGNED / READY FOR IMPLEMENTATION** (Phase 8) |
| **Instagram Media Comments** | Yes | Instagram Professional (Business or Creator) | `instagram_business_manage_comments`, `pages_manage_metadata` | Object: `instagram`<br>Field: `comments` | `POST https://graph.facebook.com/v19.0/{COMMENT_ID}/replies` | - Only works for media owned by the professional account (Posts, Reels, Carousel).<br>- Only receives comments created by external users.<br>- Public replies must be relevant to avoid Meta algorithmic demotion. | **DESIGNED / READY FOR IMPLEMENTATION** (Phase 9) |
| **Comment → Private Message (Facebook)** | Yes | Facebook Page | `pages_messaging`, `pages_read_engagement` | Object: `page`<br>Field: `feed` | `POST https://graph.facebook.com/v19.0/{PAGE_ID}/messages`<br>Payload: `{"recipient": {"comment_id": "<COMMENT_ID>"}, "message": {"text": "..."}}` | - **Can only be sent within 7 days of comment creation**.<br>- **Maximum of ONE private reply per comment**.<br>- Once user replies, standard 24-hour conversation window opens. | **DESIGNED / READY FOR IMPLEMENTATION** (Phase 10) |
| **Comment → Private Message (Instagram)** | Yes | Instagram Professional Account | `instagram_business_manage_messages`, `instagram_business_manage_comments` | Object: `instagram`<br>Field: `comments` | `POST https://graph.facebook.com/v19.0/{PAGE_ID}/messages`<br>Payload: `{"recipient": {"comment_id": "<COMMENT_ID>"}, "message": {"text": "..."}}` | - **Can only be sent within 7 days of comment creation**.<br>- **Maximum of ONE private reply per comment**.<br>- For Instagram Live comments, private message must be sent *during* broadcast.<br>- Arrives in user's direct inbox if they follow the account, or Message Requests folder if they do not. | **DESIGNED / READY FOR IMPLEMENTATION** (Phase 10) |

---

## 2. Meta API Restrictions & Honest Truths

### 1. Personal Accounts vs. Professional Accounts
- **Reality:** Meta strictly prohibits third-party API automation on personal Instagram profiles.
- **InteracAI Stance:** The InteracAI connection wizard explicitly informs the merchant: *"Instagram integration requires an Instagram Business or Creator account connected to your Facebook Page. Personal profiles cannot be connected to Meta's developer APIs."*

### 2. The 24-Hour Messaging Policy (Standard Messaging Window)
- **Reality:** Once a customer sends a message on Messenger or Instagram DM, InteracAI has **24 hours** to respond with free-form AI or agent messages.
- Outside the 24-hour window, outbound messages are blocked unless tagged with an approved Meta Message Tag (such as `HUMAN_AGENT` which extends the window to 7 days for human agents, or `CONFIRMED_EVENT_UPDATE` / `POST_PURCHASE_UPDATE`).
- Marketing/promotional outreach outside the 24-hour window is strictly prohibited by Meta on Messenger and Instagram without Sponsored Messages.

### 3. One Private Reply Per Social Comment
- Meta strictly enforces a single private reply per comment ID. Attempting a second private reply to the same `comment_id` returns Graph API error `(#100) Parameter recipient[comment_id] has already received a private reply`.
- InteracAI tracks `is_private_replied` in the database to prevent API errors and token waste.

### 4. Native App Access
- Connecting Facebook or Instagram to InteracAI through Meta's official API **does NOT lock out the merchant** or disconnect the Facebook Page or Instagram mobile app. The owner can continue viewing and replying inside the native Instagram or Facebook apps.
- InteracAI uses webhook echo listeners to synchronize human replies made inside native apps.
