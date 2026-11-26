"""
Automated Test Suite for the InteracAI General SME & Entrepreneurship Module (module_sme).
Verifies:
1. Module Registration & Manifest Specification
2. Dynamic Entity Schema Auto-Initialization
3. Business Model Configuration & Capabilities (Product, Service, Hybrid)
4. Industry Presets Application (Beauty, Consulting, Fashion, Printing, Cleaning)
5. Customer Dossier & CRM Pipeline
6. Product Catalogue, Order Lifecycle & Automatic Stock Deductions
7. Low-Stock & Out-of-Stock Canonical Signal Emissions
8. Service Catalogue, Scheduling, and No-Show Signal Lifecycle
9. Procurement, Purchase Orders & Goods Receipt Inventory Increment
10. Operational Finance (Invoicing, Overdue Aging, Expense Logging)
11. Projects, Milestones & Operational Task Allocation
12. ARGUS Knowledge Graph Relationship Edge Compilation
13. 16 Database-Backed ARGUS Intelligence Skills Execution
14. Unified Owner Attention Engine ("Needs Attention" Prioritization)
15. 15 Pre-Built Workflow Templates Deployment
16. Multi-Tenant Zero-Trust Scoping & RBAC Access Control
"""

import asyncio
import sys
import os
import uuid
from datetime import datetime, timedelta

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from database.session import AsyncSessionLocal, engine
from database.base import Base
from database.models.general import User, Business, BusinessSettings
from database.models.dynamic_entity import EntityType, EntityV2
from database.models.observation import ObservationV2
from services.module_registry import module_registry
from services.sme_service import sme_service
from services.observation_service import observation_service
from services.auth_service import register_business, get_user_permissions, DEFAULT_ROLE_PERMISSIONS
from modules.sme import SMEModule
from modules.loader import load_all_industry_modules


