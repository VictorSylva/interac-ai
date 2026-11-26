"""
InteracAI General SME & Entrepreneurship REST Operations Router.
Exposes clean, capability-driven REST endpoints for SME business models:
- Configuration, Onboarding & Presets
- Real-Time Command Dashboard & Owner Attention Engine
- Unified Customers, Leads & Sales Journey
- Products, Stock Movements & Low-Stock Alerts
- Services, Appointments & No-Show Lifecycle
- Procurement, Suppliers & Purchase Orders
- Finance Operations (Invoices, Expenses, Payments)
- Client Projects & Operational Task Breakdown
- 16 Database-Backed ARGUS Intelligence Skills & Daily Business Brief
- Starter Workflows Deployment
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Dict, Any, List, Optional
import logging

from database.session import get_db
from database.models.dynamic_entity import EntityV2, EntityType
from database.models.observation import ObservationV2
from services.sme_service import sme_service
from services.observation_service import observation_service
from services.auth_service import require_permission, get_current_user
from services.db_service import resolve_business_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/sme", tags=["SME Operations"])


async def _verify_tenant_access(requested_org_id: str, current_user: dict) -> str:
    """Zero-Trust Multi-Tenant Guard: Resolves canonical tenant ID and prevents cross-tenant access."""
    real_requested_id = await resolve_business_id(requested_org_id)
    user_biz_id = await resolve_business_id(current_user.get("business_id", ""))

    if current_user.get("role") not in ["super_admin", "owner"] and user_biz_id != real_requested_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant mismatch: Cannot access records of another business."
        )
    return real_requested_id


# --------------------------------------------------------------------------
# 1. CONFIGURATION, ONBOARDING & PRESETS
# --------------------------------------------------------------------------

@router.get("/config")
async def get_sme_configuration(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.get_sme_config(db, tenant_id)


@router.post("/config")
async def update_sme_configuration(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing 'org_id'")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.update_sme_config(db, tenant_id, payload)


@router.post("/onboard")
async def complete_sme_onboarding(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Executes the 8-step SME onboarding wizard."""
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)

    config_update = {
        "business_name": payload.get("business_name", "My SME"),
        "industry": payload.get("industry", "General SME"),
        "business_model": payload.get("business_model", "HYBRID"),
        "sales_channels": payload.get("sales_channels", ["whatsapp", "web"]),
        "capabilities": payload.get("capabilities", {}),
        "setup_completed": True
    }
    updated_cfg = await sme_service.update_sme_config(db, tenant_id, config_update)
    await sme_service.initialize_entity_types_for_org(tenant_id, db)

    # Automatically deploy starter workflows if requested
    if payload.get("deploy_starter_workflows", True):
        await sme_service.deploy_starter_workflows(db, tenant_id)

    return {"success": True, "message": "Onboarding completed successfully", "config": updated_cfg}


