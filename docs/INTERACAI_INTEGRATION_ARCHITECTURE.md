# INTERACAI — INTEGRATION ARCHITECTURE SPECIFICATION
**The Unified Software Connection, Signal Translation & Orchestration Overlay**

---

## 1. Executive Summary & Core Philosophy

Modern businesses do not suffer from a lack of software; they suffer from **fragmented, siloed software**. A medium-sized hotel or supermarket runs between 4 to 12 disconnected applications:
- A legacy Property Management System (Opera, Mews, Cloudbeds, Hotelogix)
- Point-of-Sale hardware terminals (Square, Toast, Moniepoint, local POS)
- Payment gateways (Paystack, Flutterwave, Stripe)
- Direct customer communication channels (WhatsApp, Email, SMS)
- Physical surveillance and access control (CCTV DVRs, smart door locks, RFID keycards)
- Accounting and tax suites (QuickBooks, Sage, Xero, FIRS portals)

Forcing a business to replace its core PMS, POS, or Accounting software introduces unacceptable operational disruption, staff retraining costs, and business risk.

**InteracAI's Strategic Paradigm**:
> **"InteracAI does NOT replace existing software. InteracAI sits above and between a business's existing software stack as an intelligent signal aggregator, reasoning engine, and cross-department orchestration layer."**

```
                     EXISTING BUSINESS SOFTWARE STACK
      ┌─────────────┬─────────────┬─────────────┬─────────────┐
      │ Hotel PMS / │ Retail POS /│ Payment /   │ WhatsApp /  │
      │ Hospital EMR│ School SIS  │ Accounting  │ CCTV Sensors│
      └──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
             │             │             │             │
             │ Webhook     │ Polling/REST│ API Keys    │ Redis/RTSP
             ▼             ▼             ▼             ▼
      ┌───────────────────────────────────────────────────────┐
      │          INTERACAI CONNECTOR GATEWAYS                │
      │   (Ingestion, Signature Verification, Rate Limiting)  │
      └──────────────────────────┬────────────────────────────┘
                                 │ Raw Event Payload
                                 ▼
      ┌───────────────────────────────────────────────────────┐
      │           CANONICAL SIGNAL NORMALIZER                 │
      │ • Schema Extraction      • Deduplication & Idempotency│
      │ • Entity Resolution      • Risk & Severity Scoring    │
      └──────────────────────────┬────────────────────────────┘
                                 │ Normalized Observation (ObservationV2)
                                 ▼
      ┌───────────────────────────────────────────────────────┐
      │                 OBSERVATION BUS                       │
      │  (Pub/Sub, Risk Score Aggregation, Graph Triples)     │
      └──────────────┬─────────────────────────┬──────────────┘
                     │                         │
                     ▼                         ▼
      ┌──────────────────────────┐  ┌─────────────────────────┐
      │       ARGUS CORE OS      │  │     WORKFLOW ENGINE     │
      │ • Cross-system Fusion    │  │ • DAG Step Execution    │
      │ • Physical + Digital Link│  │ • Condition Branching   │
      │ • Autonomous Risk Radar  │  │ • Template Hydration    │
      └──────────────┬───────────┘  └──────────┬──────────────┘
                     │ Intelligence Alert      │ Automated Action
                     └─────────────┬───────────┘
                                   │
                                   ▼
      ┌───────────────────────────────────────────────────────┐
      │           6-TIER DEPARTMENT ROUTING SERVICE           │
      │  Level 1: Assigned Agent   Level 4: Dept Email Group  │
      │  Level 2: Dept Primary     Level 5: Business Owner/GM │
      │  Level 3: Dept WhatsApp    Level 6: System Fallback   │
      └──────────────────────────┬────────────────────────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
         OPERATIONAL DEPARTMENTS     EXECUTIVE MANAGEMENT
          (Front Desk, Housekeeping,  (Real-Time Analytics,
           Maintenance, Security)      Audit Trail, Decisions)
```

---

## 2. Ingestion Methods & Transport Protocols

InteracAI connects to external business software via 8 distinct transport protocols, tailored to the technical maturity of the client's existing software:

