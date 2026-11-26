# InteracAI SME Business Models & Capability Guide
**Module:** `module_sme`  

---

## 1. The Tri-Model Operating Principle

In contrast to legacy ERPs that force rigid assumptions, InteracAI organizes real-world SMEs into three core operational models:

```
                          +------------------------+
                          |   INTERACAI SME CORE   |
                          +-----------+------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
   [PRODUCT MODEL]                      [HYBRID MODEL]       [SERVICE MODEL]
   Physical Goods, Stock,              Dual Stock & Booking, Billable Hours, Retainers,
   Delivery, Suppliers                 Retail + Treatment    Milestones, Consultations
```

---

## 2. Model Profiles & Presets

### Model A: PRODUCT
*Enterprises focused primarily on manufacturing, retailing, distributing, or fabricating physical inventory.*

- **Enabled Capabilities:**
  - `INVENTORY = true`
  - `PROCUREMENT = true`
  - `APPOINTMENTS = false`
  - `PROJECTS = false`
  - `EXPENSES = true`
- **Typical Industry Presets:**
  - **Fashion & Custom Apparel:** Fabric procurement, bespoke SKU generation, production order tracking.
  - **Commercial Printing & Merchandise:** Raw paper/vinyl/ink stock, print run orders, supplier delivery tracking.
- **Key Operational Signals:**
  - `sme_order_placed`, `sme_stock_low`, `sme_stockout_imminent`, `sme_purchase_order_received`, `sme_delivery_dispatched`.

### Model B: SERVICE
*Enterprises whose primary revenue driver is billable expert time, consultations, sessions, or project deliverables.*

- **Enabled Capabilities:**
  - `APPOINTMENTS = true`
  - `PROJECTS = true`
  - `INVENTORY = false`
  - `PROCUREMENT = false`
  - `EXPENSES = true`
- **Typical Industry Presets:**
  - **Consulting & Professional Services:** Retainer invoicing, client deliverable milestones, task assignments, SLA tracking.
  - **Commercial Cleaning & Facility Care:** Cleaning dispatch appointments, recurring site visits, staff shift allocation.
- **Key Operational Signals:**
  - `sme_appointment_created`, `sme_appointment_no_show`, `sme_project_milestone_due`, `sme_task_overdue`, `sme_sla_breach`.

### Model C: HYBRID
*Enterprises combining scheduled services with physical inventory retail or consumable stock replenishment.*

- **Enabled Capabilities:**
  - `APPOINTMENTS = true`
  - `INVENTORY = true`
  - `PROJECTS = true`
  - `PROCUREMENT = true`
  - `QUOTES = true`
  - `EXPENSES = true`
- **Typical Industry Presets:**
  - **Beauty & Wellness (Spas, Salons, Aesthetic Clinics):** Scheduled massage or facial treatments + retail sales of serums, glow oils, and shampoo.
  - **Tailors & Design Studios:** Measurement/fitting consultations + retail purchase of custom fabrics and ready-to-wear pieces.
- **Key Operational Signals:**
  - All signals across both Product and Service models are active.

---

## 3. Capability Matrix Reference

| Capability Flag | Description | Active Subsystems |
|---|---|---|
| `APPOINTMENTS` | Enables service catalog, calendar scheduling, staff allocation, and no-show alerts | Scheduling Tab, Services API |
| `INVENTORY` | Enables SKU directory, stock auto-deduction on orders, movement ledgers, and low-stock alarms | Products Tab, Stock Ledger API |
| `PROJECTS` | Enables project milestones, budget tracking, completion %, and operational task assignments | Projects Tab, Tasks API |
| `QUOTES` | Enables quote generation, client approval links, and automated quote-to-order conversions | Quotes API, Sales Radar |
| `PROCUREMENT` | Enables supplier database, purchase order generation, and stock goods receipts | PO Management API |
| `EXPENSES` | Enables categorized operational cost logging and net cash-flow calculations | Expense Ledger API |
| `MULTI_LOCATION` | Enables warehouse and branch location tagging across stock and appointments | Advanced Routing |
| `LOYALTY` | Enables customer reward points tracking and VIP retention workflows | Customer Dossier API |

---

## 4. Switching Models & Presets

Tenants can adjust their model at any time from the **Model Settings** tab in the workspace or via API:
- `POST /api/v1/sme/config`: Updates model and capability booleans.
- `POST /api/v1/sme/config/preset/{preset_id}`: Resets capabilities to an industry-curated baseline.
- **Safety Guarantee:** Switching models never deletes existing historical records (e.g. an agency switching from Hybrid to Service retains historical product and stock records in the database).
