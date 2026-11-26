# InteracAI SME Dynamic Entity Schema & Relationship Map
**Module:** `module_sme`  
**Storage Engine:** InteracAI Dynamic Entity System (`entities_v2` / `entity_types`)  

---

## 1. Dynamic Entity Overview

All SME data objects are modeled as first-class dynamic entities inside `entities_v2`, indexed by `org_id` and typed by `entity_types.code`. The module defines 16 core entity types:

```
                                 +--------------------+
                                 |    sme_customer    |
                                 +----+----------+----+
                                      |          |
                      +---------------+          +---------------+
                      | PLACED_ORDER                             | BOOKED_APPOINTMENT
                      v                                          v
             +----------------+                         +------------------+
             |   sme_order    |                         | sme_appointment  |
             +--------+-------+                         +--------+---------+
                      |                                          |
                      | CONTAINS_PRODUCT                         | FOR_SERVICE
                      v                                          v
             +----------------+                         +------------------+
             |  sme_product   |                         |   sme_service    |
             +--------+-------+                         +------------------+
                      |
                      | STOCK_MUTATION
                      v
             +-----------------------+
             | sme_inventory_movement|
             +-----------------------+
```

---

## 2. Entity Type Definitions & Attribute Schemas

### 1. `sme_customer` (Customer Dossier)
- **Code:** `sme_customer`
- **Prefix:** `ent_sme_customer_`
- **Display Label:** Customer Full Name / Business Account Name
- **JSON Attributes:**
  - `email` (string): Primary contact email.
  - `phone` (string): WhatsApp/E.164 phone number.
  - `status` (string): `ACTIVE`, `VIP`, `CHURNED`, `INACTIVE`.
  - `total_spend` (float): Cumulative realized revenue from customer.
  - `last_interaction_at` (ISO timestamp): Timestamp of most recent order or message.

### 2. `sme_lead` (Sales Prospect)
- **Code:** `sme_lead`
- **Prefix:** `ent_sme_lead_`
- **Display Label:** Deal Title / Company Name
- **JSON Attributes:**
  - `contact_name` (string): Lead decision-maker.
  - `stage` (string): `NEW`, `QUALIFIED`, `PROPOSAL_SENT`, `NEGOTIATION`, `WON`, `LOST`.
  - `estimated_value` (float): Forecasted deal revenue.
  - `next_followup_at` (ISO date): Target date for next touchpoint.

### 3. `sme_opportunity` (Deal Pipeline)
- **Code:** `sme_opportunity`
- **Prefix:** `ent_sme_opportunity_`
- **JSON Attributes:**
  - `lead_id` (string): Related lead entity ID.
  - `probability_percent` (int): 0-100% win likelihood.
  - `expected_close_date` (ISO date): Expected contract signing date.

### 4. `sme_product` (Inventory SKU)
- **Code:** `sme_product`
- **Prefix:** `ent_sme_product_`
- **Display Label:** Product Title (e.g. "Rejuvenating Glow Oil 50ml")
- **JSON Attributes:**
  - `sku` (string): Unique stock-keeping unit barcode/code.
  - `selling_price` (float): Unit price charged to customers.
  - `cost_price` (float): Unit purchase or manufacturing cost.
  - `current_stock` (float): Available stock on hand.
  - `reorder_threshold` (float): Inventory level triggering low-stock signal.

### 5. `sme_service` (Service Offering)
- **Code:** `sme_service`
- **Prefix:** `ent_sme_service_`
- **Display Label:** Service Name (e.g. "Executive Strategy Session")
- **JSON Attributes:**
  - `price` (float): Standard service charge.
  - `duration_minutes` (int): Booking slot length.
  - `category` (string): Service grouping (e.g. Spa, Advisory, Maintenance).

### 6. `sme_order` (Sales Order)
- **Code:** `sme_order`
- **Prefix:** `ent_sme_order_`
- **Display Label:** Order Summary
- **JSON Attributes:**
  - `customer_id` (string): Link to `sme_customer`.
  - `customer_name` (string): Cached customer display name.
  - `items` (array): Array of objects `[{ product_id, name, quantity, price }]`.
  - `total_amount` (float): Grand order total.
  - `payment_status` (string): `PENDING`, `PARTIAL`, `PAID`, `REFUNDED`.
  - `fulfillment_status` (string): `UNFULFILLED`, `PROCESSING`, `SHIPPED`, `DELIVERED`.
  - `payment_method` (string): `paystack`, `bank_transfer`, `cash`, `pos`.

