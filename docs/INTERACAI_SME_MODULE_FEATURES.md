# InteracAI SME & Business Operations Feature Specification
**Module:** `module_sme`  
**Interface:** Command Workspace & Subsystems  

---

## 1. Subsystem Overview

The General SME & Entrepreneurship Module provides a comprehensive suite of 8 core functional subsystems tailored to fast-moving small and medium enterprises:

```
+------------------------------------------------------------------------------------+
|                               SME WORKSPACE SUBSYSTEMS                            |
|                                                                                    |
|  [1. Executive Command]  --> Realized Revenue, Receivables, Profit, Attention Feed |
|  [2. Omnichannel CRM]    --> Customer Dossier, Lead Pipeline, Lifetime Value (CLV) |
|  [3. Orders & Commerce]  --> Multi-Item Checkout, Auto-Stock Deductions, Payments   |
|  [4. Inventory & POs]    --> SKU Directory, Movement Ledger, Goods Receipt         |
|  [5. Service Schedule]   --> Service Menu, Booking Calendar, No-Show Detection     |
|  [6. Operational Finance]--> Invoicing, Receivables Aging (0-30+ d), Expenses      |
|  [7. Projects & Tasks]   --> Client Deliverables, Progress %, Task Allocation      |
|  [8. ARGUS Intelligence] --> 16 Grounded Copilot Skills, Signal Radar              |
+------------------------------------------------------------------------------------+
```

---

## 2. Feature Deep-Dive

### Feature 1: Executive Command Overview & Attention Engine
- **Aggregated Financial Metrics:**
  - Realized Revenue: Sum of all completed, paid sales orders and settled invoices.
  - Outstanding Receivables: Sum of unpaid or pending client invoices.
  - Operational Expenses: Cumulative expenditure logged across categories.
  - Cash-Flow Net Profit: Calculated in real-time as $\text{Realized Revenue} - \text{Total Expenses}$.
- **Owner Attention Engine:**
  - Dynamically synthesizes high-risk signals across all departments into a single actionable triage list.
  - Identifies invoices overdue $>15$ days, SKUs falling below reorder thresholds, unconfirmed appointments within 24 hours, and high-value qualified leads without recent touchpoints.
  - Generates 1-click action triggers directly from the attention queue.

### Feature 2: Customer Dossier & CRM Pipeline
- **Customer Dossier (`sme_customer`):**
  - Unified profiles tracking customer name, email, phone, VIP tier, total lifetime spend, and last interaction timestamp.
  - Auto-updates lifetime spend whenever paid orders are recorded.
- **Lead Pipeline (`sme_lead`):**
  - Stage tracking: `NEW` $\rightarrow$ `QUALIFIED` $\rightarrow$ `PROPOSAL_SENT` $\rightarrow$ `NEGOTIATION` $\rightarrow$ `WON` $\rightarrow$ `LOST`.
  - Estimated deal value in local currency (NGN, USD, EUR, etc.).
  - Next follow-up scheduling with overdue reminder alarms.

### Feature 3: Orders & Automatic Stock Deductions
- **Order Processing (`sme_order`):**
  - Multi-line item cart with product reference, quantity, and unit price.
  - Payment status tracking: `PENDING`, `PARTIAL`, `PAID`, `REFUNDED`.
  - Payment connectors: Authenticated Paystack checkout link generator.
- **Stock Auto-Deduction Engine:**
  - When an order is placed or marked `PAID`, the system automatically locates referenced `sme_product` records and deducts purchased quantities from `current_stock`.
  - Generates immutable records in `sme_inventory_movement` tagged with `movement_type = 'SALE_DEDUCTION'`.
  - If post-sale stock reaches or drops below `reorder_threshold`, the system automatically emits a canonical `sme_stock_low` signal.
  - If stock reaches $\le 0$, emits `sme_stockout_imminent`.

### Feature 4: Products, Procurement & Goods Receipt
- **Product Catalog (`sme_product`):**
  - SKU code, product title, selling price, unit cost price, stock on hand, and reorder threshold.
  - Live stock status badges: `HEALTHY`, `LOW STOCK`, `OUT OF STOCK`.
- **Supplier Directory (`sme_supplier`):**
  - Primary contact details, email, telephone, and contractual delivery lead times (days).
- **Purchase Orders & Goods Receipt (`sme_purchase_order`):**
  - Multi-item PO generation with status lifecycle: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `RECEIVED` $\rightarrow$ `CANCELLED`.
  - **Goods Receipt Flow:** One-click receipt increments `sme_product.current_stock` by the received item quantity, generates an audit entry in `sme_inventory_movement` (`movement_type = 'PURCHASE_RECEIPT'`), and emits `sme_purchase_order_received`.

### Feature 5: Service Catalogue & Scheduling Lifecycle
- **Service Menu (`sme_service`):**
  - Service title, categorization (e.g. Spa, Consultation, Maintenance, Tailoring), duration in minutes, and standard price.
- **Appointment Calendar (`sme_appointment`):**
  - Booking records linking client, service, start timestamp, staff assignee, and price.
  - Status lifecycle: `PENDING` $\rightarrow$ `CONFIRMED` $\rightarrow$ `COMPLETED` $\rightarrow$ `CANCELLED` $\rightarrow$ `NO_SHOW`.
  - **No-Show Detection:** When an appointment is marked `NO_SHOW`, an observation `sme_appointment_no_show` is emitted with severity `WARNING`, adjusting the customer's risk profile in the ARGUS graph.

### Feature 6: Operational Finance & Debt Aging
- **Invoicing (`sme_invoice`):**
  - Invoices linked to customers, order references, due dates, and amounts.
  - Automated aging categorization:
    - Current (within terms)
    - 1 to 15 days overdue
    - 16 to 30 days overdue
    - 30+ days overdue (Critical Bad Debt Alert)
- **Expense Ledger (`sme_expense`):**
  - Structured categorization: `RENT`, `UTILITIES`, `PAYROLL`, `SUPPLIES`, `MARKETING`, `LOGISTICS`.
  - Vendor attribution and audit logging.

### Feature 7: Project Deliverables & Operational Tasks
- **Projects (`sme_project`):**
  - Client project management with contract budget, completion percentage tracker, and deliverable status (`ACTIVE`, `COMPLETED`, `ON_HOLD`).
- **Operational Tasks (`sme_project_task`):**
  - Specific deliverables with priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), assigned staff member, and hard due dates.
  - Overdue task radar emits `sme_task_overdue` signals when due dates pass uncompleted.

### Feature 8: 16 ARGUS Grounded Intelligence Skills
- Real database querying for all 16 skills (zero mock responses).
- Live evaluation of customer churn risk, revenue trends, inventory velocity, no-show patterns, and bottleneck analysis.
