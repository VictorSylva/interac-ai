# InteracAI SME Canonical Signal Dictionary & ARGUS Observation Map
**Module:** `module_sme`  
**Ingestion Pipeline:** `ObservationService.record_observation()` $\longrightarrow$ `observations_v2` $\longrightarrow$ `emit_observation()`  

---

## 1. Overview of Canonical Signal Architecture

Signals represent business events translated into immutable, standardized observations. Every SME signal includes:
- **`org_id`**: Strict tenant scoping.
- **`source_channel`**: Subsystem emitter (e.g. `sme_orders`, `sme_scheduling`, `sme_inventory`, `sme_finance`).
- **`observation_type`**: Canonical signal identifier.
- **`primary_entity_id`**: Foreign key to the subject dynamic entity.
- **`severity`**: `INFO`, `WARNING`, `CRITICAL`.
- **`confidence`**: Float value (typically 1.0 for system transactions).
- **`risk_score_impact`**: Numeric delta applied to related entity risk score in ARGUS OS.

---

## 2. Canonical Signal Dictionary

### Category A: Sales, Leads & Order Signals

| Signal Code | Severity | Source Channel | Risk Impact | Description & Trigger Conditions |
|---|---|---|---|---|
| `sme_lead_created` | `INFO` | `sme_crm` | 0.0 | Emitted when a new lead is captured via web form, WhatsApp, or manual CRM entry. |
| `sme_lead_qualified` | `INFO` | `sme_crm` | 0.0 | Emitted when a lead advances to `QUALIFIED` stage. |
| `sme_lead_stalled` | `WARNING` | `sme_crm` | 2.5 | Emitted when a lead has no logged interactions for $>14$ days. |
| `sme_quote_sent` | `INFO` | `sme_sales` | 0.0 | Emitted when a formal sales estimate/quote is issued to a customer. |
| `sme_quote_accepted` | `INFO` | `sme_sales` | -5.0 | Emitted when a customer accepts a quote (lowers commercial churn risk). |
| `sme_order_placed` | `INFO` | `sme_orders` | 0.0 | Emitted on order submission with item breakdown and payment status. |
| `sme_order_paid` | `INFO` | `sme_orders` | -10.0 | Emitted when full payment is confirmed via Paystack or direct receipt. |
| `sme_order_cancelled` | `WARNING` | `sme_orders` | 5.0 | Emitted when a customer or administrator cancels an active order. |
| `sme_order_fulfilled` | `INFO` | `sme_orders` | 0.0 | Emitted when items are marked packed, shipped, or delivered. |
| `sme_delivery_dispatched`| `INFO` | `sme_delivery` | 0.0 | Emitted when a courier is assigned and package is in transit. |
| `sme_delivery_delayed` | `WARNING` | `sme_delivery` | 10.0 | Emitted when expected delivery window expires without confirmation. |

### Category B: Inventory & Supply Chain Signals

| Signal Code | Severity | Source Channel | Risk Impact | Description & Trigger Conditions |
|---|---|---|---|---|
| `sme_stock_deducted` | `INFO` | `sme_inventory` | 0.0 | Emitted whenever an order reduces SKU `current_stock`. |
| `sme_stock_low` | `WARNING` | `sme_inventory` | 15.0 | Emitted when `current_stock <= reorder_threshold`. |
| `sme_stockout_imminent`| `CRITICAL`| `sme_inventory` | 30.0 | Emitted when `current_stock <= 0` or projected to run out within 48h. |
| `sme_purchase_order_created`| `INFO` | `sme_procurement`| 0.0 | Emitted when a restock PO is submitted to a supplier. |
| `sme_purchase_order_received`| `INFO` | `sme_procurement`| -15.0 | Emitted upon goods receipt; stock is replenished and risk is cleared. |
| `sme_supplier_delivery_delayed`| `WARNING`| `sme_procurement`| 12.0 | Emitted when supplier PO delivery date is missed. |

