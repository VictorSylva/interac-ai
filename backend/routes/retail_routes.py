"""
InteracAI Enterprise Retail & Supermarket REST Operations Router.
Manages all retail subsystems (POS, Inventory, CRM, Suppliers, Finance, HR, CCTV) using the Dynamic Entity System.
Integrates signals with the Observation Bus and triggers automated workflows.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, List, Optional
import uuid
import logging
import random
from datetime import datetime

from database.session import get_db
from database.models.dynamic_entity import EntityType, EntityV2
from database.models.observation import ObservationV2
from services.observation_service import observation_service
from services.workflow_engine import workflow_engine
from services.auth_service import require_permission, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/retail", tags=["Retail Operations"])

def _entity_to_dict(e: EntityV2) -> Dict[str, Any]:
    return {
        "id": e.id,
        "org_id": e.org_id,
        "entity_type_id": e.entity_type_id,
        "external_ref_id": e.external_ref_id,
        "display_label": e.display_label,
        "attributes": e.attributes or {},
        "risk_score": e.risk_score,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }

async def _get_entity_type_id(db: AsyncSession, org_id: str, code: str) -> str:
    """Helper to resolve EntityType ID from its string code."""
    stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == code)
    res = await db.execute(stmt)
    et = res.scalar_one_or_none()
    if not et:
        et = EntityType(
            id=f"et_{uuid.uuid4().hex[:12]}",
            org_id=org_id,
            module_id="module_retail",
            code=code,
            display_name=code.replace("_", " ").title(),
            schema_definition={}
        )
        db.add(et)
        await db.commit()
        await db.refresh(et)
    return et.id

# --- 1. STORES & BRANCHES ---

@router.get("/stores")
async def list_stores(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.stores.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "branch_store")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    stores = res.scalars().all()
    
    # Return mock defaults if database table is empty for default_business
    if not stores and org_id == "default_business":
        return [
            {
                "id": "branch_ikeja",
                "org_id": org_id,
                "display_label": "Ikeja Main Supermarket",
                "attributes": {
                    "manager": "Adebola Williams",
                    "region": "Lagos Mainland",
                    "hours": "8:00 AM - 10:00 PM",
                    "zones": ["Aisle 1-12", "Fresh Produce", "Liquor Cabinet", "Warehouse Depot A"],
                    "floormap_url": "https://api.dicebear.com/7.x/identicon/svg?seed=ikeja_floor",
                    "refrigerator_temp": 4.2
                }
            },
            {
                "id": "branch_lekki",
                "org_id": org_id,
                "display_label": "Lekki Express Mall",
                "attributes": {
                    "manager": "Chinelo Ndu",
                    "region": "Lagos Island",
                    "hours": "24/7 Operational",
                    "zones": ["Aisle 1-6", "Fresh Food", "Electronics Rack", "Loading Bay B"],
                    "floormap_url": "https://api.dicebear.com/7.x/identicon/svg?seed=lekki_floor",
                    "refrigerator_temp": 3.8
                }
            }
        ]
    return [_entity_to_dict(s) for s in stores]

@router.post("/stores")
async def create_store(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.stores.create"))
):
    org_id = payload.get("org_id")
    name = payload.get("name")
    if not org_id or not name:
        raise HTTPException(status_code=400, detail="Missing org_id or name.")
        
    type_id = await _get_entity_type_id(db, org_id, "branch_store")
    new_store = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=name,
        attributes={
            "manager": payload.get("manager", "Store Supervisor"),
            "region": payload.get("region", "South West"),
            "hours": payload.get("hours", "9:00 AM - 9:00 PM"),
            "zones": payload.get("zones", ["Aisle 1-10", "Checkout", "Warehouse Depot"]),
            "floormap_url": f"https://api.dicebear.com/7.x/identicon/svg?seed={name}",
            "refrigerator_temp": 4.0
        }
    )
    db.add(new_store)
    await db.commit()
    await workflow_engine.trigger_workflow(org_id, "store_created", {"store_id": new_store.id, "name": name})
    return _entity_to_dict(new_store)


# --- 2. PRODUCTS & DIGITAL CATALOG ---

@router.get("/products")
async def list_products(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.products.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "product")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    products = res.scalars().all()
    
    if not products and org_id == "default_business":
        return [
            {
                "id": "prod_milk",
                "org_id": org_id,
                "display_label": "Dangote Premium Milk 1L",
                "attributes": {
                    "sku": "SKU-MILK-001",
                    "barcode": "6001234567890",
                    "category": "Dairies",
                    "brand": "Dangote Dairies",
                    "unit_cost": 750,
                    "selling_price": 950,
                    "variants": ["1L Regular", "500ml Pocket size"],
                    "digital_catalog_visible": True,
                    "description": "Premium whole milk enriched with Vitamin D"
                }
            },
            {
                "id": "prod_egg",
                "org_id": org_id,
                "display_label": "Grade A Farm Fresh Eggs Crate",
                "attributes": {
                    "sku": "SKU-EGG-102",
                    "barcode": "6009876543210",
                    "category": "Fresh Produce",
                    "brand": "Ondo Poultry",
                    "unit_cost": 2100,
                    "selling_price": 2800,
                    "variants": ["Crate of 30", "Crate of 15"],
                    "digital_catalog_visible": True,
                    "description": "High protein farm eggs locally gathered"
                }
            },
            {
                "id": "prod_beer",
                "org_id": org_id,
                "display_label": "Guinness Stout Bottle 330ml",
                "attributes": {
                    "sku": "SKU-BEER-409",
                    "barcode": "6001212343456",
                    "category": "Beverages",
                    "brand": "Guinness Nigeria PLC",
                    "unit_cost": 400,
                    "selling_price": 550,
                    "variants": ["330ml Glass Bottle", "500ml Can"],
                    "digital_catalog_visible": True,
                    "description": "Rich dark stout beverage"
                }
            }
        ]
    return [_entity_to_dict(p) for p in products]

@router.post("/products")
async def create_product(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.products.create"))
):
    org_id = payload.get("org_id")
    name = payload.get("name")
    sku = payload.get("sku")
    if not org_id or not name or not sku:
        raise HTTPException(status_code=400, detail="Missing required product parameters.")
        
    type_id = await _get_entity_type_id(db, org_id, "product")
    new_product = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=name,
        attributes={
            "sku": sku,
            "barcode": payload.get("barcode", f"{random.randint(1000000000000, 9999999999999)}"),
            "category": payload.get("category", "General"),
            "brand": payload.get("brand", "Generic Brand"),
            "unit_cost": float(payload.get("unit_cost", 0.0)),
            "selling_price": float(payload.get("selling_price", 0.0)),
            "variants": payload.get("variants", ["Standard"]),
            "digital_catalog_visible": payload.get("digital_catalog_visible", True),
            "description": payload.get("description", "No description provided")
        }
    )
    db.add(new_product)
    
    # Broadcast price change signal to Observation Bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="catalog",
        observation_type="price_changed",
        primary_entity_id=new_product.id,
        payload={"product_name": name, "new_price": payload.get("selling_price")},
        severity="INFO"
    )
    
    await db.commit()
    await workflow_engine.trigger_workflow(org_id, "product_created", {"product_id": new_product.id, "sku": sku, "name": name})
    return _entity_to_dict(new_product)


# --- 3. INVENTORY & WAREHOUSING ---

@router.get("/inventory")
async def list_inventory(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.inventory.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "product")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    products = res.scalars().all()
    
    # Render stock metrics based on catalog items
    items = []
    for p in products:
        sku = p.attributes.get("sku", "SKU-GEN")
        items.append({
            "product_id": p.id,
            "display_label": p.display_label,
            "sku": sku,
            "stock_level": p.attributes.get("stock_level", 45),
            "reorder_threshold": p.attributes.get("reorder_threshold", 20),
            "warehouse_allocations": {
                "Depot A": p.attributes.get("depot_a_stock", 30),
                "Depot B": p.attributes.get("depot_b_stock", 15)
            },
            "expiry_date": p.attributes.get("expiry_date", "2026-11-20"),
            "batch_number": p.attributes.get("batch_number", "B-99201"),
            "dead_stock": False
        })
        
    if not items and org_id == "default_business":
        return [
            {
                "product_id": "prod_milk",
                "display_label": "Dangote Premium Milk 1L",
                "sku": "SKU-MILK-001",
                "stock_level": 12, # Under-stocked
                "reorder_threshold": 30,
                "warehouse_allocations": {"Depot A": 8, "Depot B": 4},
                "expiry_date": "2026-08-15",
                "batch_number": "B-MK882",
                "dead_stock": False
            },
            {
                "product_id": "prod_egg",
                "display_label": "Grade A Farm Fresh Eggs Crate",
                "sku": "SKU-EGG-102",
                "stock_level": 40,
                "reorder_threshold": 15,
                "warehouse_allocations": {"Depot A": 30, "Depot B": 10},
                "expiry_date": "2026-08-25",
                "batch_number": "B-EG911",
                "dead_stock": False
            },
            {
                "product_id": "prod_beer",
                "display_label": "Guinness Stout Bottle 330ml",
                "sku": "SKU-BEER-409",
                "stock_level": 180,
                "reorder_threshold": 50,
                "warehouse_allocations": {"Depot A": 120, "Depot B": 60},
                "expiry_date": "2027-02-10",
                "batch_number": "B-GS550",
                "dead_stock": False
            }
        ]
    return items

@router.post("/inventory/adjust")
async def adjust_inventory(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.inventory.write"))
):
    org_id = payload.get("org_id")
    sku = payload.get("sku")
    adjustment = payload.get("adjustment", 0) # e.g. -5 for shrinkage, +100 for receiving
    reason = payload.get("reason", "Cycle Count Adjustment")
    
    if not org_id or not sku:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'sku'")
        
    # Trigger Inventory Adjusted Signal to Observation Bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="inventory",
        observation_type="inventory_adjusted",
        primary_entity_id=sku,
        payload={"sku": sku, "adjustment": adjustment, "reason": reason},
        severity="WARNING" if adjustment < 0 else "INFO",
        risk_impact=0.2 if adjustment < -5 else 0.0
    )
    
    await db.commit()
    await workflow_engine.trigger_workflow(org_id, "inventory_adjusted", {"sku": sku, "adjustment": adjustment, "reason": reason})
    return {"status": "success", "sku": sku, "adjustment": adjustment, "timestamp": datetime.utcnow().isoformat()}


# --- 4. POINT OF SALE (POS) & CHECKOUT ---

@router.post("/pos/sales")
async def record_pos_sale(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.pos.create"))
):
    org_id = payload.get("org_id")
    lane = payload.get("lane_number", "Lane 1")
    cashier = payload.get("cashier_name", "Staff Cashier")
    total_amount = float(payload.get("total_amount", 0.0))
    items = payload.get("items", [])
    payment_method = payload.get("payment_method", "Cash")
    
    if not org_id or not items:
        raise HTTPException(status_code=400, detail="Missing required transaction parameters.")
        
    transaction_id = f"POS-TX-{random.randint(100000, 999999)}"
    
    # Broadcast Sale Completed Signal to Observation Bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="pos",
        observation_type="sale_completed",
        primary_entity_id=transaction_id,
        payload={
            "transaction_id": transaction_id,
            "lane": lane,
            "cashier": cashier,
            "total_amount": total_amount,
            "items_count": len(items),
            "items": items,
            "payment_method": payment_method
        },
        severity="INFO"
    )
    
    # Check for large void counts or cash discrepancies to simulate sweet-hearting/fraud
    if payload.get("simulated_skip"):
        observation_service.record_observation(
            db=db,
            org_id=org_id,
            source_channel="cctv_yolo",
            observation_type="cctv_sweethearting_detected",
            primary_entity_id=transaction_id,
            location_label=f"Checkout Lane {lane}",
            payload={"cashier": cashier, "item_skipped": payload.get("simulated_skip"), "confidence": 0.88},
            severity="CRITICAL",
            confidence=0.88,
            risk_impact=0.8
        )
        
    await db.commit()
    await workflow_engine.trigger_workflow(org_id, "sale_completed", {
        "transaction_id": transaction_id,
        "lane": lane,
        "cashier": cashier,
        "total_amount": total_amount,
        "payment_method": payment_method
    })
    return {"status": "success", "transaction_id": transaction_id, "receipt_url": f"/receipts/{transaction_id}"}


@router.post("/pos/refund")
async def refund_pos_sale(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Process a refund for a previously completed POS sale, restoring inventory stock."""
    org_id = payload.get("org_id")
    transaction_id = payload.get("transaction_id")
    items = payload.get("items", [])
    
    if not org_id or not transaction_id or not items:
        raise HTTPException(status_code=400, detail="Missing refund parameters.")
        
    prod_type_id = await _get_entity_type_id(db, org_id, "product")
    refunded_items_details = []
    total_refund_amount = 0.0
    
    for item in items:
        sku = item.get("sku")
        qty = int(item.get("quantity", 0))
        if not sku or qty <= 0:
            continue
            
        stmt = select(EntityV2).where(
            EntityV2.org_id == org_id,
            EntityV2.entity_type_id == prod_type_id
        )
        res = await db.execute(stmt)
        products = res.scalars().all()
        
        target_prod = None
        for p in products:
            if p.attributes.get("sku") == sku:
                target_prod = p
                break
                
        if target_prod:
            attrs = dict(target_prod.attributes or {})
            current_qty = int(attrs.get("quantity", 0))
            price = float(attrs.get("price", 0.0))
            
            attrs["quantity"] = current_qty + qty
            target_prod.attributes = attrs
            
            refunded_items_details.append({"sku": sku, "quantity": qty, "price": price})
            total_refund_amount += price * qty
            
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="pos",
        observation_type="sale_refunded",
        primary_entity_id=transaction_id,
        payload={
            "transaction_id": transaction_id,
            "refunded_items": refunded_items_details,
            "total_refund_amount": total_refund_amount
        },
        severity="INFO"
    )
    
    await db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Refund of ₦{total_refund_amount:,.2f} processed. Inventory stock restored.",
        "transaction_id": transaction_id,
        "refund_details": refunded_items_details
    }


