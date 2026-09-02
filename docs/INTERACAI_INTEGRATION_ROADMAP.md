# INTERACAI — INTEGRATION ROADMAP
**3-Phase Strategic Engineering & Product Milestone Roadmap (Pilot, Commercial Scale, Enterprise Ecosystem)**

---

## 1. Roadmap Overview & Phased Vision

The InteracAI Integration Engine is designed to evolve from an immediate, rock-solid **Pilot Engine** (supporting core PMS, POS, Payment, and WhatsApp webhooks) to a **Commercial Integration Hub**, and ultimately to an open **Enterprise Integration Ecosystem**.

```
  ┌───────────────────────────────┬───────────────────────────────┬───────────────────────────────┐
  │ PHASE 1: PILOT-READY          │ PHASE 2: COMMERCIAL SCALE     │ PHASE 3: ENTERPRISE ECOSYSTEM │
  │ (Weeks 1 – 2)                 │ (Days 30 – 60)                │ (Days 60 – 120)               │
  ├───────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
  │ • Universal Inbound Webhook   │ • OAuth 2.0 Handshake Engine  │ • Bi-Directional Reverse ETL  │
  │ • Universal CSV Auto-Importer │ • Settings -> Integrations UI │ • Visual Drag-and-Drop Mapper │
  │ • Hotel/Retail/Sales Webhooks │ • Flutterwave & QuickBooks    │ • RTSP Vision Edge Streaming  │
  │ • Live Demo Playbook Scripts  │ • Celery Polling Scheduler    │ • Community Plugin Store      │
  │ • Strict Anti-Faking Auditing │ • Automated Webhook Retries   │ • Enterprise SSO & Webhook SDK│
  └───────────────────────────────┴───────────────────────────────┴───────────────────────────────┘
```

---

## 2. Phase-by-Phase Milestone Breakdown

### PHASE 1: PILOT-READY & IMMEDIATE CLIENT VALIDATION (Weeks 1 – 2)

**Goal**: Deliver seamless, zero-friction integration for initial pilot customers in Hotel, Retail, Education, and Healthcare with 100% genuine data pipelines.

- **Milestone 1.1: Generic Inbound Webhook Gateway (`/api/v1/integrations/inbound/{id}`)**:
  - Implements dynamic JSON ingestion for arbitrary third-party software.
  - Automatically captures HTTP headers, payload, and emits `connector_signal_received` observations.
  - *Location*: `backend/routes/integration_routes.py`.
- **Milestone 1.2: Universal Tabular (CSV / Excel) Importer**:
  - Drag-and-drop CSV importer with automated header matching (`Name`, `Phone`, `Email`, `Amount`, `Room`).
  - Batch upsert into `EntityV2` without SQL schema alterations.
  - *Location*: `backend/routes/import_routes.py`.
- **Milestone 1.3: End-to-End Pilot Verification & Zero-Faking Audit**:
  - Verify that all demo endpoints (`/hotel/integrations/webhook`, `/retail/integrations/shopify`, `/sales/webhook/paystack`) trigger real database updates, real observation records, and real WhatsApp/Email workflow dispatches.

---

### PHASE 2: COMMERCIAL SCALE & ENTERPRISE SELF-SERVE (Days 30 – 60)

**Goal**: Enable self-serve onboarding, standard OAuth 2.0 authorization, and automated background polling for legacy APIs.

- **Milestone 2.1: Centralized "Settings -> Integrations" Dashboard UI**:
  - Consolidated view showing all active, pending, and available connectors.
  - Live status indicators (Active, Inactive, Error), last sync timestamp, and daily event counters.
  - *Location*: `frontend/src/pages/Settings/IntegrationsTab.js`.
- **Milestone 2.2: OAuth 2.0 Handshake & Automated Token Refresh**:
  - Complete authorization code grant flow for cloud SaaS (QuickBooks Online, Xero, Google).
  - Background worker to automatically refresh expiring OAuth tokens using AES-encrypted refresh keys.
  - *Location*: `backend/routes/oauth_routes.py` & `services/oauth_service.py`.
- **Milestone 2.3: Additional High-Demand African & Global Connectors**:
  - Flutterwave Payments & Subscriptions Connector (`/api/v1/integrations/flutterwave`).
  - QuickBooks Online Invoicing & Expense Sync (`/api/v1/integrations/quickbooks`).
  - OpenMRS Healthcare Patient & Encounter Ingestion (`/api/v1/integrations/openmrs`).
- **Milestone 2.4: Celery Beat Visual Polling Scheduler**:
  - Configurable polling intervals (e.g. 5m, 15m, 1h, 24h) for legacy REST endpoints.
  - Delta synchronization tracking via `last_synced_timestamp`.

---

### PHASE 3: ENTERPRISE ECOSYSTEM & PLATFORM EXPANSION (Days 60 – 120)

**Goal**: Transform InteracAI into an open integration platform with bidirectional writeback and community extensibility.

- **Milestone 3.1: Visual Drag-and-Drop Field Mapper**:
  - Interactive UI for enterprise users to visually map vendor JSON fields to InteracAI entity attributes.
  - *Location*: `frontend/src/components/IntegrationFieldMapper.js`.
- **Milestone 3.2: Bi-Directional Reverse ETL Orchestrator**:
  - Synchronize internal InteracAI updates back into external ERP, POS, and accounting ledgers with human-in-the-loop approval workflows.
- **Milestone 3.3: Native RTSP CCTV Edge Vision Streaming**:
  - Direct camera stream ingestion from Hikvision/Dahua NVRs to local ARGUS Vision subagents.
- **Milestone 3.4: InteracAI Community Connector SDK & Plugin Store**:
  - Public developer documentation, TypeScript/Python SDK, and verified community connector marketplace.

---

## 3. Success Metrics & Key Performance Indicators (KPIs)

| Metric | Target (Phase 1) | Target (Phase 2) | Target (Phase 3) |
|---|:---:|:---:|:---:|
| **Time-to-Connect (New Customer)** | < 10 Minutes | < 3 Minutes | < 60 Seconds (1-Click) |
| **Inbound Webhook Latency (Ingest to Obs)** | < 80 ms | < 50 ms | < 25 ms |
| **Webhook Delivery Reliability** | 99.9% | 99.99% | 99.999% |
| **Active Built-In Connectors** | 5 Core Connectors | 12 Connectors | 30+ Connectors & Plugins |
| **Customer Software Replacement Required** | **0% (Zero)** | **0% (Zero)** | **0% (Zero)** |