### 7. `sme_appointment` (Booking)
- **Code:** `sme_appointment`
- **Prefix:** `ent_sme_appointment_`
- **Display Label:** Appointment Summary
- **JSON Attributes:**
  - `customer_id` (string): Link to `sme_customer`.
  - `customer_name` (string): Customer name.
  - `service_id` (string): Link to `sme_service`.
  - `service_name` (string): Service name.
  - `start_time` (ISO timestamp): Start of appointment.
  - `staff_id` (string, optional): Assigned team member.
  - `price` (float): Appointment fee.
  - `status` (string): `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.

### 8. `sme_inventory_movement` (Stock Movement Ledger)
- **Code:** `sme_inventory_movement`
- **Prefix:** `ent_sme_inventory_movement_`
- **Display Label:** Movement Summary
- **JSON Attributes:**
  - `product_id` (string): Target product entity ID.
  - `product_name` (string): Product title.
  - `movement_type` (string): `SALE_DEDUCTION`, `PURCHASE_RECEIPT`, `MANUAL_ADJUSTMENT`, `RETURN_RESTOCK`.
  - `quantity` (float): Signed mutation amount (negative for deduction, positive for receipt).
  - `stock_after` (float): Resulting inventory balance.
  - `reference_order_id` (string, optional): Associated sales order or PO ID.

### 9. `sme_supplier` (Procurement Partner)
- **Code:** `sme_supplier`
- **Prefix:** `ent_sme_supplier_`
- **Display Label:** Vendor / Supplier Company Name
- **JSON Attributes:**
  - `contact_name` (string): Key representative.
  - `email` (string): Invoicing/ordering email.
  - `phone` (string): Contact phone.
  - `lead_time_days` (int): Typical delivery turnaround in days.

### 10. `sme_purchase_order` (PO)
- **Code:** `sme_purchase_order`
- **Prefix:** `ent_sme_purchase_order_`
- **Display Label:** PO Reference
- **JSON Attributes:**
  - `supplier_id` (string): Supplier entity ID.
  - `supplier_name` (string): Supplier name.
  - `items` (array): Array of `[{ product_id, name, quantity, unit_cost }]`.
  - `total_cost` (float): Total PO amount.
  - `status` (string): `DRAFT`, `SUBMITTED`, `RECEIVED`, `CANCELLED`.

### 11. `sme_quote` (Sales Estimate)
- **Code:** `sme_quote`
- **Prefix:** `ent_sme_quote_`
- **JSON Attributes:**
  - `customer_name` (string): Prospect name.
  - `items` (array): Proposed line items.
  - `total_amount` (float): Quoted total.
  - `valid_until` (ISO date): Expiration date.
  - `status` (string): `DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`.

### 12. `sme_invoice` (Receivable)
- **Code:** `sme_invoice`
- **Prefix:** `ent_sme_invoice_`
- **Display Label:** Invoice Reference
- **JSON Attributes:**
  - `customer_id` (string): Customer entity ID.
  - `customer_name` (string): Customer name.
  - `order_id` (string, optional): Related order ID.
  - `amount` (float): Total invoice balance.
  - `due_date` (ISO date): Payment due date.
  - `status` (string): `DRAFT`, `SENT`, `PAID`, `PARTIAL`, `OVERDUE`.

### 13. `sme_expense` (Operational Cost)
- **Code:** `sme_expense`
- **Prefix:** `ent_sme_expense_`
- **JSON Attributes:**
  - `category` (string): `RENT`, `UTILITIES`, `PAYROLL`, `SUPPLIES`, `MARKETING`, `LOGISTICS`.
  - `amount` (float): Cost amount.
  - `description` (string): Description of expenditure.
  - `vendor` (string): Payee / vendor.

### 14. `sme_project` (Client Deliverable)
- **Code:** `sme_project`
- **Prefix:** `ent_sme_project_`
- **Display Label:** Project Title
- **JSON Attributes:**
  - `client_name` (string): Client name.
  - `budget` (float): Total contracted budget.
  - `completion_percentage` (int): 0-100% progress.
  - `status` (string): `ACTIVE`, `COMPLETED`, `ON_HOLD`.

### 15. `sme_project_task` (Task)
- **Code:** `sme_project_task`
- **Prefix:** `ent_sme_project_task_`
- **Display Label:** Task Title
- **JSON Attributes:**
  - `project_id` (string, optional): Associated project ID.
  - `assignee` (string): Assigned staff member or role.
  - `priority` (string): `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
  - `status` (string): `TODO`, `IN_PROGRESS`, `DONE`.
  - `due_date` (ISO date): Deadline.

### 16. `sme_project_milestone` (Milestone)
- **Code:** `sme_project_milestone`
- **Prefix:** `ent_sme_project_milestone_`
- **JSON Attributes:**
  - `project_id` (string): Related project ID.
  - `target_date` (ISO date): Target delivery milestone date.
  - `is_reached` (bool): Completion status.