# --- 5. CUSTOMERS & CRM ---

@router.get("/customers")
async def list_customers(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.customers.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "customer_loyalty")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    customers = res.scalars().all()
    
    if not customers and org_id == "default_business":
        return [
            {
                "id": "cust_olumide",
                "org_id": org_id,
                "display_label": "Olumide Awosika",
                "attributes": {
                    "loyalty_id": "LOY-4401",
                    "email": "olumide.awosika@gmail.com",
                    "phone": "08031234567",
                    "loyalty_points": 1450,
                    "membership_tier": "Gold",
                    "churn_risk": "Low",
                    "preferred_categories": ["Spirits", "Groceries"],
                    "recent_purchases_count": 18
                }
            },
            {
                "id": "cust_chioma",
                "org_id": org_id,
                "display_label": "Chioma Nze",
                "attributes": {
                    "loyalty_id": "LOY-3102",
                    "email": "chioma.nze@yahoo.com",
                    "phone": "08098765432",
                    "loyalty_points": 3400,
                    "membership_tier": "Platinum",
                    "churn_risk": "High",
                    "preferred_categories": ["Dairies", "Cosmetics"],
                    "recent_purchases_count": 32
                }
            }
        ]
    return [_entity_to_dict(c) for c in customers]


# --- 6. PROCUREMENT & SUPPLIERS ---

