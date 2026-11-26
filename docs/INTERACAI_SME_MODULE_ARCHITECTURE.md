# InteracAI General SME & Entrepreneurship Module Architecture
**Module Identifier:** `module_sme`  
**Display Name:** `SME & Business Operations`  
**Architectural Tier:** First-Class Industry Operating Layer  
**Engine Compatibility:** ARGUS OS Enterprise Intelligence Grid  

---

## 1. Executive Architecture Summary

The **General SME & Entrepreneurship Module** (`module_sme`) provides a unified, capability-aware operating system for non-verticalized enterprises. Rather than fragmenting the platform into numerous fragile micro-modules (e.g. fashion, beauty, consulting, printing), InteracAI implements a singular, parameter-driven foundation governed by three business models:
1. **PRODUCT:** Physical goods, inventory SKU ledgers, purchase orders, reorder thresholds, and omnichannel delivery.
2. **SERVICE:** Billable time, appointment scheduling, service menus, capacity allocation, and no-show anomaly detection.
3. **HYBRID:** Simultaneous operations of billable appointments and physical inventory sales (e.g., hair salon selling haircare products, spa offering massage and retail oils, bespoke tailor selling fabric and fittings).

### The InteracAI Closed-Loop Operating Principle
The module strictly preserves InteracAI's core competitive differentiator:
$$\text{Business Signals} \longrightarrow \text{Normalized Observations} \longrightarrow \text{ARGUS Relationship Graph} \longrightarrow \text{Autonomous Workflows} \longrightarrow \text{Action \& Owner Visibility}$$

```
+-----------------------------------------------------------------------------------+
|                            INTERACAI OPERATING LOOP                               |
|                                                                                   |
|  [Operational Events]                                                             |
|   Order Placed | Appointment Booked | Invoice Overdue | Stock Depleted | PO Received |
|                             |                                                     |
|                             v                                                     |
|  [Canonical Signal Emitter] (sme_routes.py / sme_service.py)                      |
|   Standardized JSON schema, severity, source channel, primary entity reference    |
|                             |                                                     |
|                             v                                                     |
|  [Observation Ingestion Engine] (ObservationService / ObservationV2)              |
|   Tenant isolation, risk-score calculation, audit logging                         |
|                             |                                                     |
|                             v                                                     |
|  [ARGUS OS Knowledge Graph] (Dynamic Graph Topology Compiler)                     |
|   Source -> Target Edge linking (PLACED_ORDER, CONTAINS_PRODUCT, BOOKED_APT)      |
|                             |                                                     |
|                             v                                                     |
|  [ARGUS Intelligence Grid] (16 Grounded Copilot Skills)                           |
|   Multi-table SQL aggregation, zero mock data, real tenant database synthesis     |
|                             |                                                     |
|                             v                                                     |
|  [Action & Execution Layer] (Workflow Engine DAGs / Owner Attention Engine)       |
|   Autonomous notification, restock alerts, win-back flows, executive triage       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Multi-Tenant Zero-Trust Isolation Architecture

InteracAI enforces rigorous zero-trust data segregation across every layer of the SME module:

1. **Resolution of Tenant Identity (`resolve_business_id`):**
   - The tenant ID is dynamically extracted from `current_user.business_id`.
   - In cross-system API requests, query parameters (`?org_id=...`) are verified against user authentication tokens to prevent authorization bypass.
2. **Dynamic Entity Namespacing (`entities_v2`):**
   - All SME records (`sme_customer`, `sme_order`, `sme_product`, etc.) are stored in `entities_v2` partitioned strictly by `org_id`.
   - Entity schemas are registered under `entity_types` with `module_id = 'module_sme'` and scoped to `org_id`.
3. **Observation Namespacing (`observations_v2`):**
   - Observations emitted by sales, inventory, finance, or appointments are tagged with `org_id`.
   - Subsystem queries filtering by `observation_type` must explicitly bind `ObservationV2.org_id == tenant_id`.
4. **ARGUS Skills Grounding:**
   - Every skill query strictly targets the calling tenant's records. Cross-tenant leakage is prevented at both the SQL and application layers.

---

## 3. Capability-Aware Module Topology

Instead of a monolithic codebase, `module_sme` configures its operational surface dynamically based on activated capabilities:

```json
{
  "business_model": "HYBRID",
  "capabilities": {
    "APPOINTMENTS": true,
    "INVENTORY": true,
    "PROJECTS": true,
    "QUOTES": true,
    "PROCUREMENT": true,
    "EXPENSES": true,
    "MULTI_LOCATION": false,
    "LOYALTY": true
  },
  "default_currency": "NGN",
  "tax_rate_percent": 7.5,
  "default_payment_terms_days": 14
}
```

### Module Registration Manifest (`SMEModule`)
Registered in `ModuleRegistryService` via `backend/modules/sme.py`:
- **ID:** `module_sme`
- **Name:** `SME & Business Operations`
- **Category:** `commerce_and_operations`
- **Permissions:**
  - `sme.dashboard.read`, `sme.customers.read`, `sme.customers.write`
  - `sme.orders.read`, `sme.orders.write`
  - `sme.products.read`, `sme.products.write`
  - `sme.appointments.read`, `sme.appointments.write`
  - `sme.invoices.read`, `sme.invoices.write`
  - `sme.projects.read`, `sme.projects.write`
  - `sme.config.write`
- **Registered Skills:** 16 database-backed ARGUS intelligence copilot tools.
- **UI Routes:** Dynamic paths mounted at `/dashboard/sme/*`.

---

## 4. Subsystem Dependency Architecture

| Layer | Responsibility | Components |
|---|---|---|
| **API Transport** | Fast REST routing, payload validation, RBAC checks | [sme_routes.py](file:///c:/Users/HomePC/Desktop/interac-ai/backend/routes/sme_routes.py) |
| **Domain Logic** | Stock calculations, PO receipt, attention feed, 16 skills | [sme_service.py](file:///c:/Users/HomePC/Desktop/interac-ai/backend/services/sme_service.py) |
| **Signal Engine** | Observation ingestion, severity, risk scoring | [observation_service.py](file:///c:/Users/HomePC/Desktop/interac-ai/backend/services/observation_service.py) |
| **Knowledge Graph** | Relationship compilation for ARGUS OS graph queries | [copilot_fallback_routes.py](file:///c:/Users/HomePC/Desktop/interac-ai/backend/routes/copilot_fallback_routes.py) |
| **Persistence** | Multi-tenant dynamic entities and observation ledgers | `entities_v2`, `entity_types`, `observations_v2` |
| **Workflows** | Autonomous DAG execution upon canonical signal emissions | `workflow_engine.py` |
| **Frontend UI** | Responsive command dashboard, attention queue, 9 tabs | [SMEWorkspace.js](file:///c:/Users/HomePC/Desktop/interac-ai/frontend/src/pages/SME/SMEWorkspace.js) |

---

## 5. Security & Authentication Guardrails

1. **Role-Based Access Control (RBAC):**
   - Department-level mapping in `auth_service.py`:
     - `sales`: `sme.orders.*`, `sme.customers.*`, `sme.quotes.*`
     - `operations`: `sme.projects.*`, `sme.appointments.*`
     - `inventory`: `sme.products.*`, `sme.procurement.*`
     - `finance`: `sme.invoices.*`, `sme.expenses.*`
     - `customer_service`: `sme.appointments.*`, `sme.customers.read`
2. **Real Payment Connector Policy:**
   - Paystack integration is backed by authentic API credentials.
   - Unconfigured gateways (e.g. Flutterwave) return explicit status codes indicating "Not Connected / Coming Soon", ensuring zero fake transactions.
