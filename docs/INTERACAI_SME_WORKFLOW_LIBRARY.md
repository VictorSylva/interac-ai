# InteracAI SME Starter Workflow Library (15 Pre-Built DAGs)
**Module:** `module_sme`  
**Execution Engine:** InteracAI Autonomous Workflow Engine (`WorkflowEngine`)  
**Deployment API:** `POST /api/v1/sme/workflows/deploy`  

---

## 1. Overview of Workflow Architecture

The SME module provides 15 production-ready, fully parameterized workflow templates. Each workflow is structured as a Directed Acyclic Graph (DAG) stored in `workflows` and executable either event-driven (via canonical signal triggers) or on scheduled cron intervals.

```
                    +-----------------------------+
                    |    TRIGGER: EVENT/CRON      |
                    +--------------+--------------+
                                   |
                                   v
                    +-----------------------------+
                    |       CONDITION NODE        |
                    +--------------+--------------+
                                   | (Evaluates True)
                                   v
                    +-----------------------------+
                    |       ACTION NODE(S)        |
                    | Send Notification / Email / |
                    | WhatsApp / Record Signal    |
                    +-----------------------------+
```

---

## 2. Catalog of 15 Pre-Built Workflows

### 1. `sme_wf_low_stock_reorder` (Low-Stock Alert & Supplier Restock)
- **Trigger:** Event `sme_stock_low` or `sme_stockout_imminent`
- **Condition:** Product `current_stock <= reorder_threshold`
- **Action Sequence:**
  1. Record observation `sme_stockout_imminent` (if $\le 0$).
  2. Send high-priority notification to Inventory Manager.
  3. Pre-populate draft purchase order to primary assigned supplier.

### 2. `sme_wf_appointment_no_show_recovery` (No-Show Win-Back Recovery)
- **Trigger:** Event `sme_appointment_no_show`
- **Condition:** Status equals `NO_SHOW`
- **Action Sequence:**
  1. Dispatch gentle WhatsApp message: *"We missed you today for your session. Would you like to reschedule for later this week?"*
  2. Increment customer risk score in ARGUS OS by 15.0 points.

### 3. `sme_wf_overdue_invoice_escalation` (Overdue Debt Escalation)
- **Trigger:** Scheduled daily cron check at 08:00
- **Condition:** Invoice status `PENDING` and `due_date < current_date - 15 days`
- **Action Sequence:**
  1. Record observation `sme_invoice_overdue_15d` with severity `WARNING`.
  2. Send polite payment reminder email with Paystack payment link.
  3. If $>30$ days overdue, record `sme_invoice_overdue_30d` (`CRITICAL`) and alert Business Owner.

### 4. `sme_wf_new_order_fulfillment` (Order Fulfillment & Delivery Routing)
- **Trigger:** Event `sme_order_placed`
- **Condition:** `payment_status == 'PAID'`
- **Action Sequence:**
  1. Deduct SKU inventory.
  2. Dispatch packing slip to fulfillment desk.
  3. Send order confirmation with tracking link to customer.

### 5. `sme_wf_lead_followup_reminder` (Stalled Lead Nudge)
- **Trigger:** Scheduled daily cron check
- **Condition:** Lead stage `QUALIFIED` with `last_interaction > 5 days`
- **Action Sequence:**
  1. Alert assigned sales representative.
  2. Create high-priority task in `sme_project_task`.

### 6. `sme_wf_appointment_24h_reminder` (24-Hour Booking Confirmation)
- **Trigger:** Scheduled hourly cron check
- **Condition:** `start_time` between 23 and 25 hours from now
- **Action Sequence:**
  1. Send automated WhatsApp reminder with confirmation button ("Reply 1 to Confirm").

### 7. `sme_wf_po_goods_receipt_reconcile` (PO Goods Receipt & Stock Ledger)
- **Trigger:** Event `sme_purchase_order_received`
- **Condition:** PO items verified
- **Action Sequence:**
  1. Automatically increment product `current_stock`.
  2. Log entries in `sme_inventory_movement`.
  3. Clear active `sme_stock_low` alerts for replenished items.

### 8. `sme_wf_vip_customer_recognition` (VIP Auto-Upgrades)
- **Trigger:** Event `sme_order_paid`
- **Condition:** `customer.total_spend >= 250,000 NGN`
- **Action Sequence:**
  1. Upgrade customer status to `VIP`.
  2. Send personalized executive thank-you message with exclusive discount code.

### 9. `sme_wf_project_milestone_deadline` (Project Milestone Alert)
- **Trigger:** Scheduled daily cron check
- **Condition:** Milestone target date within 48 hours and `is_reached == false`
- **Action Sequence:**
  1. Check task completion percentage.
  2. If $<70\%$, emit `sme_project_milestone_delayed` and notify project lead.

### 10. `sme_wf_inactive_customer_reengagement` (60-Day Dormant Win-Back)
- **Trigger:** Scheduled weekly cron check
- **Condition:** `customer.last_interaction > 60 days`
- **Action Sequence:**
  1. Dispatch win-back campaign with special returning customer offer.

### 11. `sme_wf_quote_expiration_warning` (Quote Follow-up)
- **Trigger:** Scheduled daily cron check
- **Condition:** Quote expiration within 3 days and status `SENT`
- **Action Sequence:**
  1. Send proposal follow-up email to decision-maker.

### 12. `sme_wf_urgent_task_escalation` (Task Overdue Escalation)
- **Trigger:** Scheduled daily cron check
- **Condition:** `task.status != 'DONE'` and `due_date < current_date`
- **Action Sequence:**
  1. Emit `sme_task_overdue`.
  2. Escalate task priority to `URGENT`.
  3. Alert operations manager.

### 13. `sme_wf_daily_executive_brief` (Morning Owner Briefing)
- **Trigger:** Scheduled cron at 07:30 daily
- **Action Sequence:**
  1. Execute `skill_daily_business_brief`.
  2. Deliver bulleted morning briefing to Owner's WhatsApp / Dashboard Attention feed.

### 14. `sme_wf_cashflow_burn_alert` (Negative Cash-Flow Warning)
- **Trigger:** Event `sme_expense_logged`
- **Condition:** Cumulative 30-day expenses $> 1.15 \times$ realized revenue
- **Action Sequence:**
  1. Emit `sme_cashflow_negative_warning`.
  2. Flag critical alert in Owner Attention Engine.

### 15. `sme_wf_supplier_lead_time_review` (Supplier Turnaround Audit)
- **Trigger:** Scheduled monthly cron
- **Action Sequence:**
  1. Execute `skill_supplier_lead_time_performance`.
  2. Generate supplier SLA report highlighting slow vendor turnaround.

---

## 3. Workflow Engine Deployment

Tenants can instantiate all 15 workflows into their active engine by clicking **"Deploy 15 Workflows"** in the workspace, or calling:
```bash
POST /api/v1/sme/workflows/deploy?org_id={tenant_id}
```
Workflows are idempotently created with multi-tenant isolation, ensuring zero duplicates.