@router.get("/suppliers")
async def list_suppliers(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.procurement.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "supplier")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    suppliers = res.scalars().all()
    
    if not suppliers and org_id == "default_business":
        return [
            {
                "id": "sup_dangote",
                "org_id": org_id,
                "display_label": "Dangote Dairies",
                "attributes": {
                    "code": "SUPP-DANG",
                    "contact_person": "Alhaji Musa Dangote",
                    "email": "procurement@dangotedairies.com",
                    "lead_time_days": 2,
                    "quality_score": 96,
                    "delivery_accuracy": 98,
                    "vendor_scorecard_rating": "A+"
                }
            },
            {
                "id": "sup_guinness",
                "org_id": org_id,
                "display_label": "Guinness Nigeria PLC",
                "attributes": {
                    "code": "SUPP-GUIN",
                    "contact_person": "Rita Johnson",
                    "email": "orders@guinness-nigeria.com",
                    "lead_time_days": 4,
                    "quality_score": 92,
                    "delivery_accuracy": 89,
                    "vendor_scorecard_rating": "B"
                }
            }
        ]
    return [_entity_to_dict(s) for s in suppliers]


# --- 7. FINANCE & PROFIT MARGINS ---

@router.get("/finance/analytics")
async def get_finance_analytics(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.finance.read"))
):
    # 1. Fetch all products to resolve costs and categories
    prod_type_id = await _get_entity_type_id(db, org_id, "product")
    prod_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == prod_type_id)
    prod_res = await db.execute(prod_stmt)
    products = prod_res.scalars().all()
    
    prod_cost_map = {}
    prod_category_map = {}
    for p in products:
        sku = p.attributes.get("sku")
        if sku:
            prod_cost_map[sku] = float(p.attributes.get("unit_cost", 0.0))
            prod_category_map[sku] = p.attributes.get("category", "General")
            
    # 2. Iterate POS sale observations
    stmt = select(ObservationV2).where(
        ObservationV2.org_id == org_id,
        ObservationV2.observation_type == "sale_completed"
    )
    res = await db.execute(stmt)
    observations = res.scalars().all()
    
    revenue_today = 0.0
    total_cost = 0.0
    cash_balance = 0.0
    terminal_balances = {}
    category_revenue = {}
    category_profit = {}
    
    for obs in observations:
        payload = obs.payload or {}
        amount = float(payload.get("total_amount", 0.0))
        revenue_today += amount
        
        method = payload.get("payment_method", "Cash")
        if method == "Cash":
            cash_balance += amount
            
        lane = payload.get("lane", "Lane 1")
        terminal_balances[lane] = terminal_balances.get(lane, 0.0) + amount
        
        obs_items = payload.get("items", [])
        for item in obs_items:
            sku = item.get("sku")
            qty = float(item.get("quantity", 1.0))
            price = float(item.get("price", 0.0))
            
            unit_cost = prod_cost_map.get(sku, 0.0)
            item_cost = unit_cost * qty
            total_cost += item_cost
            
            cat = prod_category_map.get(sku, "General")
            item_revenue = price * qty
            category_revenue[cat] = category_revenue.get(cat, 0.0) + item_revenue
            category_profit[cat] = category_profit.get(cat, 0.0) + (item_revenue - item_cost)
            
    net_profit_today = max(0.0, revenue_today - total_cost)
    margins_pct = (net_profit_today / revenue_today * 100.0) if revenue_today > 0 else 0.0
    
    category_performance = []
    for cat in category_revenue:
        category_performance.append({
            "category": cat,
            "revenue": category_revenue[cat],
            "profit": category_profit.get(cat, 0.0)
        })
        
    return {
        "revenue_today": revenue_today,
        "margins_pct": round(margins_pct, 1),
        "net_profit_today": net_profit_today,
        "cash_balance": cash_balance,
        "terminal_balances": terminal_balances,
        "category_performance": category_performance,
        "branch_revenue_share": {
            "Ikeja Main": revenue_today
        }
    }


