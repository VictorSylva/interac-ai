# InteracAI SME Onboarding & Operational Setup Guide
**Module:** `module_sme`  

---

## 1. Quick-Start Onboarding Wizard

Setting up an enterprise inside the SME & Business Operations module takes less than 3 minutes through the streamlined 5-step onboarding flow:

```
  [Step 1: Select Model / Preset]
                 |
                 v
  [Step 2: Initialize Dynamic Entities]
                 |
                 v
  [Step 3: Connect Payment Gateway (Paystack)]
                 |
                 v
  [Step 4: Seed Fixtures / Import Initial Catalog]
                 |
                 v
  [Step 5: Deploy 15 Starter Workflows]
```

---

## 2. Step-by-Step Instructions

### Step 1: Select Operational Model or Industry Preset
1. Navigate to `/dashboard/sme` or `/dashboard/modules`.
2. Locate **SME & Business Operations** and enter the workspace.
3. Click the **Presets** dropdown in the top header and select the preset matching your business:
   - **Beauty & Wellness:** Automatically configures Hybrid model with treatments and retail products.
   - **Consulting & Professional Services:** Automatically configures Service model with retainer invoicing and project tasks.
   - **Fashion & Custom Apparel:** Automatically configures Product model with fabrics, measurement records, and bespoke SKUs.
   - **Commercial Printing & Merchandise:** Automatically configures Product model with raw material stock and quote-to-order flow.
   - **Commercial Cleaning & Facilities:** Automatically configures Service model with scheduled site dispatch and chemical stock.
4. *Alternative:* Go to the **Model Settings** tab and manually toggle individual capabilities (`APPOINTMENTS`, `INVENTORY`, `PROJECTS`, `QUOTES`, etc.).

### Step 2: Configure Business Currency & Tax Defaults
1. Under **Model Settings**, verify default currency (e.g. `NGN`, `USD`, `GBP`).
2. Input applicable Value Added Tax rate (e.g. `7.5%` for Nigerian VAT).
3. Set standard payment terms for client invoicing (e.g. `14 days`).

### Step 3: Connect Real Payment Gateway
1. Navigate to **Payment Integrations** (or Paystack Settings).
2. Input live `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`.
3. Test checkout generation: All paid orders will immediately verify against Paystack Webhooks and automatically deduct physical inventory.
4. *Note on other gateways (Flutterwave, Stripe):* Unconfigured connectors display as "Not connected / Coming soon" with zero fake/simulated payment completions.

### Step 4: Import or Populate Operational Records
Choose between two paths:
- **Instant Demo Evaluation:** Click **"Seed Demo Data"** in the top action bar to immediately populate representative customer dossiers, active leads, product SKUs, booking appointments, invoices, and expense ledgers.
- **Production Setup:**
  1. Add Product SKUs under **Products & Inventory** tab (name, SKU, selling price, cost, stock, threshold).
  2. Add Service offerings under **Services & Schedule** tab (name, category, price, duration).
  3. Register Primary Suppliers under **Procurement** tab.
  4. Import or add initial VIP customer profiles under **Customers & Leads**.

### Step 5: Deploy Autonomous Starter Workflows
1. Click **"Deploy 15 Workflows"** in the workspace banner.
2. The InteracAI Workflow Engine will instantiate all 15 pre-built DAGs:
   - Low-stock supplier restock alerts
   - Appointment no-show win-back flows
   - Overdue invoice debt escalation
   - 24-hour appointment reminder dispatch
   - VIP customer auto-upgrades
3. View and customize triggers in the visual **Workflow Builder** (`/dashboard/workflows`).

---

## 3. Post-Onboarding Verification Checklist

- [ ] Command Overview displays real-time aggregated financial figures.
- [ ] Recording a test order decreases product SKU stock and records movement in ledger.
- [ ] Marking an appointment as `NO_SHOW` increments customer risk score in ARGUS OS.
- [ ] Executing `daily_business_brief` returns live synthesis without errors.
- [ ] Department permissions are restricted based on user role (`sales`, `finance`, `operations`).