### Category C: Appointments & Service Booking Signals

| Signal Code | Severity | Source Channel | Risk Impact | Description & Trigger Conditions |
|---|---|---|---|---|
| `sme_appointment_created`| `INFO` | `sme_scheduling`| 0.0 | Emitted on confirmed appointment booking. |
| `sme_appointment_confirmed`| `INFO` | `sme_scheduling`| -2.0 | Emitted when client confirms attendance via WhatsApp reply. |
| `sme_appointment_cancelled`| `INFO` | `sme_scheduling`| 2.0 | Emitted when client reschedules or cancels $>24$h in advance. |
| `sme_appointment_no_show`| `WARNING`| `sme_scheduling`| 25.0 | Emitted when client fails to appear for booked slot. |
| `sme_appointment_completed`| `INFO` | `sme_scheduling`| -5.0 | Emitted when service delivery is finished. |
| `sme_service_capacity_exceeded`| `WARNING`| `sme_scheduling`| 10.0 | Emitted when bookings exceed 95% of available staff hours. |

### Category D: Finance, Invoicing & Receivables Signals

| Signal Code | Severity | Source Channel | Risk Impact | Description & Trigger Conditions |
|---|---|---|---|---|
| `sme_invoice_issued` | `INFO` | `sme_finance` | 0.0 | Emitted when an invoice is issued with terms and due date. |
| `sme_invoice_overdue_15d`| `WARNING` | `sme_finance` | 20.0 | Emitted when an unpaid invoice reaches 1 to 15 days past due. |
| `sme_invoice_overdue_30d`| `CRITICAL`| `sme_finance` | 40.0 | Emitted when an unpaid invoice exceeds 30 days overdue (Bad Debt Risk). |
| `sme_payment_verified` | `INFO` | `sme_finance` | -20.0 | Emitted when an outstanding invoice is cleared. |
| `sme_expense_logged` | `INFO` | `sme_finance` | 0.0 | Emitted when a new operational expense is recorded in ledger. |
| `sme_cashflow_negative_warning`| `CRITICAL`| `sme_finance` | 35.0 | Emitted when cumulative 30-day expenses exceed realized revenue. |

### Category E: Operations & Deliverables Signals

| Signal Code | Severity | Source Channel | Risk Impact | Description & Trigger Conditions |
|---|---|---|---|---|
| `sme_task_overdue` | `WARNING` | `sme_operations` | 15.0 | Emitted when a project task deadline expires without completion. |
| `sme_project_milestone_delayed`| `CRITICAL`| `sme_operations` | 25.0 | Emitted when key client project milestone falls behind schedule. |
| `sme_sla_breach` | `CRITICAL` | `sme_operations` | 30.0 | Emitted when client SLA response or resolution window is breached. |

---

## 3. ARGUS OS Graph Relationship Edge Compilation

When an observation is recorded, `ObservationService.form_argus_relationships()` inspects entity attributes and compiles graph relationships:
- `sme_order`:
  - `(customer_id) --[PLACED_ORDER]--> (sme_order)`
  - `(sme_order) --[CONTAINS_PRODUCT]--> (product_id)`
- `sme_appointment`:
  - `(customer_id) --[BOOKED_APPOINTMENT]--> (sme_appointment)`
  - `(sme_appointment) --[FOR_SERVICE]--> (service_id)`
  - `(staff_id) --[ASSIGNED_STAFF]--> (sme_appointment)`
- `sme_purchase_order`:
  - `(supplier_id) --[FULFILLS_PO]--> (sme_purchase_order)`
- `sme_invoice`:
  - `(customer_id) --[BILLED_TO]--> (sme_invoice)`
  - `(sme_invoice) --[COVERS_ORDER]--> (order_id)`
- `sme_project_task`:
  - `(project_id) --[HAS_TASK]--> (sme_project_task)`
  - `(assignee_id) --[ASSIGNED_TO]--> (sme_project_task)`