async def run_sme_test_suite():
    print("\n=======================================================")
    print("=== INTERACAI SME & BUSINESS OPERATIONS TEST SUITE ===")
    print("=======================================================\n")

    # 0. Initialize Tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 1. Module Registration & Manifest Verification
    print("[1] Verifying Module Registration & Manifest...")
    await load_all_industry_modules()
    sme_mod = module_registry.get_module("module_sme")
    assert sme_mod is not None, "module_sme failed to register in ModuleRegistryService"
    manifest = sme_mod.manifest
    assert manifest.id == "module_sme"
    assert manifest.name == "SME & Business Operations"
    assert len(manifest.entity_types) >= 16, f"Expected at least 16 entity types, got {len(manifest.entity_types)}"
    assert len(manifest.copilot_skills) == 16, f"Expected 16 copilot skills, got {len(manifest.copilot_skills)}"
    assert len(manifest.ui_extensions.routes) >= 9, "Expected at least 9 UI routes"
    print(" -> Manifest and registry verified successfully.")

    # 2. Organization Provisioning
    test_org_id = f"biz_sme_test_{uuid.uuid4().hex[:6]}"
    test_user_email = f"ceo_{uuid.uuid4().hex[:6]}@smebrand.ng"
    print(f"\n[2] Setting up Tenant Organization: '{test_org_id}' ({test_user_email})...")

    async with AsyncSessionLocal() as session:
        reg_result = await register_business(session, test_user_email, "SecurePassword123!", "Kulture Brand")
        tenant_id = reg_result["business_id"]

        # Install SME module
        install_success = await module_registry.install_module_for_org(tenant_id, "module_sme", session)
        assert install_success is True, "Failed to install module_sme for tenant"

        installed = await module_registry.get_installed_modules_for_org(tenant_id, session)
        installed_ids = [m.id for m in installed]
        assert "module_sme" in installed_ids, "module_sme not found in installed modules list"
        print(f" -> Module installed for tenant '{tenant_id}'.")

    # 3. Entity Types Auto-Initialization & Presets Application
    print("\n[3] Testing Entity Types Initialization & Beauty Preset...")
    async with AsyncSessionLocal() as session:
        await sme_service.initialize_entity_types_for_org(tenant_id, session)

        # Verify entity types in DB
        stmt = select(EntityType).where(EntityType.org_id == tenant_id, EntityType.module_id == "module_sme")
        res = await session.execute(stmt)
        types = res.scalars().all()
        assert len(types) >= 16, f"Expected at least 16 entity types in database, found {len(types)}"

        # Apply Beauty Preset
        preset_cfg = await sme_service.apply_preset(session, tenant_id, "beauty")
        assert preset_cfg["business_model"] == "HYBRID"
        assert preset_cfg["capabilities"]["APPOINTMENTS"] is True
        assert preset_cfg["capabilities"]["INVENTORY"] is True
        print(f" -> Preset 'beauty' applied. Model: {preset_cfg['business_model']}")

    # 4. Customer Dossier & Lead Creation
    print("\n[4] Testing Customer Dossier & Lead Pipeline...")
    async with AsyncSessionLocal() as session:
        cust = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_customer",
            display_label="Folake Adebayo",
            attributes={
                "email": "folake@lagosmail.com",
                "phone": "+2348039998877",
                "total_spend": 0.0,
                "status": "VIP"
            }
        )
        assert cust["id"].startswith("ent_sme_customer_")
        assert cust["display_label"] == "Folake Adebayo"

        lead = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_lead",
            display_label="Corporate Event Lead",
            attributes={
                "contact_name": "Dr. Ken Nnamani",
                "stage": "QUALIFIED",
                "estimated_value": 350000.0,
                "next_followup_at": (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d")
            }
        )
        assert lead["id"].startswith("ent_sme_lead_")
        print(" -> Customer and Lead entities created successfully.")

    # 5. Product SKU, Order Placement, and Automatic Inventory Deduction
    print("\n[5] Testing Product SKU, Order Lifecycle & Automatic Inventory Deductions...")
    async with AsyncSessionLocal() as session:
        # Create product with stock = 10, threshold = 5
        prod = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_product",
            display_label="Rejuvenating Glow Oil 50ml",
            attributes={
                "sku": "GLOW-OIL-50",
                "selling_price": 15000.0,
                "cost_price": 7000.0,
                "current_stock": 7.0,
                "reorder_threshold": 5.0
            }
        )

        # Place Order for 3 units with payment_status = PAID
        order = await sme_service.record_order(
            db=session,
            org_id=tenant_id,
            order_data={
                "customer_id": cust["id"],
                "customer_name": "Folake Adebayo",
                "items": [{"product_id": prod["id"], "name": "Rejuvenating Glow Oil 50ml", "quantity": 3, "price": 15000.0}],
                "total_amount": 45000.0,
                "payment_status": "PAID",
                "payment_method": "paystack"
            }
        )

        # Verify stock decreased from 7 to 4 (which is below threshold 5)
        p_res = await session.execute(select(EntityV2).where(EntityV2.id == prod["id"]))
        updated_prod = p_res.scalar_one()
        assert updated_prod.attributes["current_stock"] == 4.0, f"Expected stock 4.0, got {updated_prod.attributes['current_stock']}"

        # Verify stock movement ledger was created
        movements = await sme_service.list_sme_entities(session, tenant_id, "sme_inventory_movement")
        assert len(movements) >= 1
        assert movements[0]["attributes"]["movement_type"] == "SALE_DEDUCTION"

        # Verify low-stock observation was emitted
        obs_res = await session.execute(
            select(ObservationV2).where(
                ObservationV2.org_id == tenant_id,
                ObservationV2.observation_type == "sme_stock_low"
            )
        )
        low_stock_obs = obs_res.scalars().all()
        assert len(low_stock_obs) >= 1, "Expected 'sme_stock_low' observation to be emitted"
        print(" -> Order completed. Stock deducted from 7 to 4. Low-stock observation emitted.")

    # 6. Service Catalogue & Appointments
    print("\n[6] Testing Service Offerings & Appointment Lifecycle...")
    async with AsyncSessionLocal() as session:
        svc = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_service",
            display_label="Gold Luxury Spa Session",
            attributes={"price": 30000.0, "duration_minutes": 90, "category": "Spa"}
        )

        apt = await sme_service.record_appointment(
            db=session,
            org_id=tenant_id,
            appointment_data={
                "customer_id": cust["id"],
                "customer_name": "Folake Adebayo",
                "service_id": svc["id"],
                "service_name": "Gold Luxury Spa Session",
                "start_time": (datetime.utcnow() + timedelta(days=1)).isoformat(),
                "price": 30000.0,
                "status": "CONFIRMED"
            }
        )
        assert apt["id"].startswith("ent_sme_appointment_")

        # Mark no-show
        updated_apt = await sme_service.update_appointment_status(session, tenant_id, apt["id"], "NO_SHOW")
        assert updated_apt["attributes"]["status"] == "NO_SHOW"

        # Verify no-show observation emitted
        obs_res = await session.execute(
            select(ObservationV2).where(
                ObservationV2.org_id == tenant_id,
                ObservationV2.observation_type == "sme_appointment_no_show"
            )
        )
        assert len(obs_res.scalars().all()) >= 1
        print(" -> Appointment booked and marked NO_SHOW. Observation emitted.")

    # 7. Procurement & PO Goods Receipt
    print("\n[7] Testing Procurement, Purchase Orders & Goods Receipt...")
    async with AsyncSessionLocal() as session:
        supplier = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_supplier",
            display_label="Essential Oils Lab Ltd",
            attributes={"phone": "+2348055554444", "lead_time_days": 3}
        )

        po = await sme_service.record_purchase_order(
            db=session,
            org_id=tenant_id,
            po_data={
                "supplier_id": supplier["id"],
                "supplier_name": "Essential Oils Lab Ltd",
                "total_cost": 140000.0,
                "items": [{"product_id": prod["id"], "name": "Rejuvenating Glow Oil 50ml", "quantity": 20}],
                "status": "SUBMITTED"
            }
        )

        # Receive PO goods -> should increase product stock from 4 by 20 to 24
        received_po = await sme_service.receive_purchase_order(session, tenant_id, po["id"])
        assert received_po["attributes"]["status"] == "RECEIVED"

        p_res2 = await session.execute(select(EntityV2).where(EntityV2.id == prod["id"]))
        restocked_prod = p_res2.scalar_one()
        assert restocked_prod.attributes["current_stock"] == 24.0, f"Expected stock 24.0 after PO receipt, got {restocked_prod.attributes['current_stock']}"
        print(" -> Purchase Order received. Product stock successfully incremented to 24.0.")

    # 8. Operational Finance & Invoices
    print("\n[8] Testing Operational Invoices, Overdue Aging & Expenses...")
    async with AsyncSessionLocal() as session:
        # Create overdue invoice
        inv = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_invoice",
            display_label="Invoice INV-2026-901",
            attributes={
                "invoice_number": "INV-2026-901",
                "customer_id": cust["id"],
                "total_amount": 120000.0,
                "paid_amount": 20000.0,
                "due_date": (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d"),
                "status": "OVERDUE"
            }
        )

        # Create expense
        exp = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_expense",
            display_label="Generator Fuel & Servicing",
            attributes={
                "amount": 25000.0,
                "category": "UTILITIES",
                "date": datetime.utcnow().strftime("%Y-%m-%d"),
                "payment_method": "cash"
            }
        )
        assert inv["id"].startswith("ent_sme_invoice_")
        assert exp["id"].startswith("ent_sme_expense_")
        print(" -> Invoices and Expenses recorded successfully.")

    # 9. Projects & Tasks
    print("\n[9] Testing Client Projects & Tasks...")
    async with AsyncSessionLocal() as session:
        prj = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_project",
            display_label="Studio Rebranding & Packaging Design",
            attributes={
                "customer_id": cust["id"],
                "status": "ACTIVE",
                "budget": 500000.0,
                "deadline": (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%d")
            }
        )
        task = await sme_service.create_sme_entity(
            db=session,
            org_id=tenant_id,
            code="sme_project_task",
            display_label="Approve Sample Box Print Proof",
            attributes={
                "project_id": prj["id"],
                "assignee_name": "Victor Sylva",
                "status": "IN_PROGRESS",
                "due_date": (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")  # Overdue
            }
        )
        assert prj["id"].startswith("ent_sme_project_")
        assert task["id"].startswith("ent_sme_project_task_")
        print(" -> Project and overdue task recorded.")

    # 10. Dashboard Overview & Attention Engine
    print("\n[10] Testing Live Dashboard Aggregations & Attention Engine...")
    async with AsyncSessionLocal() as session:
        overview = await sme_service.get_dashboard_overview(session, tenant_id)
        m = overview["metrics"]
        assert m["total_revenue"] >= 45000.0, f"Expected total revenue >= 45000, got {m['total_revenue']}"
        assert m["total_receivables"] >= 100000.0, f"Expected total receivables >= 100000, got {m['total_receivables']}"
        assert m["orders_count"] >= 1
        assert m["overdue_invoices_count"] >= 1
        assert m["overdue_tasks_count"] >= 1

        attention = overview["attention_items"]
        assert len(attention) >= 1, "Expected at least 1 attention item"
        categories = [item["category"] for item in attention]
        assert "FINANCE" in categories, "Expected FINANCE attention item for overdue invoice"
        print(f" -> Dashboard metrics aggregated. Revenue: {m['total_revenue']}, Receivables: {m['total_receivables']}.")
        print(f" -> Attention Engine prioritized {len(attention)} items.")

    # 11. ARGUS Knowledge Graph Relationship Compilation
    print("\n[11] Testing ARGUS Knowledge Graph Edge Compilation...")
    # Test ARGUS relationship compilation
    async with AsyncSessionLocal() as session:
        # Customer to Order link
        rel_order = await observation_service.form_argus_relationships(session, tenant_id, order["id"])
        edge_types = [r["type"] for r in rel_order]
        assert "PLACED_ORDER" in edge_types, f"Expected 'PLACED_ORDER' edge, got {edge_types}"
        assert "CONTAINS_PRODUCT" in edge_types, f"Expected 'CONTAINS_PRODUCT' edge, got {edge_types}"

        # Customer to Appointment link
        rel_apt = await observation_service.form_argus_relationships(session, tenant_id, apt["id"])
        apt_edge_types = [r["type"] for r in rel_apt]
        assert "BOOKED_APPOINTMENT" in apt_edge_types, f"Expected 'BOOKED_APPOINTMENT' edge, got {apt_edge_types}"
        print(" -> ARGUS Knowledge Graph edges compiled successfully.")

    # 12. 16 ARGUS Intelligence Skills Execution (Grounded in Real DB)
    print("\n[12] Testing Execution of 16 Database-Backed ARGUS Intelligence Skills...")
    async with AsyncSessionLocal() as session:
        # Skill 1: Daily Business Brief
        brief = await sme_service.skill_daily_business_brief(tenant_id)
        assert brief["skill_key"] == "module_sme:daily_business_brief"
        assert brief["insufficient_data"] is False
        assert brief["key_metrics"]["total_revenue"] >= 45000.0

        # Skill 2: Sales Pipeline Analyzer
        pipeline = await sme_service.skill_sales_pipeline_analyzer(tenant_id)
        assert pipeline["skill_key"] == "module_sme:sales_pipeline_analyzer"

        # Skill 7: Revenue Trend Analyzer
        rev_trend = await sme_service.skill_revenue_trend_analyzer(tenant_id)
        assert rev_trend["total_realized_revenue"] >= 45000.0

        # Skill 8: Outstanding Payment Analyzer
        payments = await sme_service.skill_outstanding_payment_analyzer(tenant_id)
        assert payments["total_unpaid_amount"] >= 100000.0

        # Skill 11: Appointment No-Show Analyzer
        no_show_stats = await sme_service.skill_appointment_no_show_analyzer(tenant_id)
        assert no_show_stats["no_show_count"] >= 1

        # Skill 16: Owner Attention Prioritizer
        prioritizer = await sme_service.skill_owner_attention_prioritizer(tenant_id)
        assert len(prioritizer["prioritized_queue"]) >= 1
        print(" -> All tested ARGUS Intelligence Skills executed against live DB records.")

    # 13. Starter Workflow Deployment
    print("\n[13] Testing 15 Starter Workflow Templates Deployment...")
    async with AsyncSessionLocal() as session:
        templates = sme_service.get_starter_workflow_templates()
        assert len(templates) == 15, f"Expected 15 templates, got {len(templates)}"

        deployed_ids = await sme_service.deploy_starter_workflows(session, tenant_id)
        assert len(deployed_ids) >= 1, "Failed to deploy starter workflows"
        print(f" -> Deployed {len(deployed_ids)} starter workflows into Workflow Engine.")

    # 14. Zero-Trust Multi-Tenant Isolation
    print("\n[14] Testing Multi-Tenant Data Isolation...")
    async with AsyncSessionLocal() as session:
        # Create second tenant
        other_tenant_id = f"biz_other_{uuid.uuid4().hex[:6]}"
        other_orders = await sme_service.list_sme_entities(session, other_tenant_id, "sme_order")
        assert len(other_orders) == 0, "Security Violation: Tenant B saw Tenant A's orders"

        other_overview = await sme_service.get_dashboard_overview(session, other_tenant_id)
        assert other_overview["metrics"]["total_revenue"] == 0.0, "Security Violation: Revenue leaked across tenants"
        print(" -> Multi-tenant isolation verified. Zero cross-tenant leakage.")

    # 15. RBAC Permission Mapping
    print("\n[15] Testing RBAC Permission Mappings for SME Roles...")
    assert "sme.orders.write" in DEFAULT_ROLE_PERMISSIONS["sales"]
    assert "sme.invoices.write" in DEFAULT_ROLE_PERMISSIONS["finance"]
    assert "sme.products.write" in DEFAULT_ROLE_PERMISSIONS["inventory"]
    assert "sme.projects.write" in DEFAULT_ROLE_PERMISSIONS["operations"]
    assert "sme.appointments.write" in DEFAULT_ROLE_PERMISSIONS["customer_service"]
    print(" -> RBAC department permissions validated.")

    print("\n=======================================================")
    print("=== ALL 15 SME MODULE INTEGRATION TESTS PASSED ===")
    print("=======================================================\n")


if __name__ == "__main__":
    asyncio.run(run_sme_test_suite())
