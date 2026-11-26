# InteracAI SME Demo Playbook: 5 Industry Showcase Scripts
**Module:** `module_sme`  
**Purpose:** Step-by-step interactive scripts for product demonstrations, stakeholder evaluations, and enterprise sales meetings.

---

## 1. Showcase 1: Beauty & Wellness Studio (Hybrid Model)

**Concept:** A premium aesthetics spa selling high-margin treatment appointments alongside retail luxury skincare serums.

### Demonstration Steps:
1. **Apply Preset & Seed Fixtures:**
   - In the SME Workspace, select **Presets $\rightarrow$ Beauty & Wellness**.
   - Click **"Seed Demo Data"**.
   - Note the **HYBRID** badge and enabled capabilities (`APPOINTMENTS`, `INVENTORY`).
2. **Review Command Overview:**
   - Notice the Realized Revenue (₦45,000) and Receivables (₦100,000).
   - In the **Owner Attention Engine**, point out:
     - ⚠️ Overdue Invoice for Folake Adebayo (₦100,000).
     - ⚠️ Low Stock Alert: *Rejuvenating Glow Oil 50ml* (4 units remaining vs threshold 5).
3. **Simulate Appointment No-Show:**
   - Click **Services & Schedule** tab.
   - Locate the scheduled *Gold Luxury Spa Session* for Folake Adebayo.
   - Click the **"No Show"** button.
   - *Key Talking Point:* Explain how InteracAI immediately emits canonical signal `sme_appointment_no_show`, updating customer risk in the ARGUS Knowledge Graph and triggering an autonomous re-booking WhatsApp recovery flow.
4. **Execute ARGUS Copilot Skill:**
   - Switch to **ARGUS Intelligence** tab.
   - Select **Appointment No-Show Analyzer** (`appointment_no_show_analyzer`).
   - Click **"Execute Skill"**.
   - View real database calculations: Total No-Shows: 1, Lost Revenue: ₦30,000.
5. **Demonstrate Stock Auto-Deductions:**
   - Switch to **Orders & Sales** tab.
   - Record an order for 2 bottles of *Rejuvenating Glow Oil*.
   - Switch to **Products & Inventory** tab.
   - Show how stock automatically decremented from 4 to 2, and the movement was recorded in the **Stock Movements Ledger**.

---

## 2. Showcase 2: Consulting & Professional Services (Service Model)

**Concept:** A strategy and legal consulting firm managing client retainers, deliverable milestones, and high-value proposal pipelines.

### Demonstration Steps:
1. **Apply Consulting Preset:**
   - Select **Presets $\rightarrow$ Consulting & Professional Services**.
   - Notice the system automatically disables inventory tracking and activates project deliverables, task assignments, and retainer billing.
2. **Inspect the CRM Lead Pipeline:**
   - Click **Customers & Leads** tab.
   - Point out the active lead: *Dr. Ken Nnamani (Corporate Retainer)* valued at ₦350,000 at `QUALIFIED` stage.
3. **Execute Sales Pipeline Analyzer:**
   - Switch to **ARGUS Intelligence** tab.
   - Select **Sales Pipeline Analyzer** (`sales_pipeline_analyzer`).
   - Click **"Execute Skill"**.
   - Point out the pipeline value and stage distribution computed directly from live lead records.
4. **Inspect Project Deliverables & Tasks:**
   - Switch to **Projects & Tasks** tab.
   - Point out client projects, completion percentages, and operational tasks assigned to team leads.
5. **Execute Operational Bottleneck Detector:**
   - In **ARGUS Intelligence**, run `operational_bottleneck_detector` to reveal any overdue deliverables or stalled tasks.

---

## 3. Showcase 3: Fashion, Apparel & Custom Tailoring (Product Model)

**Concept:** A bespoke design house and fashion boutique sourcing luxury fabrics and fulfilling made-to-order couture.

### Demonstration Steps:
1. **Apply Fashion Preset:**
   - Select **Presets $\rightarrow$ Fashion & Custom Apparel**.
2. **Review Fabric & Garment Catalog:**
   - Go to **Products & Inventory** tab.
   - Demonstrate SKU tracking for custom fabrics, ready-to-wear pieces, and tailoring accessories.
3. **Demonstrate Procurement & Goods Receipt:**
   - Show how a purchase order to *Textile Importers Ltd* is marked **"Received"**.
   - Observe the stock count automatically incrementing and logging a `PURCHASE_RECEIPT` in the ledger.
4. **Execute Fast vs Slow Moving Inventory:**
   - Run `fast_slow_moving_inventory` to identify high-velocity textile patterns vs dead capital fabric bolts.

---

## 4. Showcase 4: Commercial Printing & Merchandise (Product Model)

**Concept:** High-volume digital printing press handling branded packaging, promotional merchandise, and corporate stationery.

### Demonstration Steps:
1. **Apply Printing Preset:**
   - Select **Presets $\rightarrow$ Commercial Printing & Merchandise**.
2. **Demonstrate Quote-to-Order Conversion:**
   - Point out customer quotes and estimates.
   - Run **Quote-to-Order Conversion Rate** (`quote_to_order_conversion`) to showcase sales win rates and friction factors.
3. **Review Supplier Lead Time Performance:**
   - Run `supplier_lead_time_performance` to evaluate whether paper stock suppliers are delivering within their contractual 3-day turnaround.

---

## 5. Showcase 5: Commercial Cleaning & Facility Care (Service Model)

**Concept:** Contract cleaning and sanitation provider managing recurring commercial site visits, shifts, and janitorial chemical consumption.

### Demonstration Steps:
1. **Apply Cleaning Preset:**
   - Select **Presets $\rightarrow$ Commercial Cleaning & Facilities**.
2. **Review Dispatch Schedule:**
   - Inspect recurring scheduled cleanings across corporate facilities.
3. **Execute Service Utilization Rate:**
   - Run `service_utilization_rate` to show management what percentage of daily crew hours are committed vs idle.
4. **Demonstrate Daily Executive Brief:**
   - Run `daily_business_brief` to view the comprehensive 1-click morning briefing prepared for the business owner.