```
┌───────────────────────────┬───────────────────────────────┬──────────────────────────────────────────┐
│ Ingestion Protocol        │ External System Example       │ InteracAI Implementation                 │
├───────────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 1. Inbound Webhooks       │ Shopify, Paystack, Mews, Meta │ FastAPI POST routers with HMAC signature │
│ 2. Scheduled REST Polling │ QuickBooks, Xero, OpenMRS     │ Celery beat workers querying delta logs  │
│ 3. Native API Webhooks    │ Square POS, Cloudbeds PMS     │ Domain-specific payload normalizers      │
│ 4. CSV / Excel File Sync  │ Legacy local PMS, Desktop POS │ Asynchronous batch tabular parser        │
│ 5. Physical Stream Telemetry│ CCTV cameras, Door locks    │ Redis Pub/Sub (`surveillance_alerts`)    │
│ 6. Email-Based Scraping   │ Legacy OTA emails, Bank alerts│ Inbound SMTP / Webhook parser            │
│ 7. WhatsApp Inbound Chat  │ Customer WhatsApp chats       │ Meta Cloud API webhook with 200 OK async │
│ 8. Outbound HTTP Webhooks │ External ERP / Custom APIs    │ `workflow_engine.py` HTTP Action Node    │
└───────────────────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

---

## 3. Detailed Component Architecture

### 3.1 Connector Gateways (`backend/routes/`)
- **PMS Webhook Gateway** (`backend/routes/hotel_routes.py:1099`):
  - Ingests `BOOKING_CREATED`, `CHECK_IN`, `CHECK_OUT`, `ROOM_ASSIGNED` from Opera, Mews, or Cloudbeds.
  - Normalizes external booking identifiers into `external_ref_id`.
- **E-Commerce & POS Webhook Gateway** (`backend/routes/retail_routes.py:949`):
  - Ingests Shopify order events and Square POS terminal transactions.
  - Decrements local stock in dynamic entity catalogs without modifying SQL schema.
- **Billing & Payment Webhook Gateway** (`backend/routes/sales_routes.py:273`, `routes/subscription_routes.py:232`):
  - Ingests Paystack charge success events.
  - Enforces backend-to-backend verification callbacks (`verify_paystack_transaction`) before fulfilling transactions.
- **WhatsApp Webhook Gateway** (`backend/services/whatsapp_service.py:42`):
  - Ingests inbound Meta Cloud API messages, acknowledges with `200 OK` in <50ms, and offloads processing to FastAPI `BackgroundTasks`.

### 3.2 Canonical Signal Normalizer & Observation Bus (`backend/services/observation_service.py`)
- Translates messy, proprietary vendor payloads into unified `ObservationV2` records:
  - `org_id`: Tenant UUID for multi-tenant isolation.
  - `source_channel`: Connector identifier (e.g. `shopify_connector`, `mews_webhook`, `cctv_yolo`).
  - `observation_type`: Normalized platform event (e.g. `pos_sale_recorded`, `guest_checkin`, `unauthorized_room_entry`).
  - `primary_entity_id`: UUID of the resolved `EntityV2` instance.
  - `location_label`: Physical or logical location (e.g. `Room 304`, `Aisle 4`, `Checkout Lane 2`).
  - `payload`: Standardized JSON payload.
  - `severity`: `INFO` | `WARNING` | `CRITICAL`.
  - `confidence`: Float `0.0` to `1.0`.
  - `risk_score_impact`: Float increment applied to target entity's cumulative risk score.
- Assembles ARGUS graph relationship triples (`HAS_RESERVATION`, `ASSIGNED_ROOM`, `ACCESS_EVENT_AT`, `CHARGED_TO_FOLIO`).
- Dispatches observations asynchronously to ARGUS Core API (`POST /api/v1/observations/`).

### 3.3 ARGUS Core Intelligence Overlay (`argus-core/app/services/`)
- **Fusion Engine** (`fusion_engine.py`): Correlates physical sightings (CCTV) with digital transactions (POS/PMS).
- **Risk Engine** (`risk_engine.py`): Computes multi-factor entity risk scores and detects anomalies (e.g. cash drawer open without active transaction, vacant room door opened).
- **Timeline Engine** (`timeline_engine.py`): Compiles cross-system chronological footprints for guests, employees, and assets.

### 3.4 Workflow Engine & Department Routing (`backend/services/workflow_engine.py`, `routing_service.py`)
- Automatically matches active workflows where `trigger_type == observation_type`.
- Executes Directed Acyclic Graph (DAG) pipeline:
  - Evaluates context conditions (`equals`, `greater_than`, `contains`, `exists`).
  - Executes AI reasoning (`ai_inference`) with business knowledge docs and tone.
  - Routes operational alerts through the **6-Tier Department Hierarchy** to WhatsApp and Email with anti-spam cooldown deduplication (default 30 mins).
  - Triggers downstream physical actions (e.g. blocking defective rooms as `OUT_OF_SERVICE`).

---

## 4. Multi-Tenant Security & Zero-Trust Isolation

1. **Cryptographic Tenant Isolation**:
   - Every database query in `EntityV2`, `ObservationV2`, and `Workflow` is filtered strictly by `org_id` / `business_id`.
   - Incoming webhooks authenticate using tenant-specific endpoint URLs or HMAC verification secrets.
2. **At-Rest Secret Encryption**:
   - Third-party API keys, OAuth access tokens, and SMTP passwords are encrypted using Fernet symmetric encryption (`backend/utils/encryption.py`) with standard 32-byte keys derived via SHA-256.
   - Raw secrets are never returned in plaintext to the frontend UI.
3. **Idempotency & Replay Protection**:
   - All financial and operational webhooks log incoming event IDs in `SalesWebhookLog` or `WebhookLog`.
   - Repeated webhook deliveries are detected and acknowledged with `200 OK` without re-executing business side-effects.

---

## 5. Bidirectional Integration Permissions Matrix

```
┌───────────────────────────┬───────────────┬───────────────────────────────┬──────────────────────────┐
│ Operation Category        │ Direction     │ Execution Mode                │ Security Requirement     │
├───────────────────────────┼───────────────┼───────────────────────────────┼──────────────────────────┤
│ Read Reservations / Sales │ Inbound       │ Automatic                     │ Webhook HMAC / API Key   │
│ Read Inventory Counts     │ Inbound       │ Scheduled / Webhook           │ API Key / OAuth Token    │
│ Update Room Status        │ Outbound/Local│ Autonomous on Critical Alert  │ `hotel.rooms.manage`     │
│ Send WhatsApp / Email     │ Outbound      │ Autonomous Workflow Step      │ `conversation.reply`     │
│ Issue POS Refund          │ Outbound      │ Requires Human Manager Auth   │ Manager OTP Approval     │
│ Modify External Inventory │ Outbound      │ Batch Scheduled Sync          │ `retail.inventory.write` │
│ Patient EMR Prescriptions │ Outbound/Local│ Doctor Signature Mandatory    │ `hospital.emr.write`     │
└───────────────────────────┴───────────────┴───────────────────────────────┴──────────────────────────┘
```
