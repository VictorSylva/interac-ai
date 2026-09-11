# InteracAI Social Comment Intelligence & Comment-to-DM Architecture
**Document Version:** 1.0.0  
**Status:** Implementation Blueprint  
**Channels:** Facebook Page Comments & Instagram Media Comments  

---

## 1. Executive Summary & Purpose

Social media comments represent high-value public customer interactions. Treating comments as "just chat messages" fails because:
1. Comments are **public** and impact brand reputation.
2. Blanket automated replies risk spam penalties and public embarrassment.
3. High purchase-intent comments (e.g. *"How much?", "Is this available in Lagos?"*) must be captured quickly into sales pipelines.
4. Negative complaints require immediate customer service attention and brand de-escalation.

InteracAI treats social comments as **First-Class Business Signals** with a risk-based response policy and seamless Comment-to-Private-Message capabilities.

---

## 2. Inbound Webhook Specifications

### Facebook Page Comments (Webhook Ingestion)
- **Object:** `page`
- **Field:** `feed`
- **Payload Filter:** `entry[].changes[].value.item == "comment"` and `value.verb == "add"`.
- **Payload Example:**
  ```json
  {
    "object": "page",
    "entry": [
      {
        "id": "<PAGE_ID>",
        "time": 1736883512,
        "changes": [
          {
            "field": "feed",
            "value": {
              "item": "comment",
              "verb": "add",
              "comment_id": "122171791988062460_1145958153811736",
              "post_id": "145003002023821_122171791988062460",
              "parent_id": "122171791988062460_1271076160608936",
              "message": "How much for delivery to Abuja?",
              "sender_id": "8500456493393924",
              "sender_name": "Sarah O.",
              "created_time": 1736883512
            }
          }
        ]
      }
    ]
  }
  ```

### Instagram Media Comments (Webhook Ingestion)
- **Object:** `instagram`
- **Field:** `comments`
- **Payload Example:**
  ```json
  {
    "object": "instagram",
    "entry": [
      {
        "id": "<INSTAGRAM_BUSINESS_ACCOUNT_ID>",
        "time": 1736883512,
        "changes": [
          {
            "field": "comments",
            "value": {
              "id": "17923456789012345",
              "text": "How much is this please?",
              "media": {
                "id": "17898765432109876",
                "media_product_type": "FEED"
              },
              "from": {
                "id": "17841400000000001",
                "username": "amaka_couture"
              }
            }
          }
        ]
      }
    ]
  }
  ```

---

## 3. Signal Classification Taxonomy

Every ingested comment is processed by `prompt_service.classify_social_comment` into a structured signal:

| Signal Type | Keywords / Examples | Priority | Department Routed | Action Taken |
|---|---|---|---|---|
| `PRICE_ENQUIRY` | "how much", "cost", "price", "quote", "rate" | Medium | Sales | Public acknowledgment + Private reply with pricing details |
| `PURCHASE_INTENT` | "i want to buy", "order now", "send account", "how to pay" | High | Sales | Lead created in CRM, Sales notification dispatched, Private order link sent |
| `AVAILABILITY_ENQUIRY` | "in stock?", "do you have size 42", "color blue available" | Medium | Sales / Inventory | Inventory check + Product availability response |
| `DELIVERY_ENQUIRY` | "delivery to Abuja", "shipping fee", "how long to deliver" | Medium | Logistics / Operations | Delivery timeline response |
| `LOCATION_ENQUIRY` | "where is your shop", "address", "location" | Low | General / Support | Automated store address response |
| `CUSTOMER_COMPLAINT` | "haven't received my order", "terrible service", "scam", "broken" | Critical | Customer Service & Management | Escalated to Human Mode, high-priority staff alert, public de-escalation |
| `NEGATIVE_FEEDBACK` | "too expensive", "bad quality", "poor customer care" | High | Customer Service | Sentiment score logged, review ticket created |
| `POSITIVE_FEEDBACK` | "love this", "fast delivery", "awesome", "thank you" | Low | Marketing | Public brand appreciation reply |
| `PARTNERSHIP_ENQUIRY` | "collab", "wholesale", "influencer", "bulk order", "partnership" | High | Management / Business Dev | Executive notification dispatched |
| `SPAM` | crypto promotions, scam links, profanity, repeated gibberish | Low | Security / Auto-Filter | Flagged or hidden via Graph API |

---

## 4. Response Policy Engine (Risk-Based Automation)

```
INCOMING COMMENT
       │
       ▼
Extract Content & Sender
       │
       ▼
Classify Intent, Sentiment, Risk Level
       │
       ├─────────────────────────────────────────┐
       ▼                                         ▼
[LOW RISK]                              [MEDIUM & HIGH RISK]
- Positive feedback                     - Complaints, Negative feedback
- Location enquiry                      - Price / Purchase enquiries
- General greeting                      - Partnership proposals
       │                                         │
       ▼                                         ▼
Action:                                 Action:
Optional polite public reply            1. Record Canonical Observation
(e.g., "Thanks for reaching out! ❤️")     2. Submit to ARGUS Core
                                        3. Route to Department (Sales/Support)
                                        4. Trigger Workflow
                                        5. Initiate Comment-to-DM (if Price/Order)
```

---

## 5. Comment → Private Conversation Flow (Comment-to-DM)

Where Meta's API permissions permit, InteracAI initiates a private conversation from a public comment:

### Step 1: Detect Private-Eligible Intent
Customer comments: *"How much is this?"* (`PRICE_ENQUIRY`).

### Step 2: Send Official Meta Private Reply
- **Endpoint:** `POST https://graph.facebook.com/v19.0/{PAGE_ID}/messages`
- **Headers:** `Authorization: Bearer {PAGE_ACCESS_TOKEN}`
- **Payload:**
  ```json
  {
    "recipient": {
      "comment_id": "17923456789012345"
    },
    "message": {
      "text": "Hi @amaka_couture! The Classic Navy Blazer is ₦45,000 with free delivery within Lagos. Would you like to check available sizes?"
    }
  }
  ```

### Step 3: Optional Public Confirmation Comment
InteracAI posts a friendly public reply to the comment:
- **Endpoint:** `POST https://graph.facebook.com/v19.0/{COMMENT_ID}/replies` (Instagram) or `/{COMMENT_ID}/comments` (Facebook)
- **Message:** *"Hi! We've sent you the pricing details via direct message. Please check your inbox or message requests! 😊"*

### Step 4: Private Conversation Continuation
When the user responds to the private message, Meta sends a standard `messages` webhook event. InteracAI's omnichannel engine continues the conversation seamlessly, tracks lead data, and generates a sales opportunity.