@router.post("/preset")
@router.post("/config/preset/{preset_id}")
async def apply_industry_preset(
    preset_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Applies one of the 5 built-in industry presets."""
    body = payload or {}
    target_org = org_id or body.get("org_id") or current_user.get("business_id")
    preset_key = preset_id or body.get("preset_key") or body.get("preset_id", "beauty")
    tenant_id = await _verify_tenant_access(target_org, current_user)
    cfg = await sme_service.apply_preset(db, tenant_id, preset_key)
    return {"success": True, "config": cfg}


@router.post("/seed-demo")
@router.post("/demo/seed")
async def seed_sme_demo_data(
    payload: Optional[Dict[str, Any]] = None,
    org_id: Optional[str] = Query(None),
    preset_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Seeds realistic demonstration data for a given archetype."""
    body = payload or {}
    target_org = org_id or body.get("org_id") or current_user.get("business_id")
    preset = preset_id or body.get("preset") or body.get("preset_id", "beauty")
    tenant_id = await _verify_tenant_access(target_org, current_user)
    return await sme_service.seed_demo_data(db, tenant_id, preset)


# --------------------------------------------------------------------------
# 2. DASHBOARD OVERVIEW & ATTENTION ENGINE
# --------------------------------------------------------------------------

@router.get("/dashboard/overview")
async def get_dashboard_overview(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.get_dashboard_overview(db, tenant_id)


@router.get("/attention")
async def get_owner_attention_feed(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.get_owner_attention_items(db, tenant_id)


# --------------------------------------------------------------------------
# 3. CUSTOMERS & CRM
# --------------------------------------------------------------------------

@router.get("/customers")
async def list_customers(
    org_id: str = Query(...),
    search: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_customer", search=search, limit=limit, offset=offset)


@router.post("/customers", status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    name = payload.get("name") or payload.get("display_label", "Unnamed Customer")

    ent = await sme_service.create_sme_entity(
        db=db,
        org_id=tenant_id,
        code="sme_customer",
        display_label=name,
        attributes=payload.get("attributes", payload)
    )

    observation_service.record_observation(
        db=db,
        org_id=tenant_id,
        source_channel="sme_crm",
        observation_type="sme_customer_created",
        primary_entity_id=ent["id"],
        payload={"customer_name": name, "email": payload.get("email"), "phone": payload.get("phone")},
        severity="INFO"
    )

    # Mirror into core CRM leads table
    try:
        from database.models.crm import Lead
        core_cust = Lead(
            business_id=tenant_id,
            name=name,
            email=payload.get("email"),
            phone=payload.get("phone"),
            contact=payload.get("phone") or payload.get("email") or name,
            status=(payload.get("status") or "active").lower(),
            value=int(float(payload.get("total_spend") or 0)),
            tags=["Customer", payload.get("status", "ACTIVE")],
            notes=f"SME Customer: {name}"
        )
        db.add(core_cust)
        await db.commit()
    except Exception as cust_err:
        logger.warning(f"[SME] Could not mirror customer to core leads table: {cust_err}")

    return ent


@router.get("/leads")
async def list_leads(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_lead")


@router.post("/leads", status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    name = payload.get("name") or payload.get("display_label", "New Lead")

    ent = await sme_service.create_sme_entity(
        db=db,
        org_id=tenant_id,
        code="sme_lead",
        display_label=name,
        attributes=payload.get("attributes", payload)
    )
    observation_service.record_observation(
        db=db,
        org_id=tenant_id,
        source_channel="sme_crm",
        observation_type="sme_lead_created",
        primary_entity_id=ent["id"],
        payload={"lead_name": name, "source": payload.get("source", "direct")},
        severity="INFO"
    )

    # Mirror into core CRM leads table
    try:
        from database.models.crm import Lead
        core_lead = Lead(
            business_id=tenant_id,
            name=payload.get("contact_name") or name,
            email=payload.get("email"),
            phone=payload.get("phone"),
            contact=payload.get("phone") or payload.get("email") or name,
            status=(payload.get("stage") or "qualified").lower(),
            value=int(float(payload.get("estimated_value") or 0)),
            tags=["SME Lead", payload.get("stage", "QUALIFIED")],
            notes=f"SME Deal: {name}"
        )
        db.add(core_lead)
        await db.commit()
    except Exception as lead_err:
        logger.warning(f"[SME] Could not mirror lead to core leads table: {lead_err}")

    return ent


@router.get("/opportunities")
async def list_opportunities(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_opportunity")


@router.post("/opportunities", status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    title = payload.get("title") or payload.get("display_label", "Sales Opportunity")
    return await sme_service.create_sme_entity(db, tenant_id, "sme_opportunity", title, payload.get("attributes", payload))


# --------------------------------------------------------------------------
# 4. PRODUCTS & INVENTORY
# --------------------------------------------------------------------------

@router.get("/products")
async def list_products(
    org_id: str = Query(...),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_product", search=search)


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    title = payload.get("title") or payload.get("name") or payload.get("display_label", "Product Item")

    ent = await sme_service.create_sme_entity(
        db=db,
        org_id=tenant_id,
        code="sme_product",
        display_label=title,
        attributes=payload.get("attributes", payload)
    )
    observation_service.record_observation(
        db=db,
        org_id=tenant_id,
        source_channel="sme_inventory",
        observation_type="sme_product_created",
        primary_entity_id=ent["id"],
        payload={"product_title": title, "sku": payload.get("sku")},
        severity="INFO"
    )
    return ent


@router.get("/inventory/movements")
async def list_inventory_movements(
    org_id: str = Query(...),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_inventory_movement", limit=limit)


@router.post("/inventory/adjust")
async def adjust_inventory(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Manual inventory stock adjustment with movement audit trail."""
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    product_id = payload.get("product_id")
    new_quantity = float(payload.get("new_quantity") or 0.0)
    reason = payload.get("reason", "Manual adjustment")

    p_stmt = select(EntityV2).where(EntityV2.id == product_id, EntityV2.org_id == tenant_id)
    p_res = await db.execute(p_stmt)
    product = p_res.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    p_attrs = dict(product.attributes or {})
    old_stock = float(p_attrs.get("current_stock") or 0.0)
    diff = new_quantity - old_stock
    p_attrs["current_stock"] = new_quantity
    product.attributes = p_attrs

    # Log movement
    await sme_service.create_sme_entity(
        db=db,
        org_id=tenant_id,
        code="sme_inventory_movement",
        display_label=f"Adjustment: {product.display_label} ({diff:+g})",
        attributes={
            "product_id": product.id,
            "product_name": product.display_label,
            "movement_type": "ADJUSTMENT",
            "quantity": diff,
            "reason": reason,
            "stock_after": new_quantity
        }
    )
    await db.commit()

    observation_service.record_observation(
        db=db,
        org_id=tenant_id,
        source_channel="sme_inventory",
        observation_type="sme_stock_adjusted",
        primary_entity_id=product.id,
        payload={"product_name": product.display_label, "old_stock": old_stock, "new_stock": new_quantity, "reason": reason},
        severity="INFO"
    )

    return {"success": True, "product_id": product_id, "new_quantity": new_quantity, "difference": diff}


# --------------------------------------------------------------------------
# 5. SERVICES & APPOINTMENTS
# --------------------------------------------------------------------------

@router.get("/services")
async def list_services(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_service")


@router.post("/services", status_code=status.HTTP_201_CREATED)
async def create_service(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    name = payload.get("name") or payload.get("display_label", "Service Offering")
    return await sme_service.create_sme_entity(db, tenant_id, "sme_service", name, payload.get("attributes", payload))


@router.get("/appointments")
async def list_appointments(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_appointment")


@router.post("/appointments", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.record_appointment(db, tenant_id, payload)


@router.put("/appointments/{appointment_id}/status")
@router.post("/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    payload: Optional[Dict[str, Any]] = None,
    status: Optional[str] = Query(None),
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    body = payload or {}
    target_org = org_id or body.get("org_id") or current_user.get("business_id")
    status_str = status or body.get("status", "CONFIRMED")
    tenant_id = await _verify_tenant_access(target_org, current_user)
    updated = await sme_service.update_appointment_status(db, tenant_id, appointment_id, status_str)
    if not updated:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return updated


# --------------------------------------------------------------------------
# 6. SALES ORDERS & QUOTES
# --------------------------------------------------------------------------

@router.get("/orders")
async def list_orders(
    org_id: str = Query(...),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_order", limit=limit)


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.record_order(db, tenant_id, payload)


@router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    updated = await sme_service.update_order_status(
        db, tenant_id, order_id,
        payment_status=payload.get("payment_status"),
        fulfilment_status=payload.get("fulfilment_status")
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")
    return updated


@router.get("/quotes")
async def list_quotes(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_quote")


@router.post("/quotes", status_code=status.HTTP_201_CREATED)
async def create_quote(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    label = payload.get("display_label") or f"Quotation {payload.get('quote_number', 'Draft')}"

    ent = await sme_service.create_sme_entity(db, tenant_id, "sme_quote", label, payload.get("attributes", payload))
    observation_service.record_observation(
        db=db,
        org_id=tenant_id,
        source_channel="sme_sales",
        observation_type="sme_quotation_created",
        primary_entity_id=ent["id"],
        payload={"quote_label": label, "total": payload.get("total")},
        severity="INFO"
    )
    return ent


# --------------------------------------------------------------------------
# 7. PROCUREMENT & SUPPLIERS
# --------------------------------------------------------------------------

@router.get("/suppliers")
async def list_suppliers(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_supplier")


@router.post("/suppliers", status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    name = payload.get("name") or payload.get("company_name", "Supplier")
    return await sme_service.create_sme_entity(db, tenant_id, "sme_supplier", name, payload.get("attributes", payload))


@router.get("/purchase-orders")
async def list_purchase_orders(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_purchase_order")


@router.post("/purchase-orders", status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.record_purchase_order(db, tenant_id, payload)


@router.post("/purchase-orders/{po_id}/receive")
async def receive_purchase_order_goods(
    po_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    received = await sme_service.receive_purchase_order(db, tenant_id, po_id)
    if not received:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return received


# --------------------------------------------------------------------------
# 8. OPERATIONAL FINANCE (INVOICES & EXPENSES)
# --------------------------------------------------------------------------

@router.get("/invoices")
async def list_invoices(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_invoice")


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    inv_num = payload.get("invoice_number") or f"INV-{uuid.uuid4().hex[:6].upper()}"
    ent = await sme_service.create_sme_entity(db, tenant_id, "sme_invoice", f"Invoice {inv_num}", payload.get("attributes", payload))

    observation_service.record_observation(
        db=db,
        org_id=tenant_id,
        source_channel="sme_finance",
        observation_type="sme_invoice_created",
        primary_entity_id=ent["id"],
        payload={"invoice_number": inv_num, "total": payload.get("total_amount")},
        severity="INFO"
    )
    return ent


@router.get("/expenses")
async def list_expenses(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_expense")


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    label = payload.get("display_label") or payload.get("payee") or "Operational Expense"

    ent = await sme_service.create_sme_entity(db, tenant_id, "sme_expense", label, payload.get("attributes", payload))
    observation_service.record_observation(
        db=db,
        org_id=tenant_id,
        source_channel="sme_finance",
        observation_type="sme_expense_recorded",
        primary_entity_id=ent["id"],
        payload={"payee": label, "amount": payload.get("amount"), "category": payload.get("category")},
        severity="INFO"
    )
    return ent


# --------------------------------------------------------------------------
# 9. PROJECTS & TASKS
# --------------------------------------------------------------------------

@router.get("/projects")
async def list_projects(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_project")


@router.post("/projects", status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    name = payload.get("name") or payload.get("display_label", "Project Deliverable")

    ent = await sme_service.create_sme_entity(db, tenant_id, "sme_project", name, payload.get("attributes", payload))
    observation_service.record_observation(
        db=db,
        org_id=tenant_id,
        source_channel="sme_operations",
        observation_type="sme_project_created",
        primary_entity_id=ent["id"],
        payload={"project_name": name, "deadline": payload.get("deadline")},
        severity="INFO"
    )
    return ent


@router.get("/tasks")
async def list_tasks(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.list_sme_entities(db, tenant_id, "sme_project_task")


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    title = payload.get("title") or payload.get("display_label", "Task Item")
    return await sme_service.create_sme_entity(db, tenant_id, "sme_project_task", title, payload.get("attributes", payload))


# --------------------------------------------------------------------------
# 10. GENERIC ENTITY LIST, CREATE, UPDATE & DELETE
# --------------------------------------------------------------------------

@router.get("/entities/{code}")
async def list_entities_generic(
    code: str,
    org_id: str = Query(...),
    search: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    items = await sme_service.list_sme_entities(db, tenant_id, code, search=search, limit=limit, offset=offset)
    return {"items": items, "count": len(items)}


@router.post("/entities/{code}", status_code=status.HTTP_201_CREATED)
async def create_entity_generic(
    code: str,
    payload: Dict[str, Any],
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    target_org = org_id or payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(target_org, current_user)
    display_label = payload.get("display_label") or payload.get("name") or payload.get("title") or f"New {code}"
    attributes = payload.get("attributes", payload)

    ent = await sme_service.create_sme_entity(
        db=db,
        org_id=tenant_id,
        code=code,
        display_label=display_label,
        attributes=attributes
    )
    return ent


@router.put("/entities/{entity_id}")
async def update_sme_entity_generic(
    entity_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    org_id = payload.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(org_id, current_user)
    updated = await sme_service.update_sme_entity(
        db=db,
        org_id=tenant_id,
        entity_id=entity_id,
        display_label=payload.get("display_label"),
        attributes=payload.get("attributes")
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Entity not found")
    return updated


@router.delete("/entities/{entity_id}")
async def delete_sme_entity_generic(
    entity_id: str,
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    success = await sme_service.delete_sme_entity(db, tenant_id, entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"success": True, "message": "Entity deleted"}


# --------------------------------------------------------------------------
# 11. ARGUS INTELLIGENCE & COPILOT
# --------------------------------------------------------------------------

@router.get("/intelligence/daily-brief")
async def get_daily_business_brief(
    org_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = await _verify_tenant_access(org_id, current_user)
    return await sme_service.skill_daily_business_brief(tenant_id)


@router.post("/skills/execute")
@router.post("/skills/{skill_name}/execute")
async def execute_sme_copilot_skill(
    skill_name: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    org_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Executes any of the 16 SME database-backed ARGUS intelligence skills."""
    body = payload or {}
    raw_key = skill_name or body.get("skill_id") or body.get("skill_key") or "daily_business_brief"
    clean_key = raw_key.replace("module_sme:", "")
    target_org = org_id or body.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(target_org, current_user)

    skill_dispatch = {
        "daily_business_brief": sme_service.skill_daily_business_brief,
        "sales_pipeline_analyzer": sme_service.skill_sales_pipeline_analyzer,
        "unanswered_enquiry_detector": sme_service.skill_unanswered_enquiry_detector,
        "lead_followup_analyzer": sme_service.skill_lead_followup_analyzer,
        "customer_activity_analyzer": sme_service.skill_customer_activity_analyzer,
        "clv_estimator": sme_service.skill_customer_activity_analyzer,
        "top_customer_identifier": sme_service.skill_customer_activity_analyzer,
        "customer_churn_signal_detector": sme_service.skill_customer_churn_signal_detector,
        "churn_risk_detector": sme_service.skill_customer_churn_signal_detector,
        "inactive_customer_reengagement": sme_service.skill_customer_churn_signal_detector,
        "revenue_trend_analyzer": sme_service.skill_revenue_trend_analyzer,
        "expense_anomaly_detector": sme_service.skill_revenue_trend_analyzer,
        "outstanding_payment_analyzer": sme_service.skill_outstanding_payment_analyzer,
        "inventory_risk_analyzer": sme_service.skill_inventory_risk_analyzer,
        "fast_slow_moving_inventory": sme_service.skill_inventory_risk_analyzer,
        "supplier_performance_analyzer": sme_service.skill_supplier_performance_analyzer,
        "supplier_lead_time_performance": sme_service.skill_supplier_performance_analyzer,
        "appointment_no_show_analyzer": sme_service.skill_appointment_no_show_analyzer,
        "service_utilization_rate": sme_service.skill_appointment_no_show_analyzer,
        "staff_workload_analyzer": sme_service.skill_staff_workload_analyzer,
        "project_delay_analyzer": sme_service.skill_project_delay_analyzer,
        "business_bottleneck_detector": sme_service.skill_business_bottleneck_detector,
        "operational_bottleneck_detector": sme_service.skill_business_bottleneck_detector,
        "quote_to_order_conversion": sme_service.skill_sales_pipeline_analyzer,
        "business_signal_summary": sme_service.skill_business_signal_summary,
        "owner_attention_prioritizer": sme_service.skill_owner_attention_prioritizer
    }

    try:
        handler = skill_dispatch.get(clean_key)
        params = body.get("params", {})
        if handler:
            result = await handler(org_id=tenant_id, **params)
        else:
            from services.copilot_skill_registry import copilot_skill_registry
            full_key = f"module_sme:{clean_key}"
            result = await copilot_skill_registry.execute_skill(full_key, {"org_id": tenant_id, **params})
        return {"success": True, "skill_key": f"module_sme:{clean_key}", "result": result}
    except Exception as e:
        logger.error(f"Error executing SME skill '{clean_key}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------------------------------------------------
# 12. STARTER WORKFLOWS
# --------------------------------------------------------------------------

@router.get("/workflows/templates")
async def list_starter_workflow_templates():
    return sme_service.get_starter_workflow_templates()


@router.post("/workflows/deploy-starter")
@router.post("/workflows/deploy")
async def deploy_starter_workflows(
    payload: Optional[Dict[str, Any]] = None,
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    body = payload or {}
    target_org = org_id or body.get("org_id") or current_user.get("business_id")
    tenant_id = await _verify_tenant_access(target_org, current_user)
    deployed_ids = await sme_service.deploy_starter_workflows(db, tenant_id)
    return {"success": True, "deployed_count": len(deployed_ids), "workflow_ids": deployed_ids}


# --------------------------------------------------------------------------
# 13. REAL DATABASE-BACKED REPORTS
# --------------------------------------------------------------------------

@router.get("/reports/{report_type}")
async def get_sme_report(
    report_type: str,
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Returns database-backed analytical reports for real tenant metrics."""
    tenant_id = await _verify_tenant_access(org_id, current_user)

    if report_type == "sales":
        orders = await sme_service.list_sme_entities(db, tenant_id, "sme_order", limit=200)
        return {
            "report": "sales",
            "total_orders": len(orders),
            "orders": orders
        }
    elif report_type == "inventory":
        products = await sme_service.list_sme_entities(db, tenant_id, "sme_product", limit=200)
        movements = await sme_service.list_sme_entities(db, tenant_id, "sme_inventory_movement", limit=50)
        return {
            "report": "inventory",
            "products": products,
            "recent_movements": movements
        }
    elif report_type == "appointments":
        apts = await sme_service.list_sme_entities(db, tenant_id, "sme_appointment", limit=200)
        return {
            "report": "appointments",
            "total_appointments": len(apts),
            "appointments": apts
        }
    elif report_type == "finance":
        invoices = await sme_service.list_sme_entities(db, tenant_id, "sme_invoice", limit=200)
        expenses = await sme_service.list_sme_entities(db, tenant_id, "sme_expense", limit=200)
        return {
            "report": "finance",
            "invoices": invoices,
            "expenses": expenses
        }
    elif report_type == "signals":
        stmt = select(ObservationV2).where(ObservationV2.org_id == tenant_id).order_by(desc(ObservationV2.created_at)).limit(50)
        res = await db.execute(stmt)
        obs = res.scalars().all()
        return {
            "report": "signals",
            "signals": [
                {
                    "id": o.id,
                    "type": o.observation_type,
                    "channel": o.source_channel,
                    "severity": o.severity,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                    "payload": o.payload
                }
                for o in obs
            ]
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported report type '{report_type}'")
