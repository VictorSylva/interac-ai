# INTERACAI — BUSINESS INTEGRATION DISCOVERY CHECKLIST
**A Practical Discovery & Software Stack Consultation Guide for Client Engagements**

---

## 1. Meeting Overview & Strategy

When meeting with business owners, General Managers, Chief Information Officers, or Operations Directors, the sales representative or solutions architect should **never lead with technical platform features**.

Instead, lead with this core consultative positioning:
> **"We are not here to ask you to discard or replace your existing systems. We are here to understand the software tools your team already uses every day, identify where data gets stuck between departments, and show you how InteracAI can connect those systems to give you instant intelligence and automated coordination."**

---

## 2. The 6-Section Discovery Questionnaire

### Section 1: Business Profile & Organizational Scale
- **Client Organization Name**: _____________________________________________
- **Primary Business Vertical**:
  - `[ ] Hotel / Hospitality` (Total Rooms: ____ | Properties: ____)
  - `[ ] Retail / Supermarket` (Store Count: ____ | Checkout Lanes: ____)
  - `[ ] School / Education` (Total Students: ____ | Campuses: ____)
  - `[ ] Hospital / Healthcare` (Bed Count: ____ | Daily Outpatients: ____)
  - `[ ] Small Business / Services` (Monthly Active Clients: ____)
- **Key Decision Makers & Roles**: ___________________________________________
- **Total Operational Staff**: ____ (Frontline / Desk: ____ | Field / Mobile: ____)

---

### Section 2: Current Software Stack Inventory

Fill in the specific software brands the client currently runs:

| Department / Function | Software Name / Brand in Use | Deployment Type | Data Access Method |
|---|---|---|---|
| **Core Operating System** | *(e.g. Opera, Mews, OpenMRS, PowerSchool)* | `[ ] Cloud [ ] On-Premise [ ] Hybrid` | `[ ] REST API [ ] Webhook [ ] Excel Export [ ] None` |
| **Point of Sale (POS)** | *(e.g. Square, Moniepoint, Toast, Local POS)* | `[ ] Hardware Terminal [ ] Cloud App` | `[ ] Cloud Webhook [ ] Daily Reports [ ] None` |
| **Payments & Billing** | *(e.g. Paystack, Flutterwave, Bank Direct)* | `[ ] Payment Gateway [ ] Bank Portal` | `[ ] Instant Webhook [ ] Email Alert [ ] Paper` |
| **Customer / Guest Comms** | *(e.g. WhatsApp Business, Email, SMS)* | `[ ] Official API [ ] Mobile Device` | `[ ] Meta Cloud API [ ] Personal Device` |
| **Accounting & ERP** | *(e.g. QuickBooks, Sage, Xero, Excel)* | `[ ] Cloud SaaS [ ] Desktop License` | `[ ] Cloud API [ ] Monthly CSV Export` |
| **Physical Security** | *(e.g. Hikvision, Dahua, Uniview CCTV)* | `[ ] NVR / DVR [ ] IP Cameras` | `[ ] RTSP Stream [ ] Local Monitor Only` |
| **Access Control** | *(e.g. RFID Keycards, Smart PIN Locks)* | `[ ] Standalone [ ] Networked PMS` | `[ ] Network Log [ ] Standalone Lock` |

---

### Section 3: Operational Friction & Cross-Department Blindspots

Ask these probing questions to uncover high-value pain points:

1. **Information Latency**:
   - *"When a VIP arrives or a major transaction occurs, how many minutes or hours pass before management or the relevant department knows?"*
   - Client Response: _______________________________________________________
2. **Manual Repetition & Double-Entry**:
   - *"Do your staff ever have to re-type or copy data from your POS/PMS into WhatsApp chats, Excel sheets, or paper logbooks?"*
   - Client Response: _______________________________________________________
3. **Revenue Leakage & Reconciliation**:
   - *"How often do you discover discrepancies between what was billed on POS, what was collected at the bank/front desk, and what is recorded in accounting?"*
   - Client Response: _______________________________________________________
4. **Maintenance & Turnaround Delays**:
   - *"When an issue occurs (e.g. air conditioner failure in Room 204 or out-of-stock critical inventory), how is maintenance/procurement dispatched?"*
   - Client Response: _______________________________________________________

---

### Section 4: Technical Integration Feasibility Assessment

Evaluate the fastest connection pathway:

```
  ┌──────────────────────────────────────────────────────────┬─────────────────────────────┐
  │ Technical Capability Detected                            │ Recommended InteracAI Path  │
  ├──────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ Software supports Cloud Webhooks (e.g. Shopify, Mews)    │ 1-Click Webhook Ingestion   │
  │ Software supports REST API / API Keys (e.g. Paystack)    │ API Key Gateway Connector   │
  │ Software supports OAuth 2.0 (e.g. QuickBooks Online)     │ Direct OAuth Handshake      │
  │ Software is On-Prem / Desktop with CSV/Excel Export      │ Scheduled Tabular Importer  │
  │ Software only sends Transaction Confirmation Emails      │ Inbound Email Webhook Parser│
  │ CCTV Cameras have standard RTSP / ONVIF feeds            │ ARGUS Vision Agent RTSP Link│
  └──────────────────────────────────────────────────────────┴─────────────────────────────┘
```

---

### Section 5: Recommended 3-Tier Value Proposition

Present the tailored connection model to the client:

- **Level 1: Basic Connection (Data Ingestion & Unified View)**:
  - Consolidate all sales, bookings, and payments into a single real-time dashboard without touching your legacy software.
- **Level 2: Connected Intelligence (ARGUS Pattern & Anomaly Radar)**:
  - Cross-correlate physical camera feeds with POS/PMS transactions to detect fraud, sweethearting, and unrecorded entries automatically.
- **Level 3: Connected Operations (Automated Inter-Departmental Action)**:
  - Trigger instant WhatsApp and Email dispatches to Housekeeping, Maintenance, Cashiers, and Managers the second a business event happens.

---

### Section 6: Proposed 7-Day Pilot Scope

Define a low-risk, high-impact pilot:
- **Scope**: Connect 2 core systems (e.g. WhatsApp Business + Paystack / PMS Webhook).
- **Target Workflows**:
  1. Automated VIP Guest / Customer Arrival Alert.
  2. Instant WhatsApp Payment Receipt & Order Confirmation.
  3. Daily 6:00 AM Consolidated Executive Revenue Brief on WhatsApp.
- **Timeline**: Go live in **48 hours** with zero software replacement.
- **Success Criteria**: 100% automated notification delivery, zero manual data entry required.