# --- 8. HR & SHIFT ATTENDANCE ---

@router.get("/hr/attendance")
async def list_attendance(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.hr.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "employee_shift")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    shifts = res.scalars().all()
    
    if not shifts and org_id == "default_business":
        return [
            {
                "id": "shift_01",
                "org_id": org_id,
                "display_label": "Blessing Okon (Morning)",
                "attributes": {
                    "employee_name": "Blessing Okon",
                    "role": "Cashier",
                    "date": "2026-08-04",
                    "clock_in": "07:54 AM",
                    "clock_out": "01:30 PM",
                    "status": "Completed"
                }
            },
            {
                "id": "shift_02",
                "org_id": org_id,
                "display_label": "Blessing Okon (Evening)",
                "attributes": {
                    "employee_name": "Abigail Udoh",
                    "role": "Cashier",
                    "date": "2026-08-04",
                    "clock_in": "01:25 PM",
                    "clock_out": "09:30 PM",
                    "status": "Active"
                }
            }
        ]
    return [_entity_to_dict(s) for s in shifts]

@router.post("/hr/attendance/punch")
async def register_attendance_punch(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.hr.write"))
):
    org_id = payload.get("org_id")
    employee = payload.get("employee_name")
    action = payload.get("action") # IN | OUT
    
    if not org_id or not employee:
        raise HTTPException(status_code=400, detail="Missing required parameters.")
        
    # Log punch observation to observation bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="hr",
        observation_type="employee_clocked_in" if action == "IN" else "employee_clocked_out",
        primary_entity_id=employee,
        payload={"employee": employee, "time": datetime.utcnow().isoformat()},
        severity="INFO"
    )
    
    await db.commit()
    await workflow_engine.trigger_workflow(org_id, "employee_punch", {"employee": employee, "action": action})
    return {"status": "success", "employee": employee, "action": action, "timestamp": datetime.utcnow().isoformat()}


