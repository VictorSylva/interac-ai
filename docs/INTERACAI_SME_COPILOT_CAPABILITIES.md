# InteracAI SME Copilot & ARGUS OS Capabilities (16 Grounded Skills)
**Module:** `module_sme`  
**Execution Endpoint:** `POST /api/v1/sme/skills/{skill_name}/execute`  
**Data Integrity Policy:** Zero Simulated/Mock Responses. All outputs derive from real tenant database queries. If tables are empty, skills return explicit `"insufficient_data": true`.

---

## 1. Skill Specifications & Algorithms

### 1. `daily_business_brief`
- **Category:** Executive Leadership
- **Inputs:** None (auto-scopes to caller `org_id`)
- **Query Logic:** Aggregates today's orders (`sme_order`), overdue invoices (`sme_invoice`), SKUs below reorder threshold (`sme_product`), and urgent pending tasks (`sme_project_task`).
- **Output:** Total daily revenue, receivables, critical warnings list, and prioritized daily action items.

### 2. `sales_pipeline_analyzer`
- **Category:** CRM & Commercial
- **Inputs:** None
- **Query Logic:** Groups all active `sme_lead` records by `stage` (`NEW`, `QUALIFIED`, `PROPOSAL_SENT`, `NEGOTIATION`), summing estimated deal values and applying stage conversion probability weightings.
- **Output:** Total pipeline value, weighted forecast, stage distribution, and count of stalled deals ($>14$ days without interaction).

### 3. `clv_estimator`
- **Category:** CRM
- **Inputs:** `customer_id` (optional, default evaluates top accounts)
- **Query Logic:** Analyzes historical orders, calculates average order value (AOV), purchase cadence (days between orders), and computes estimated 12-month projected Customer Lifetime Value.
- **Output:** Historical spend, AOV, order frequency, and CLV segment (`DIAMOND`, `GOLD`, `SILVER`).

### 4. `churn_risk_detector`
- **Category:** CRM
- **Inputs:** `threshold_days` (default 60)
- **Query Logic:** Scans all `sme_customer` records for `last_interaction_at` older than threshold days where previous spend $> 0$.
- **Output:** List of high-value at-risk accounts, days dormant, past revenue contribution, and suggested win-back intervention.

### 5. `top_customer_identifier`
- **Category:** CRM
- **Inputs:** `limit` (default 10)
- **Query Logic:** Sorts `sme_customer` records descending by `total_spend` and cross-references order frequency.
- **Output:** Top accounts, cumulative percentage of total business revenue represented (Pareto 80/20 analysis), and VIP tier status.

### 6. `inactive_customer_reengagement`
- **Category:** Marketing & CRM
- **Inputs:** None
- **Query Logic:** Identifies accounts with 0 transactions in the last 45-90 days, analyzes their most frequently purchased items/services, and generates contextual promotional copy.
- **Output:** Personalized win-back recommendations and tailored promo discount suggestions.

### 7. `revenue_trend_analyzer`
- **Category:** Finance
- **Inputs:** None
- **Query Logic:** Scans `sme_order` and `sme_invoice` records across rolling 30-day windows, computing paid vs unpaid ratios and cash inflow velocity.
- **Output:** Realized revenue, pending invoices, collection efficiency percentage, and week-over-week growth trend.

### 8. `outstanding_payment_analyzer`
- **Category:** Finance
- **Inputs:** None
- **Query Logic:** Audits all `sme_invoice` records where `status != 'PAID'`, computing aging days based on `due_date`:
  - 0 to 15 days overdue
  - 16 to 30 days overdue
  - 30+ days overdue (Critical Bad Debt)
- **Output:** Total unpaid balance, breakdown by aging bucket, and list of debtors requiring formal legal escalation.

### 9. `expense_anomaly_detector`
- **Category:** Finance
- **Inputs:** None
- **Query Logic:** Calculates mean and standard deviation of historical `sme_expense` entries by category. Flags any single transaction exceeding $2.5 \times$ the category average.
- **Output:** List of anomalous expenses, vendor names, deviation multiples, and category spend spikes.

### 10. `fast_slow_moving_inventory`
- **Category:** Inventory
- **Inputs:** None
- **Query Logic:** Cross-references `sme_product` stock against `sme_inventory_movement` deduction frequencies over the past 30 days.
- **Output:** Top fast-moving velocity items (reorder candidates) vs slow-moving dead capital SKUs.

### 11. `appointment_no_show_analyzer`
- **Category:** Scheduling
- **Inputs:** None
- **Query Logic:** Calculates total bookings vs records with `status == 'NO_SHOW'`. Correlates no-show patterns by service category, time of day, and client history.
- **Output:** Overall no-show rate %, estimated lost gross revenue, and repeat offender client list.

### 12. `service_utilization_rate`
- **Category:** Scheduling
- **Inputs:** None
- **Query Logic:** Multiplies total booked appointment hours against standard operational capacity (assuming 8 hours/day per provider).
- **Output:** Utilization percentage, peak booking hours, and idle capacity time slots.

### 13. `operational_bottleneck_detector`
- **Category:** Operations
- **Inputs:** None
- **Query Logic:** Scans `sme_project_task` for overdue deadlines, unfulfilled orders $>3$ days old, and stalled client project milestones.
- **Output:** Critical operational bottlenecks, overdue task assignees, and recommended staffing reallocations.

### 14. `supplier_lead_time_performance`
- **Category:** Procurement
- **Inputs:** None
- **Query Logic:** Analyzes `sme_supplier` configured `lead_time_days` and compares against actual purchase order creation vs goods receipt timestamps.
- **Output:** Vendor delivery reliability scores, lead-time variances, and procurement spend distribution.

### 15. `quote_to_order_conversion`
- **Category:** Sales
- **Inputs:** None
- **Query Logic:** Measures ratio of accepted vs declined `sme_quote` records and time elapsed from quote generation to order placement.
- **Output:** Conversion win rate %, average deal cycle duration, and common lost deal friction points.

### 16. `owner_attention_prioritizer`
- **Category:** Executive
- **Inputs:** None
- **Query Logic:** Calls `sme_service.get_owner_attention_feed()`, applying multi-criteria decision ranking across inventory risks, finance arrears, client escalations, and project delays.
- **Output:** Top 5 prioritized, high-leverage decisions the business owner must address today.
