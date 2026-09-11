# InteracAI Omnichannel Demo Playbook
**Document Version:** 1.0.0  
**Target Scenario:** Retail & Commerce Small Business Demo  
**Audience:** Executive Team, Sales Engineers, and Business Customers  

---

## 1. Demo Scenario 1: Instagram Comment → Private Sale Conversion

### Narrative:
A luxury boutique in Lagos (`Amaka Couture`) posts a photo of a new silk jumpsuit on Instagram. A prospective customer comments publicly asking for the price. InteracAI detects the price inquiry, posts an automated public reply, launches a private direct message, answers delivery questions, captures purchase intent, alerts the sales team, and registers a qualified lead in the CRM.

```
[1] Customer on Instagram:
    "How much for this jumpsuit?" (Public Comment)
       │
       ▼
[2] InteracAI Ingestion & Classification:
    - Ingested via Instagram Webhook
    - Intent: PRICE_ENQUIRY (Confidence: 0.96)
    - Observation: obs_ig_comment_01 emitted to ARGUS Core
       │
       ▼
[3] Public Response (Graph API):
    Amaka Couture: "Hi @customer! We've sent you the full pricing and size guide via DM. Please check your inbox! ✨"
       │
       ▼
[4] Private Message Initiated (Comment-to-DM):
    Amaka Couture (AI): "Hello! The Midnight Silk Jumpsuit is ₦55,000. It's available in sizes 8 through 16 with nationwide delivery. Which size do you wear?"
       │
       ▼
[5] Customer Replies in Instagram DMs:
    "I'm a size 12. Can you deliver to Abuja before Friday?"
       │
       ▼
[6] AI Contextual Response & Sales Signal Detection:
    AI: "Yes, we ship to Abuja via DHL Express! Orders placed today arrive in 48 hours (Thursday). The delivery fee is ₦4,500."
    - Signal Detected: PURCHASE_INTENT (Confidence: 0.94)
    - Lead Created in CRM: Name="Instagram Customer", Source="instagram_dm", Status="qualified"
    - Department Routed: Sales
       │
       ▼
[7] Sales Department Notification:
    - WebPush alert on Sales Agent screen: "🔥 High Intent Lead on Instagram (Abuja Delivery)"
    - Staff WhatsApp notification dispatched to Amaka Couture sales line
       │
       ▼
[8] Conversation Live in InteracAI Inbox:
    - Appears in InteracAI Dashboard under [Instagram] badge
    - Agent can take over anytime or let AI generate payment link
```

---

## 2. Demo Scenario 2: Facebook Messenger Lead & Booking

### Narrative:
A client visits the company Facebook Page and clicks "Send Message":
1. **Customer:** *"Do you offer web development packages for dental clinics?"*
2. **InteracAI:** Identifies `enquiry` intent, consults dental clinic knowledge doc, and replies with service details and portfolio links.
3. **Customer:** *"Can we schedule a 15-minute consultation tomorrow at 3pm?"*
4. **InteracAI:** Parses appointment request, checks business availability rules, schedules appointment in `appointments` table, and returns confirmation link.
5. **Staff Alert:** Scheduling notification sent to account executive.

---

## 3. Demo Scenario 3: Critical Social Complaint De-Escalation

### Narrative:
A dissatisfied customer comments on a Facebook Page post:
1. **Comment:** *"I paid two days ago and nobody has responded to my messages, this is ridiculous!"*
2. **InteracAI Ingestion:**
   - Intent: `CUSTOMER_COMPLAINT`
   - Sentiment: `Negative` (Score: 0.90)
   - Risk: `CRITICAL`
3. **Automated Risk Policy:**
   - **Blocks generic bot reply** to avoid angering the customer publicly.
   - Posts brand de-escalation response: *"We sincerely apologize for the delay. A senior manager has been notified and will message you directly right now to resolve this immediately."*
   - Marks conversation `mode = "human"`, `status = "waiting"`, `department = "support"`.
   - Fires high-priority escalation alert to Customer Service Manager via WhatsApp and Email.