# --- 9. MAINTENANCE ---

@router.get("/maintenance")
async def list_maintenance(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("retail.maintenance.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "maintenance_job")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    jobs = res.scalars().all()
    
    if not jobs and org_id == "default_business":
        return [
            {
                "id": "job_ref",
                "org_id": org_id,
                "display_label": "Supermarket Refrigerator A Maintenance",
                "attributes": {
                    "asset": "Produce Aisle Refrigerator #1",
                    "reported_by": "Branch Supervisor",
                    "issue": "Compressor failing to maintain <4°C target temperature",
                    "status": "Scheduled",
                    "severity": "High",
                    "created_at": "2026-08-03T11:00:00"
                }
            },
            {
                "id": "job_pos",
                "org_id": org_id,
                "display_label": "Lane 4 POS Receipt Printer Repair",
                "attributes": {
                    "asset": "POS Printer Lane 4",
                    "reported_by": "Abigail Udoh",
                    "issue": "Thermal head roller jammed",
                    "status": "Resolved",
                    "severity": "Low",
                    "created_at": "2026-08-02T10:00:00"
                }
            }
        ]
    return [_entity_to_dict(j) for j in jobs]


# --- 10. E-COMMERCE SYNC ---

@router.get("/ecommerce/logs")
async def list_ecommerce_logs(
    org_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(require_permission("retail.ecommerce.read"))
):
    return [
        {"timestamp": datetime.utcnow().isoformat(), "integration": "Shopify POS", "event": "Catalog synchronization completed", "synced_items": 450, "status": "Success"},
        {"timestamp": (datetime.utcnow() - datetime.timedelta(hours=6)).isoformat(), "integration": "WooCommerce", "event": "Order webhooks processed", "synced_items": 23, "status": "Success"},
        {"timestamp": (datetime.utcnow() - datetime.timedelta(days=1)).isoformat(), "integration": "Shopify Storefront", "event": "Inventory stock reconciliation completed", "synced_items": 1420, "status": "Success"}
    ]


# --- 11. SECURITY & CCTV LIVE ALERTS ---

@router.get("/security/alerts")
async def list_security_alerts(
    org_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(require_permission("retail.security.read"))
):
    # Simulated CCTV live feed logs
    return [
        {"id": "alert_01", "timestamp": datetime.utcnow().isoformat(), "camera": "CAM-04-Aisle4", "event": "High Loitering count detected", "severity": "WARNING", "aisle": "Aisle 4 (Liquor cabinet)", "confidence": 0.82, "status": "Active"},
        {"id": "alert_02", "timestamp": (datetime.utcnow() - datetime.timedelta(minutes=30)).isoformat(), "camera": "CAM-01-Entrance", "event": "VIP Customer recognized", "severity": "INFO", "customer": "Chioma Nze (Platinum Level)", "confidence": 0.96, "status": "Logged"},
        {"id": "alert_03", "timestamp": (datetime.utcnow() - datetime.timedelta(hours=2)).isoformat(), "camera": "CAM-09-Checkout2", "event": "POS Sweethearting exception scanner mismatch", "severity": "CRITICAL", "cashier": "Abigail Udoh", "confidence": 0.88, "status": "Escalated to Store Manager"}
    ]

@router.post("/security/simulate-signal")
async def simulate_security_signal(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Allows simulated trigger injection into the Observation Bus."""
    org_id = payload.get("org_id", "default_business")
    source = payload.get("source", "cctv_yolo")
    event_type = payload.get("event_type", "cctv_sweethearting_detected")
    location = payload.get("location", "Checkout Lane 2")
    details = payload.get("details", {})
    severity = payload.get("severity", "WARNING")
    confidence = float(payload.get("confidence", 0.90))
    risk_impact = float(payload.get("risk_impact", 0.5))

    obs = observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel=source,
        observation_type=event_type,
        location_label=location,
        payload=details,
        severity=severity,
        confidence=confidence,
        risk_impact=risk_impact
    )
    return {"status": "signal_emitted", "observation_id": obs.id}


@router.get("/workspace/{department}")
async def get_retail_workspace(
    department: str,
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Unified dynamic workspace endpoint returning configurations, tasks, and analytics based on department."""
    user_dept = current_user.get("department", "general").lower()
    user_role = current_user.get("role", "agent").lower()
    
    is_privileged = user_role in ["owner", "admin"] or user_dept in ["store_manager", "regional_manager"]
    if not is_privileged and user_dept != department.lower():
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: ordinary staff in department '{user_dept}' cannot view workspace '{department}'"
        )
        
    dept_clean = department.lower().strip()
    
    kpis = []
    tasks = []
    notifications = []
    workflows_list = []
    quick_actions = []
    argus_intelligence = {
        "summary": "ARGUS retail demand forecast: Weekend sales projected at 1.1x normal volume. Inventory restock recommended.",
        "recommendations": ["Reorder priority grocery SKUs", "Optimize staff allocations at Checkout Lane 1 & 2"]
    }
    
    # Live data from DB
    prod_type_id = await _get_entity_type_id(db, org_id, "product")
    prod_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == prod_type_id)
    prod_res = await db.execute(prod_stmt)
    products = prod_res.scalars().all()
    
    low_stock_count = sum(1 for p in products if int(p.attributes.get("quantity", 0)) <= int(p.attributes.get("min_alert_stock", 10)))
    total_skus = len(products)
    
    if dept_clean in ["cashier", "pos"]:
        kpis = [
            {"label": "Active Checkout Lanes", "value": "Lane 1, Lane 2", "status": "success"},
            {"label": "Shortage Alert SKUs", "value": str(low_stock_count), "status": "warning" if low_stock_count > 0 else "success"}
        ]
        quick_actions = [
            {"label": "Record POS Checkout", "method": "POST", "url": "/api/v1/retail/pos/sale"},
            {"label": "Process Transaction Refund", "method": "POST", "url": "/api/v1/retail/pos/refund"}
        ]
        
    elif dept_clean in ["inventory", "warehouse", "receiving"]:
        kpis = [
            {"label": "Total Active SKUs", "value": str(total_skus), "status": "info"},
            {"label": "Out of Stock Warnings", "value": str(low_stock_count), "status": "danger" if low_stock_count > 0 else "success"}
        ]
        
        # Pull low stock products
        tasks = [
            {"id": p.id, "label": f"{p.display_label} - Qty: {p.attributes.get('quantity', 0)}", "status": "REORDER REQUIRED"}
            for p in products if int(p.attributes.get("quantity", 0)) <= int(p.attributes.get("min_alert_stock", 10))
        ]
        
        quick_actions = [
            {"label": "Record Physical Cycle Count", "method": "POST", "url": "/api/v1/retail/inventory/cycle-count"}
        ]
        
    elif dept_clean in ["procurement"]:
        po_type_id = await _get_entity_type_id(db, org_id, "purchase_order")
        po_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == po_type_id)
        po_res = await db.execute(po_stmt)
        purchase_orders = po_res.scalars().all()
        
        kpis = [{"label": "Pending Purchase Orders", "value": str(len(purchase_orders)), "status": "warning"}]
        tasks = [{"id": po.id, "label": po.display_label, "status": po.attributes.get("status", "PENDING")} for po in purchase_orders]
        
        quick_actions = [
            {"label": "Submit Purchase Order", "method": "POST", "url": "/api/v1/retail/procurement/order"}
        ]
        
    else: # GM, Owner, Finance, Marketing, Security
        # Fetch total daily sales from observations
        obs_stmt = select(ObservationV2).where(
            ObservationV2.org_id == org_id,
            ObservationV2.observation_type == "pos_sale_recorded"
        )
        obs_res = await db.execute(obs_stmt)
        sales_logs = obs_res.scalars().all()
        
        daily_sales = sum(float(log.payload.get("total_amount", 0.0)) for log in sales_logs)
        kpis = [
            {"label": "Consolidated Daily POS Sales", "value": f"₦{daily_sales:,.2f}", "status": "success"},
            {"label": "Total Active Branches", "value": "1", "status": "info"}
        ]
        
    return {
        "department": dept_clean,
        "kpis": kpis,
        "tasks": tasks,
        "notifications": notifications,
        "workflows": workflows_list,
        "quick_actions": quick_actions,
        "reports": [{"name": f"{dept_clean.capitalize()} Branch Report", "url": f"/reports/retail/{dept_clean}"}],
        "argus_intelligence": argus_intelligence
    }


