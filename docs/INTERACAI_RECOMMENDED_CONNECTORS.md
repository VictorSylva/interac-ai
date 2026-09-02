# INTERACAI — RECOMMENDED CONNECTOR ROADMAP
**Ranked Top 10 High-Value Integrations for Nigerian & Global SME Commercial Success**

---

## 1. Prioritization Methodology

To maximize immediate market adoption and revenue growth, connectors are scored against 5 weighted criteria:
1. **Commercial Demand & Business Impact (30%)**: How many businesses use this tool and how critical is it to their daily cash flow?
2. **Nigeria & Emerging Market Relevance (25%)**: Does this tool dominate Nigerian SME commerce, hospitality, education, or healthcare?
3. **API Maturity & Developer Accessibility (20%)**: Does the vendor provide clean webhooks, public REST APIs, and sandbox environments?
4. **Implementation Velocity (15%)**: Can a production-quality connector be built and validated in under 5 business days?
5. **Multi-Tenant Scalability (10%)**: Does the connector support tenant-partitioned credentials and webhook routing?

---

## 2. Ranked Top 10 Connectors Matrix

| Rank | Connector Name | Target Vertical | Technical Difficulty | Commercial Value | Priority Status | Nigeria / Emerging Market Relevance |
|:---:|---|---|:---:|:---:|:---:|---|
| **01** | **Meta WhatsApp Cloud API** | All Industries | **Low** | **Extreme** | **Immediate (Built)** | #1 Customer communication channel across Africa & LATAM. Native support in InteracAI. |
| **02** | **Paystack Payment Gateway** | All Industries | **Low** | **Extreme** | **Immediate (Built)** | Dominant payment provider for cards, bank transfers, USSD, and Apple Pay in Nigeria/Ghana/SA. |
| **03** | **Shopify E-Commerce & POS** | Retail / Supermarkets | **Low** | **High** | **Immediate (Built)** | Leading global and African modern retail storefront for inventory and order management. |
| **04** | **Square / Moniepoint POS** | Retail / Restaurants | **Medium** | **High** | **Immediate (Built)** | Moniepoint/OPay dominate offline merchant acquiring; Square dominates boutique retail. |
| **05** | **Opera / Mews Hotel PMS** | Hotel / Hospitality | **Medium** | **High** | **Immediate (Built)** | Opera is the gold-standard enterprise PMS; Mews is the fastest-growing modern cloud PMS. |
| **06** | **Flutterwave API** | Commerce / Schools | **Low** | **High** | **Near-Term** | Comprehensive pan-African payment rails, multi-currency collections, and virtual accounts. |
| **07** | **QuickBooks Online API** | All SMEs | **Medium** | **High** | **Near-Term** | Standard small business accounting suite for automated invoice sync and expense reconciliation. |
| **08** | **OpenMRS / Bahmni EMR** | Hospitals / Clinics | **Medium** | **High** | **Near-Term** | Leading open-source and enterprise hospital management system across developing nations. |
| **09** | **Hikvision / Dahua RTSP Agent**| Retail / Security | **Medium** | **High** | **Near-Term** | 80%+ market share of CCTV DVR/NVR hardware in commercial establishments. |
| **10** | **Universal CSV / Excel Importer**| All Legacy Businesses | **Low** | **High** | **Near-Term** | The universal fallback connector for businesses running desktop software without cloud APIs. |

---

## 3. Deep Dive into Top 5 Connectors

### 01. Meta WhatsApp Cloud API
- **Why It Matters**: WhatsApp is the operational operating system of Nigerian business. Orders, inquiries, room service requests, parent-teacher chats, and customer support all occur on WhatsApp.
- **InteracAI Implementation**: `backend/services/whatsapp_service.py` receives inbound webhooks with 200 OK fast-acknowledgment, runs background AI intent extraction, maps phone numbers to `Customer` entities, and triggers automated workflow routing.

### 02. Paystack Payment Gateway
- **Why It Matters**: Paystack is the primary financial transaction gateway for retail, hospitality booking deposits, and tuition fees.
- **InteracAI Implementation**: `backend/routes/sales_routes.py` and `subscription_routes.py` verify SHA-512 HMAC signatures, check idempotency against `SalesWebhookLog.event_id`, perform backend-to-backend transaction verification callbacks, and emit `commerce.payment.received` observations.

### 03. Shopify E-Commerce & Point of Sale
- **Why It Matters**: Retailers need stock levels synchronized across online websites, mobile apps, and physical checkout desks without stock discrepancies.
- **InteracAI Implementation**: `backend/routes/retail_routes.py:949` consumes `orders/create` webhooks, maps SKUs to `product` dynamic entities, automatically decrements EAV stock attributes, and logs `pos_sale_recorded` observations.

### 04. Moniepoint / Square POS Terminal Webhooks
- **Why It Matters**: Physical in-person transactions require instant reconciliation against inventory and bank accounts to prevent cashier fraud.
- **InteracAI Implementation**: `backend/routes/retail_routes.py:1012` normalizes transaction IDs, total amounts, and terminal locations into unified POS sale observations.

### 05. Opera & Mews Property Management Systems
- **Why It Matters**: Hotels require instant inter-departmental notification upon guest arrival, departure, or room status change.
- **InteracAI Implementation**: `backend/routes/hotel_routes.py:1099` normalizes booking IDs, guest names, check-in dates, and room numbers into `EntityV2` and dispatches `hotel.reservation.created` signals.

---

## 4. What NOT to Build (Anti-Patterns to Avoid)

To protect engineering velocity and ensure long-term platform reliability, InteracAI strictly avoids:

```
  ┌─────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
  │ Anti-Pattern / Software Category                        │ Why InteracAI Rejects Direct Custom Connectors         │
  ├─────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 1. 1990s Desktop Database Direct ODBC/SQL Scraping      │ Extremely fragile, security liability, breaks on every │
  │    (Directly querying external MS Access / SQL Server)   │ vendor patch. Use Universal CSV Export instead.        │
  ├─────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 2. Proprietary Closed Hardware with Zero Public API     │ Reverse engineering proprietary protocols is slow and  │
  │    (Obscure non-standard smart locks)                   │ unreliable. Require standard Webhooks or MQTT bridges. │
  ├─────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 3. Niche Hyper-Local Single-Store POS Tools             │ Building custom code for a tool with 3 users wastes    │
  │                                                         │ engineering capacity. Use Generic Inbound Webhook.     │
  ├─────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 4. Full Reverse Database Replication                    │ InteracAI is an intelligence and orchestration overlay,│
  │                                                         │ not a physical replica database for third-party tools. │
  └─────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┘
```