@router.post("/integrations/shopify")
async def shopify_orders_connector(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Processes incoming Shopify order webhooks. Automatically decrements EAV inventory counts."""
    org_id = payload.get("org_id")
    order_id = payload.get("id")
    line_items = payload.get("line_items", [])
    
    if not org_id or not order_id:
        raise HTTPException(status_code=400, detail="Missing required Shopify sync identifiers.")
        
    prod_type_id = await _get_entity_type_id(db, org_id, "product")
    synced_items_count = 0
    total_sales = 0.0
    
    for item in line_items:
        sku = item.get("sku")
        qty = int(item.get("quantity", 1))
        price = float(item.get("price", 0.0))
        
        if not sku:
            continue
            
        # Locate product
        stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == prod_type_id)
        res = await db.execute(stmt)
        products = res.scalars().all()
        
        target_prod = None
        for p in products:
            if p.attributes.get("sku") == sku:
                target_prod = p
                break
                
        if target_prod:
            attrs = dict(target_prod.attributes or {})
            curr_qty = int(attrs.get("quantity", 0))
            attrs["quantity"] = max(0, curr_qty - qty)
            target_prod.attributes = attrs
            
            synced_items_count += qty
            total_sales += price * qty
            
    # Record POS checkout observation
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="shopify_connector",
        observation_type="pos_sale_recorded",
        location_label="Shopify Cloud Integration Sync",
        payload={"order_id": order_id, "total_amount": total_sales, "items_count": synced_items_count},
        severity="INFO"
    )
    
    await db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Shopify Order {order_id} synced. Decremented {synced_items_count} inventory units, total sale: ₦{total_sales:,.2f}."
    }


@router.post("/integrations/square")
async def square_transactions_connector(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Processes incoming Square POS order webhook events and records observations."""
    org_id = payload.get("org_id")
    event_data = payload.get("data", {})
    object_data = event_data.get("object", {})
    payment = object_data.get("payment", {})
    
    transaction_id = payment.get("id")
    total_amount = float(payment.get("amount_money", {}).get("amount", 0.0)) / 100.0 # Square uses cents
    
    if not org_id or not transaction_id:
        raise HTTPException(status_code=400, detail="Missing required Square payment identifiers.")
        
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="square_connector",
        observation_type="pos_sale_recorded",
        location_label="Square POS Hardware Terminal Sync",
        payload={"transaction_id": transaction_id, "total_amount": total_amount, "status": "COMPLETED"},
        severity="INFO"
    )
    
    await db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Square transaction {transaction_id} recorded. Consolidated ₦{total_amount:,.2f} in sales."
    }
