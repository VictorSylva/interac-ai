"""
InteracAI General SME & Entrepreneurship Domain Service.
Provides comprehensive business logic for multi-model SME operations:
- Configuration & Capabilities (Product, Service, Hybrid)
- Dynamic Entity CRUD & Integrity Handlers
- Unified Sales Journey & Order Lifecycle
- Automatic Inventory Decrement & Stock Movements
- Scheduling, Appointments & No-Show Tracking
- Procurement & Supplier Relationship Management
- Operational Finance (Invoices, Expenses, Cash-Flow, Nigerian Payment Modes)
- Projects, Tasks & Staff Workload Allocation
- Canonical Observation Emission & ARGUS Graph Edge Generation
- 16 Real Database-Backed ARGUS Intelligence Skills
- Unified Owner Attention Engine
- 15 Pre-Built Workflow Templates Generator
- Realistic Demo Seed Fixtures (Beauty, Consulting, Fashion, Printing, Cleaning)
"""

import logging
import uuid
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy import select, update, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from database.session import AsyncSessionLocal
from database.models.dynamic_entity import EntityType, EntityV2
from database.models.observation import ObservationV2
from database.models.general import BusinessSettings, User
from database.models.crm import Lead, LeadActivity, Ticket
from database.models.chat import Conversation, Message
from database.models.sales import Order as CoreOrder
from services.observation_service import observation_service
from services.db_service import resolve_business_id

logger = logging.getLogger(__name__)

# Standard Default SME Capabilities
DEFAULT_SME_CAPABILITIES = {
    "APPOINTMENTS": True,
    "INVENTORY": True,
    "PROJECTS": True,
    "DELIVERY": True,
    "SUBSCRIPTIONS": False,
    "RECURRING_SERVICES": False,
    "MULTI_LOCATION": False,
    "ONLINE_SALES": True
}

# 5 Realistic Industry Presets
SME_PRESETS = {
    "beauty": {
        "name": "Glow & Grace Wellness & Beauty Studio",
        "industry": "Beauty, Cosmetics & Wellness",
        "business_model": "HYBRID",
        "capabilities": {
            "APPOINTMENTS": True,
            "INVENTORY": True,
            "PROJECTS": False,
            "DELIVERY": True,
            "SUBSCRIPTIONS": True,
            "RECURRING_SERVICES": True,
            "MULTI_LOCATION": False,
            "ONLINE_SALES": True
        },
        "description": "Premium salon & spa offering professional hair treatments, facials, massage therapy, and organic skincare retail products.",
        "currency": "NGN"
    },
    "consulting": {
        "name": "Apex Advisory & Growth Partners",
        "industry": "Consulting & Professional Services",
        "business_model": "SERVICE",
        "capabilities": {
            "APPOINTMENTS": True,
            "INVENTORY": False,
            "PROJECTS": True,
            "DELIVERY": False,
            "SUBSCRIPTIONS": True,
            "RECURRING_SERVICES": True,
            "MULTI_LOCATION": False,
            "ONLINE_SALES": False
        },
        "description": "Management and strategy consultancy delivering executive advisory, business transformations, and corporate training.",
        "currency": "NGN"
    },
    "fashion": {
        "name": "Kulture Threadworks",
        "industry": "Fashion, Apparel & Luxury Retail",
        "business_model": "PRODUCT",
        "capabilities": {
            "APPOINTMENTS": False,
            "INVENTORY": True,
            "PROJECTS": False,
            "DELIVERY": True,
            "SUBSCRIPTIONS": False,
            "RECURRING_SERVICES": False,
            "MULTI_LOCATION": True,
            "ONLINE_SALES": True
        },
        "description": "Boutique fashion brand creating contemporary African streetwear, bespoke tailoring, and footwear.",
        "currency": "NGN"
    },
    "printing": {
        "name": "Impression Hub Creative Production",
        "industry": "Printing, Packaging & Creative Production",
        "business_model": "HYBRID",
        "capabilities": {
            "APPOINTMENTS": False,
            "INVENTORY": True,
            "PROJECTS": True,
            "DELIVERY": True,
            "SUBSCRIPTIONS": False,
            "RECURRING_SERVICES": False,
            "MULTI_LOCATION": False,
            "ONLINE_SALES": True
        },
        "description": "Commercial print shop and brand merchandise workshop producing bespoke packaging, corporate stationery, and large-format signage.",
        "currency": "NGN"
    },
    "cleaning": {
        "name": "SparkleClean Facility & Home Care",
        "industry": "Cleaning & Environmental Services",
        "business_model": "SERVICE",
        "capabilities": {
            "APPOINTMENTS": True,
            "INVENTORY": True,
            "PROJECTS": True,
            "DELIVERY": False,
            "SUBSCRIPTIONS": True,
            "RECURRING_SERVICES": True,
            "MULTI_LOCATION": False,
            "ONLINE_SALES": False
        },
        "description": "Professional residential and commercial janitorial cleaning, fumigation, and post-construction deep cleaning service.",
        "currency": "NGN"
    },
    "general_trade": {
        "name": "Apex Merchants & Trade Distribution",
        "industry": "General Trade, Wholesale & Distribution",
        "business_model": "HYBRID",
        "capabilities": {
            "APPOINTMENTS": False,
            "INVENTORY": True,
            "PROJECTS": False,
            "DELIVERY": True,
            "SUBSCRIPTIONS": False,
            "RECURRING_SERVICES": False,
            "MULTI_LOCATION": True,
            "ONLINE_SALES": True
        },
        "description": "Wholesale distributor and general merchant handling FMCG goods, consumer supplies, and bulk commodity trading.",
        "currency": "NGN"
    }
}


class SMEService:
    """
    Central orchestration service for the General SME & Entrepreneurship Module.
    """

    # --------------------------------------------------------------------------
    # 1. ENTITY TYPE INITIALIZATION
    # --------------------------------------------------------------------------

    async def initialize_entity_types_for_org(self, org_id: str, db: AsyncSession) -> None:
        """Ensures all standard SME entity types exist in the Dynamic Entity schema."""
        from modules.sme import SMEModule
        sme_manifest = SMEModule().manifest

        for spec in sme_manifest.entity_types:
            stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == spec.code)
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                et = EntityType(
                    id=f"et_sme_{uuid.uuid4().hex[:12]}",
                    org_id=org_id,
                    module_id="module_sme",
                    code=spec.code,
                    display_name=spec.label,
                    description=spec.description,
                    schema_definition=spec.default_attributes or {}
                )
                db.add(et)
        await db.commit()
        logger.info(f"[SMEService] Standard SME entity types verified/created for {org_id}")

    async def _get_entity_type_id(self, db: AsyncSession, org_id: str, code: str) -> str:
        stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == code)
        res = await db.execute(stmt)
        et = res.scalar_one_or_none()
        if not et:
            et = EntityType(
                id=f"et_sme_{uuid.uuid4().hex[:12]}",
                org_id=org_id,
                module_id="module_sme",
                code=code,
                display_name=code.replace("_", " ").title(),
                description=f"Auto-provisioned SME entity type for {code}",
                schema_definition={}
            )
            db.add(et)
            await db.commit()
            await db.refresh(et)
        return et.id

    # --------------------------------------------------------------------------
    # 2. BUSINESS CONFIGURATION & PRESETS
    # --------------------------------------------------------------------------

    async def get_sme_config(self, db: AsyncSession, org_id: str) -> Dict[str, Any]:
        """Loads business model, capabilities, and settings for the SME module."""
        real_id = await resolve_business_id(org_id)
        type_id = await self._get_entity_type_id(db, real_id, "sme_config")
        stmt = select(EntityV2).where(EntityV2.org_id == real_id, EntityV2.entity_type_id == type_id)
        res = await db.execute(stmt)
        config_ent = res.scalars().first()

        if config_ent and config_ent.attributes:
            return config_ent.attributes

        # Default configuration
        default_cfg = {
            "business_model": "HYBRID",
            "capabilities": dict(DEFAULT_SME_CAPABILITIES),
            "currency": "NGN",
            "business_name": "My Business",
            "industry": "General Business",
            "preset_applied": "custom",
            "sales_stages": ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"],
            "order_stages": ["PENDING", "PROCESSING", "READY", "DISPATCHED", "DELIVERED", "COMPLETED", "CANCELLED"],
            "setup_completed": False
        }
        return default_cfg

    async def update_sme_config(self, db: AsyncSession, org_id: str, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Saves updated business model, capabilities, and stages."""
        real_id = await resolve_business_id(org_id)
        type_id = await self._get_entity_type_id(db, real_id, "sme_config")
        stmt = select(EntityV2).where(EntityV2.org_id == real_id, EntityV2.entity_type_id == type_id)
        res = await db.execute(stmt)
        config_ent = res.scalars().first()

        current_cfg = await self.get_sme_config(db, real_id)
        merged = {**current_cfg, **config_data}

        if config_ent:
            config_ent.attributes = merged
            config_ent.display_label = merged.get("business_name", "SME Config")
        else:
            config_ent = EntityV2(
                id=f"ent_sme_cfg_{uuid.uuid4().hex[:12]}",
                org_id=real_id,
                entity_type_id=type_id,
                display_label=merged.get("business_name", "SME Config"),
                attributes=merged
            )
            db.add(config_ent)

        await db.commit()
        return merged

    async def apply_preset(self, db: AsyncSession, org_id: str, preset_key: str) -> Dict[str, Any]:
        """Applies an industry preset (beauty, consulting, fashion, printing, cleaning)."""
        if preset_key not in SME_PRESETS:
            raise ValueError(f"Unknown preset '{preset_key}'. Choose from: {list(SME_PRESETS.keys())}")

        preset = SME_PRESETS[preset_key]
        real_id = await resolve_business_id(org_id)

        config_update = {
            "business_name": preset["name"],
            "industry": preset["industry"],
            "business_model": preset["business_model"],
            "capabilities": dict(preset["capabilities"]),
            "currency": preset["currency"],
            "description": preset["description"],
            "preset_applied": preset_key,
            "setup_completed": True
        }

        # Update business settings table as well if present
        stmt_settings = select(BusinessSettings).where(BusinessSettings.business_id == real_id)
        res_settings = await db.execute(stmt_settings)
        b_settings = res_settings.scalar_one_or_none()
        if b_settings:
            b_settings.industry = preset["industry"]
            b_settings.description = preset["description"]

        saved_cfg = await self.update_sme_config(db, real_id, config_update)
        return saved_cfg

    # --------------------------------------------------------------------------
    # 3. GENERIC SME ENTITY ACCESS & CRUD
    # --------------------------------------------------------------------------

    def _entity_to_dict(self, e: EntityV2) -> Dict[str, Any]:
        return {
            "id": e.id,
            "org_id": e.org_id,
            "entity_type_id": e.entity_type_id,
            "external_ref_id": e.external_ref_id,
            "display_label": e.display_label,
            "attributes": e.attributes or {},
            "risk_score": float(e.risk_score or 0.0),
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None
        }

    async def list_sme_entities(
        self,
        db: AsyncSession,
        org_id: str,
        code: str,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        real_id = await resolve_business_id(org_id)
        type_id = await self._get_entity_type_id(db, real_id, code)

        stmt = select(EntityV2).where(EntityV2.org_id == real_id, EntityV2.entity_type_id == type_id)
        if search:
            stmt = stmt.where(EntityV2.display_label.ilike(f"%{search}%"))

        stmt = stmt.order_by(desc(EntityV2.created_at)).offset(offset).limit(limit)
        res = await db.execute(stmt)
        entities = res.scalars().all()
        return [self._entity_to_dict(e) for e in entities]

    async def create_sme_entity(
        self,
        db: AsyncSession,
        org_id: str,
        code: str,
        display_label: str,
        attributes: Dict[str, Any],
        external_ref_id: Optional[str] = None
    ) -> Dict[str, Any]:
        real_id = await resolve_business_id(org_id)
        type_id = await self._get_entity_type_id(db, real_id, code)

        entity = EntityV2(
            id=f"ent_{code}_{uuid.uuid4().hex[:12]}",
            org_id=real_id,
            entity_type_id=type_id,
            external_ref_id=external_ref_id,
            display_label=display_label,
            attributes=attributes or {},
            risk_score=0.0
        )
        db.add(entity)
        await db.commit()
        await db.refresh(entity)
        return self._entity_to_dict(entity)

    async def update_sme_entity(
        self,
        db: AsyncSession,
        org_id: str,
        entity_id: str,
        display_label: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        real_id = await resolve_business_id(org_id)
        stmt = select(EntityV2).where(EntityV2.id == entity_id, EntityV2.org_id == real_id)
        res = await db.execute(stmt)
        entity = res.scalar_one_or_none()
        if not entity:
            return None

        if display_label:
            entity.display_label = display_label
        if attributes is not None:
            merged = dict(entity.attributes or {})
            merged.update(attributes)
            entity.attributes = merged

        await db.commit()
        await db.refresh(entity)
        return self._entity_to_dict(entity)

    async def delete_sme_entity(self, db: AsyncSession, org_id: str, entity_id: str) -> bool:
        real_id = await resolve_business_id(org_id)
        stmt = select(EntityV2).where(EntityV2.id == entity_id, EntityV2.org_id == real_id)
        res = await db.execute(stmt)
        entity = res.scalar_one_or_none()
        if not entity:
            return False

        await db.delete(entity)
        await db.commit()
        return True

    # --------------------------------------------------------------------------
    # 4. DOMAIN WORKFLOW: ORDERS, PAYMENTS & INVENTORY DECREMENT
    # --------------------------------------------------------------------------

    async def record_order(
        self,
        db: AsyncSession,
        org_id: str,
        order_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Creates an SME order. If payment_status is 'PAID', automatically decrements
        inventory for products, logs stock movements, and emits observations.
        """
        real_id = await resolve_business_id(org_id)
        customer_id = order_data.get("customer_id")
        customer_name = order_data.get("customer_name") or "Direct Customer"
        items = list(order_data.get("items") or [])
        if not items and (order_data.get("product_id") or order_data.get("product_name")):
            items = [{
                "product_id": order_data.get("product_id"),
                "name": order_data.get("product_name"),
                "quantity": float(order_data.get("quantity") or 1.0),
                "price": float(order_data.get("unit_price") or order_data.get("total_amount") or 0.0)
            }]

        total_amount = float(order_data.get("total_amount") or 0.0)
        payment_status = order_data.get("payment_status", "PENDING").upper()
        fulfilment_status = order_data.get("fulfilment_status", "PROCESSING").upper()
        order_number = order_data.get("order_number") or f"ORD-{datetime.utcnow().strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

        # 1. Create Order Entity
        order_dict = await self.create_sme_entity(
            db=db,
            org_id=real_id,
            code="sme_order",
            display_label=f"Order {order_number} ({customer_name})",
            attributes={
                "order_number": order_number,
                "customer_id": customer_id,
                "customer_name": customer_name,
                "items": items,
                "subtotal": float(order_data.get("subtotal") or total_amount),
                "discount": float(order_data.get("discount") or 0.0),
                "tax": float(order_data.get("tax") or 0.0),
                "total_amount": total_amount,
                "payment_status": payment_status,
                "payment_method": order_data.get("payment_method", "cash"),
                "fulfilment_status": fulfilment_status,
                "channel": order_data.get("channel", "direct"),
                "notes": order_data.get("notes")
            },
            external_ref_id=order_number
        )

        # 2. Emit Order Created Signal
        observation_service.record_observation(
            db=db,
            org_id=real_id,
            source_channel=order_data.get("channel", "sme_pos"),
            observation_type="sme_order_created",
            primary_entity_id=order_dict["id"],
            location_label=order_data.get("location", "Main Store"),
            payload={
                "order_number": order_number,
                "customer_name": customer_name,
                "total_amount": total_amount,
                "item_count": len(items),
                "payment_status": payment_status
            },
            severity="INFO"
        )

        # 3. If PAID, process stock deductions and emit order paid signal
        if payment_status == "PAID":
            await self._process_order_paid_effects(db, real_id, order_dict)

        # 4. Mirror into platform-wide sales_orders table
        try:
            from database.models.sales import Order
            core_order = Order(
                business_id=real_id,
                amount=total_amount,
                currency=order_data.get("currency", "NGN"),
                status="paid" if payment_status == "PAID" else "pending",
                payment_mode="live" if payment_status == "PAID" else "test",
                customer_email=order_data.get("customer_email") or customer_name,
                customer_phone=order_data.get("customer_phone")
            )
            db.add(core_order)
            await db.commit()
        except Exception as ord_err:
            logger.warning(f"[SMEService] Could not mirror order to sales_orders: {ord_err}")

        return order_dict

    create_order = record_order

    async def update_order_status(
        self,
        db: AsyncSession,
        org_id: str,
        order_id: str,
        payment_status: Optional[str] = None,
        fulfilment_status: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        real_id = await resolve_business_id(org_id)
        stmt = select(EntityV2).where(EntityV2.id == order_id, EntityV2.org_id == real_id)
        res = await db.execute(stmt)
        order = res.scalar_one_or_none()
        if not order:
            return None

        attrs = dict(order.attributes or {})
        prev_payment = attrs.get("payment_status")

        if payment_status:
            attrs["payment_status"] = payment_status.upper()
        if fulfilment_status:
            attrs["fulfilment_status"] = fulfilment_status.upper()

        order.attributes = attrs
        await db.commit()
        await db.refresh(order)
        order_dict = self._entity_to_dict(order)

        # Trigger effects if payment just flipped to PAID
        if payment_status and payment_status.upper() == "PAID" and prev_payment != "PAID":
            await self._process_order_paid_effects(db, real_id, order_dict)

        if fulfilment_status and fulfilment_status.upper() == "COMPLETED":
            observation_service.record_observation(
                db=db,
                org_id=real_id,
                source_channel="sme_operations",
                observation_type="sme_order_completed",
                primary_entity_id=order_id,
                payload={"order_number": attrs.get("order_number"), "fulfilment_status": "COMPLETED"},
                severity="INFO"
            )

        return order_dict

    async def _process_order_paid_effects(
        self,
        db: AsyncSession,
        org_id: str,
        order_dict: Dict[str, Any]
    ) -> None:
        """Handles inventory decrements, stock alerts, and customer spend updates."""
        order_id = order_dict["id"]
        attrs = order_dict.get("attributes", {})
        items = attrs.get("items", [])
        customer_id = attrs.get("customer_id")
        total_amount = float(attrs.get("total_amount") or 0.0)

        # Emit Order Paid Signal
        observation_service.record_observation(
            db=db,
            org_id=org_id,
            source_channel="sme_finance",
            observation_type="sme_order_paid",
            primary_entity_id=order_id,
            payload={
                "order_number": attrs.get("order_number"),
                "total_amount": total_amount,
                "payment_method": attrs.get("payment_method")
            },
            severity="INFO",
            risk_impact=-2.0
        )

        # Update Customer Total Spend
        if customer_id:
            c_stmt = select(EntityV2).where(EntityV2.id == customer_id, EntityV2.org_id == org_id)
            c_res = await db.execute(c_stmt)
            customer = c_res.scalar_one_or_none()
            if customer:
                c_attrs = dict(customer.attributes or {})
                c_attrs["total_spend"] = float(c_attrs.get("total_spend") or 0.0) + total_amount
                c_attrs["last_interaction_at"] = datetime.utcnow().isoformat()
                customer.attributes = c_attrs

        # Deduct product inventories
        for item in items:
            product_id = item.get("product_id") or item.get("id")
            qty = float(item.get("quantity") or 1.0)

            # Fallback: if product_id is missing, search by name or display_label
            if not product_id:
                p_name = item.get("name") or item.get("product_name") or attrs.get("product_name")
                if p_name:
                    p_type_id = await self._get_entity_type_id(db, org_id, "sme_product")
                    stmt_match = select(EntityV2).where(
                        EntityV2.org_id == org_id,
                        EntityV2.entity_type_id == p_type_id,
                        func.lower(EntityV2.display_label) == func.lower(str(p_name).strip())
                    )
                    res_match = await db.execute(stmt_match)
                    matched_p = res_match.scalars().first()
                    if matched_p:
                        product_id = matched_p.id

            if not product_id:
                logger.warning(f"[SMEService] Cannot deduct stock for item without product_id or matching name: {item}")
                continue

            p_stmt = select(EntityV2).where(EntityV2.id == product_id, EntityV2.org_id == org_id)
            p_res = await db.execute(p_stmt)
            product = p_res.scalar_one_or_none()
            if product:
                p_attrs = dict(product.attributes or {})
                curr_stock = float(p_attrs.get("current_stock") or 0.0)
                reorder_threshold = float(p_attrs.get("reorder_threshold") or 5.0)
                new_stock = max(0.0, curr_stock - qty)
                p_attrs["current_stock"] = new_stock
                product.attributes = p_attrs

                # Explicit SQL UPDATE to ensure column persistence across asyncpg sessions
                await db.execute(
                    update(EntityV2)
                    .where(EntityV2.id == product.id)
                    .values(attributes=p_attrs, updated_at=datetime.utcnow())
                )
                await db.commit()

                logger.info(f"[SMEService] Auto-deducted {qty} units of '{product.display_label}' (Stock: {curr_stock} -> {new_stock})")

                # Record stock movement ledger
                await self.create_sme_entity(
                    db=db,
                    org_id=org_id,
                    code="sme_inventory_movement",
                    display_label=f"Sale Deduction: -{qty} {product.display_label}",
                    attributes={
                        "product_id": product.id,
                        "product_name": product.display_label,
                        "movement_type": "SALE_DEDUCTION",
                        "quantity": -qty,
                        "reference_order_id": order_id,
                        "stock_after": new_stock
                    }
                )

                # Check if stock dropped below threshold
                if new_stock <= 0:
                    observation_service.record_observation(
                        db=db,
                        org_id=org_id,
                        source_channel="sme_inventory",
                        observation_type="sme_stock_out",
                        primary_entity_id=product.id,
                        payload={
                            "product_name": product.display_label,
                            "sku": p_attrs.get("sku"),
                            "current_stock": 0
                        },
                        severity="CRITICAL",
                        risk_impact=10.0
                    )
                elif new_stock <= reorder_threshold:
                    observation_service.record_observation(
                        db=db,
                        org_id=org_id,
                        source_channel="sme_inventory",
                        observation_type="sme_stock_low",
                        primary_entity_id=product.id,
                        payload={
                            "product_name": product.display_label,
                            "sku": p_attrs.get("sku"),
                            "current_stock": new_stock,
                            "reorder_threshold": reorder_threshold
                        },
                        severity="WARNING",
                        risk_impact=5.0
                    )

        await db.commit()

    # --------------------------------------------------------------------------
    # 5. DOMAIN WORKFLOW: APPOINTMENTS & NO-SHOW SIGNALS
    # --------------------------------------------------------------------------

    async def record_appointment(
        self,
        db: AsyncSession,
        org_id: str,
        appointment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        real_id = await resolve_business_id(org_id)
        customer_name = appointment_data.get("customer_name") or "Client"
        service_name = appointment_data.get("service_name") or "Service"
        start_time = appointment_data.get("start_time") or datetime.utcnow().isoformat()
        status = appointment_data.get("status", "CONFIRMED").upper()

        apt_dict = await self.create_sme_entity(
            db=db,
            org_id=real_id,
            code="sme_appointment",
            display_label=f"Booking: {customer_name} - {service_name}",
            attributes={
                "customer_id": appointment_data.get("customer_id"),
                "customer_name": customer_name,
                "service_id": appointment_data.get("service_id"),
                "service_name": service_name,
                "staff_id": appointment_data.get("staff_id"),
                "staff_name": appointment_data.get("staff_name"),
                "start_time": start_time,
                "end_time": appointment_data.get("end_time"),
                "duration_minutes": appointment_data.get("duration_minutes", 45),
                "price": float(appointment_data.get("price") or 0.0),
                "status": status,
                "location": appointment_data.get("location", "Main Studio"),
                "notes": appointment_data.get("notes")
            }
        )

        observation_service.record_observation(
            db=db,
            org_id=real_id,
            source_channel="sme_scheduling",
            observation_type="sme_appointment_created",
            primary_entity_id=apt_dict["id"],
            location_label=appointment_data.get("location", "Main Studio"),
            payload={
                "customer_name": customer_name,
                "service_name": service_name,
                "start_time": start_time,
                "status": status
            },
            severity="INFO"
        )

        # Mirror into platform-wide appointments table so it seamlessly appears on the main Scheduling dashboard
        try:
            from database.models.scheduling import Appointment, AppointmentType
            type_stmt = select(AppointmentType).where(
                AppointmentType.business_id == real_id,
                AppointmentType.name == service_name
            )
            res_t = await db.execute(type_stmt)
            apt_type = res_t.scalars().first()
            if not apt_type:
                active_stmt = select(AppointmentType).where(
                    AppointmentType.business_id == real_id,
                    AppointmentType.is_active == True
                )
                res_act = await db.execute(active_stmt)
                apt_type = res_act.scalars().first()

            if not apt_type:
                apt_type = AppointmentType(
                    business_id=real_id,
                    name=service_name,
                    duration_minutes=int(appointment_data.get("duration_minutes") or 45),
                    color_code="#8b5cf6"
                )
                db.add(apt_type)
                await db.flush()

            start_dt = None
            if isinstance(start_time, str):
                try:
                    start_dt = datetime.fromisoformat(start_time.replace("Z", ""))
                except Exception:
                    start_dt = datetime.utcnow()
            elif isinstance(start_time, datetime):
                start_dt = start_time

            duration = int(appointment_data.get("duration_minutes") or 45)
            end_dt = start_dt + timedelta(minutes=duration) if start_dt else None

            existing_core = await db.get(Appointment, apt_dict["id"])
            if not existing_core:
                core_apt = Appointment(
                    id=apt_dict["id"],
                    business_id=real_id,
                    appointment_type_id=apt_type.id if apt_type else None,
                    start_at=start_dt,
                    end_at=end_dt,
                    status=status.lower(),
                    notes=f"SME Booking: {customer_name} - {service_name} | Fee: {appointment_data.get('price', 0)}"
                )
                db.add(core_apt)
                await db.commit()
        except Exception as sync_err:
            logger.warning(f"[SMEService] Could not mirror appointment to core appointments table: {sync_err}")

        return apt_dict

    async def update_appointment_status(
        self,
        db: AsyncSession,
        org_id: str,
        appointment_id: str,
        status: str
    ) -> Optional[Dict[str, Any]]:
        real_id = await resolve_business_id(org_id)
        stmt = select(EntityV2).where(EntityV2.id == appointment_id, EntityV2.org_id == real_id)
        res = await db.execute(stmt)
        apt = res.scalar_one_or_none()
        if not apt:
            return None

        status_upper = status.upper()
        attrs = dict(apt.attributes or {})
        attrs["status"] = status_upper
        apt.attributes = attrs
        await db.commit()
        await db.refresh(apt)

        # Emit corresponding observation
        if status_upper == "NO_SHOW":
            observation_service.record_observation(
                db=db,
                org_id=real_id,
                source_channel="sme_scheduling",
                observation_type="sme_appointment_no_show",
                primary_entity_id=appointment_id,
                payload={"customer_name": attrs.get("customer_name"), "service_name": attrs.get("service_name")},
                severity="WARNING",
                risk_impact=4.0
            )
        elif status_upper == "COMPLETED":
            observation_service.record_observation(
                db=db,
                org_id=real_id,
                source_channel="sme_scheduling",
                observation_type="sme_service_completed",
                primary_entity_id=appointment_id,
                payload={"customer_name": attrs.get("customer_name"), "service_name": attrs.get("service_name")},
                severity="INFO",
                risk_impact=-1.0
            )

        return self._entity_to_dict(apt)

    # --------------------------------------------------------------------------
    # 6. DOMAIN WORKFLOW: PROCUREMENT & PURCHASE ORDERS
    # --------------------------------------------------------------------------

    async def record_purchase_order(
        self,
        db: AsyncSession,
        org_id: str,
        po_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        real_id = await resolve_business_id(org_id)
        supplier_name = po_data.get("supplier_name") or "Supplier"
        po_number = po_data.get("po_number") or f"PO-{datetime.utcnow().strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        total_cost = float(po_data.get("total_cost") or 0.0)

        po_dict = await self.create_sme_entity(
            db=db,
            org_id=real_id,
            code="sme_purchase_order",
            display_label=f"PO {po_number} ({supplier_name})",
            attributes={
                "po_number": po_number,
                "supplier_id": po_data.get("supplier_id"),
                "supplier_name": supplier_name,
                "items": po_data.get("items", []),
                "total_cost": total_cost,
                "status": po_data.get("status", "SUBMITTED").upper(),
                "expected_delivery": po_data.get("expected_delivery"),
                "notes": po_data.get("notes")
            },
            external_ref_id=po_number
        )

        observation_service.record_observation(
            db=db,
            org_id=real_id,
            source_channel="sme_procurement",
            observation_type="sme_purchase_order_created",
            primary_entity_id=po_dict["id"],
            payload={"po_number": po_number, "supplier_name": supplier_name, "total_cost": total_cost},
            severity="INFO"
        )
        return po_dict

    async def receive_purchase_order(
        self,
        db: AsyncSession,
        org_id: str,
        po_id: str
    ) -> Optional[Dict[str, Any]]:
        """Receives goods from a Purchase Order and automatically increments inventory stock."""
        real_id = await resolve_business_id(org_id)
        stmt = select(EntityV2).where(EntityV2.id == po_id, EntityV2.org_id == real_id)
        res = await db.execute(stmt)
        po = res.scalar_one_or_none()
        if not po:
            return None

        attrs = dict(po.attributes or {})
        if attrs.get("status") == "RECEIVED":
            return self._entity_to_dict(po)

        attrs["status"] = "RECEIVED"
        attrs["received_at"] = datetime.utcnow().isoformat()
        po.attributes = attrs

        # Increase product stock
        items = attrs.get("items", [])
        for item in items:
            product_id = item.get("product_id") or item.get("id")
            qty = float(item.get("quantity") or 0.0)
            if not product_id or qty <= 0:
                continue

            p_stmt = select(EntityV2).where(EntityV2.id == product_id, EntityV2.org_id == real_id)
            p_res = await db.execute(p_stmt)
            prod = p_res.scalar_one_or_none()
            if prod:
                p_attrs = dict(prod.attributes or {})
                new_stock = float(p_attrs.get("current_stock") or 0.0) + qty
                p_attrs["current_stock"] = new_stock
                prod.attributes = p_attrs

                # Log receipt movement
                await self.create_sme_entity(
                    db=db,
                    org_id=real_id,
                    code="sme_inventory_movement",
                    display_label=f"PO Receipt: +{qty} {prod.display_label}",
                    attributes={
                        "product_id": prod.id,
                        "product_name": prod.display_label,
                        "movement_type": "PURCHASE_RECEIPT",
                        "quantity": qty,
                        "reference_po_id": po_id,
                        "stock_after": new_stock
                    }
                )

        await db.commit()
        await db.refresh(po)

        observation_service.record_observation(
            db=db,
            org_id=real_id,
            source_channel="sme_procurement",
            observation_type="sme_purchase_order_received",
            primary_entity_id=po_id,
            payload={"po_number": attrs.get("po_number"), "items_received": len(items)},
            severity="INFO",
            risk_impact=-2.0
        )

        return self._entity_to_dict(po)

    # --------------------------------------------------------------------------
    # 7. REAL DATABASE-BACKED METRICS & DASHBOARD OVERVIEW
    # --------------------------------------------------------------------------

    async def get_dashboard_overview(self, db: AsyncSession, org_id: str) -> Dict[str, Any]:
        """
        Calculates live tenant-scoped metrics across Sales, Expenses, Customers,
        Inventory, Appointments, and Tasks.
        """
        real_id = await resolve_business_id(org_id)
        config = await self.get_sme_config(db, real_id)
        currency = config.get("currency", "NGN")

        # Fetch entities in memory for aggregation
        orders = await self.list_sme_entities(db, real_id, "sme_order", limit=200)
        customers = await self.list_sme_entities(db, real_id, "sme_customer", limit=200)
        leads = await self.list_sme_entities(db, real_id, "sme_lead", limit=200)
        products = await self.list_sme_entities(db, real_id, "sme_product", limit=200)
        appointments = await self.list_sme_entities(db, real_id, "sme_appointment", limit=200)
        invoices = await self.list_sme_entities(db, real_id, "sme_invoice", limit=200)
        expenses = await self.list_sme_entities(db, real_id, "sme_expense", limit=200)
        projects = await self.list_sme_entities(db, real_id, "sme_project", limit=200)
        tasks = await self.list_sme_entities(db, real_id, "sme_project_task", limit=200)

        # Revenue & Sales calculations
        total_revenue = sum(float(o["attributes"].get("total_amount") or 0.0) for o in orders if o["attributes"].get("payment_status") == "PAID")
        pending_orders_count = sum(1 for o in orders if o["attributes"].get("payment_status") != "PAID")
        total_expenses = sum(float(e["attributes"].get("amount") or 0.0) for e in expenses)

        # Receivables & Invoices
        total_receivables = 0.0
        overdue_invoices_count = 0
        now_date_str = datetime.utcnow().strftime("%Y-%m-%d")

        for inv in invoices:
            inv_attrs = inv["attributes"]
            inv_status = inv_attrs.get("status", "").upper()
            total_inv = float(inv_attrs.get("total_amount") or 0.0)
            paid_inv = float(inv_attrs.get("paid_amount") or 0.0)
            unpaid = max(0.0, total_inv - paid_inv)

            if inv_status != "PAID" and unpaid > 0:
                total_receivables += unpaid
                due_date = inv_attrs.get("due_date", "")
                if due_date and due_date < now_date_str:
                    overdue_invoices_count += 1

        # Inventory Low-Stock items
        low_stock_items = []
        stock_valuation = 0.0
        for p in products:
            p_attrs = p["attributes"]
            stock = float(p_attrs.get("current_stock") or 0.0)
            cost = float(p_attrs.get("cost_price") or 0.0)
            reorder = float(p_attrs.get("reorder_threshold") or 5.0)
            stock_valuation += stock * cost
            if stock <= reorder:
                low_stock_items.append({
                    "id": p["id"],
                    "title": p["display_label"],
                    "sku": p_attrs.get("sku"),
                    "stock": stock,
                    "reorder_threshold": reorder
                })

        # Overdue tasks
        overdue_tasks = []
        for t in tasks:
            t_attrs = t["attributes"]
            t_status = t_attrs.get("status", "").upper()
            due_date = t_attrs.get("due_date", "")
            if t_status not in ["DONE", "COMPLETED"] and due_date and due_date < now_date_str:
                overdue_tasks.append({
                    "id": t["id"],
                    "title": t["display_label"],
                    "due_date": due_date,
                    "assignee": t_attrs.get("assignee_name") or "Unassigned"
                })

        # Recent Signals
        obs_stmt = select(ObservationV2).where(ObservationV2.org_id == real_id).order_by(desc(ObservationV2.created_at)).limit(15)
        obs_res = await db.execute(obs_stmt)
        recent_obs = obs_res.scalars().all()

        signals_list = [
            {
                "id": o.id,
                "type": o.observation_type,
                "channel": o.source_channel,
                "severity": o.severity,
                "confidence": o.confidence,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "payload": o.payload
            }
            for o in recent_obs
        ]

        # Calculate Owner Attention Items
        attention_items = await self.get_owner_attention_items(db, real_id)

        return {
            "business_name": config.get("business_name", "My Business"),
            "business_model": config.get("business_model", "HYBRID"),
            "currency": currency,
            "metrics": {
                "total_revenue": total_revenue,
                "total_expenses": total_expenses,
                "net_profit": total_revenue - total_expenses,
                "total_receivables": total_receivables,
                "stock_valuation": stock_valuation,
                "customers_count": len(customers),
                "leads_count": len(leads),
                "orders_count": len(orders),
                "pending_orders_count": pending_orders_count,
                "appointments_count": len(appointments),
                "active_projects_count": sum(1 for prj in projects if prj["attributes"].get("status") in ["ACTIVE", "PLANNED"]),
                "overdue_tasks_count": len(overdue_tasks),
                "overdue_invoices_count": overdue_invoices_count,
                "low_stock_count": len(low_stock_items)
            },
            "low_stock_items": low_stock_items[:5],
            "overdue_tasks": overdue_tasks[:5],
            "attention_items": attention_items,
            "recent_signals": signals_list,
            "capabilities": config.get("capabilities", DEFAULT_SME_CAPABILITIES)
        }

    # --------------------------------------------------------------------------
    # 8. OWNER ATTENTION ENGINE ("Needs Attention")
    # --------------------------------------------------------------------------

    async def get_owner_attention_items(self, db: AsyncSession, org_id: str) -> List[Dict[str, Any]]:
        """
        Synthesizes active risks into a prioritized Attention Score:
        Score = (Severity * 3) + (Financial Impact * 2) + (Urgency * 2) + Confidence
        """
        real_id = await resolve_business_id(org_id)
        now_date_str = datetime.utcnow().strftime("%Y-%m-%d")
        items = []

        # 1. Unanswered Enquiries Check
        try:
            fifteen_mins_ago = datetime.utcnow() - timedelta(minutes=15)
            stmt_conv = select(
                Conversation.id,
                Conversation.customer_name,
                Conversation.last_message,
                Conversation.last_timestamp
            ).where(
                Conversation.business_id == real_id,
                Conversation.status == "waiting",
                Conversation.last_timestamp <= fifteen_mins_ago
            )
            res_conv = await db.execute(stmt_conv)
            unanswered_convs = res_conv.all()
            if unanswered_convs:
                count = len(unanswered_convs)
                score = (3 * 3) + (2 * 2) + (3 * 2) + 1.0  # High urgency & impact
                items.append({
                    "id": "att_unanswered_enquiries",
                    "severity": "CRITICAL" if count >= 3 else "WARNING",
                    "category": "CUSTOMER_SUPPORT",
                    "title": f"{count} customer {'enquiry has' if count == 1 else 'enquiries have'} been unanswered for > 15 minutes",
                    "description": "Prolonged response delays lead to immediate customer drop-off and lost sales opportunities.",
                    "financial_impact": "High risk of lost order value",
                    "recommended_action": "Route pending inquiries to available staff or trigger auto-acknowledgment workflow.",
                    "score": score,
                    "count": count
                })
        except Exception as conv_err:
            logger.warning(f"Could not query unanswered conversations for attention queue: {conv_err}")

        # 2. Overdue Invoices Check
        invoices = await self.list_sme_entities(db, real_id, "sme_invoice", limit=100)
        overdue_invs = []
        total_overdue_val = 0.0

        for inv in invoices:
            inv_attrs = inv["attributes"]
            due = inv_attrs.get("due_date", "")
            status = inv_attrs.get("status", "").upper()
            if status != "PAID" and due and due < now_date_str:
                unpaid = float(inv_attrs.get("total_amount") or 0.0) - float(inv_attrs.get("paid_amount") or 0.0)
                if unpaid > 0:
                    overdue_invs.append(inv)
                    total_overdue_val += unpaid

        if overdue_invs:
            count = len(overdue_invs)
            score = (2 * 3) + (3 * 2) + (2 * 2) + 1.0
            items.append({
                "id": "att_overdue_invoices",
                "severity": "WARNING",
                "category": "FINANCE",
                "title": f"{count} overdue {'invoice' if count == 1 else 'invoices'} totaling NGN {total_overdue_val:,.2f}",
                "description": "Cash flow is impacted by delayed customer collections beyond agreed payment terms.",
                "financial_impact": f"NGN {total_overdue_val:,.2f} pending collection",
                "recommended_action": "Trigger automated WhatsApp / Email payment reminders to customers.",
                "score": score,
                "count": count
            })

        # 3. Low-Stock and Stockouts
        products = await self.list_sme_entities(db, real_id, "sme_product", limit=100)
        stockouts = []
        low_stocks = []

        for p in products:
            p_attrs = p["attributes"]
            stock = float(p_attrs.get("current_stock") or 0.0)
            threshold = float(p_attrs.get("reorder_threshold") or 5.0)
            if stock <= 0:
                stockouts.append(p)
            elif stock <= threshold:
                low_stocks.append(p)

        if stockouts:
            count = len(stockouts)
            items.append({
                "id": "att_stockouts",
                "severity": "CRITICAL",
                "category": "INVENTORY",
                "title": f"{count} {'product has' if count == 1 else 'products have'} completely run out of stock",
                "description": f"Zero inventory on: {', '.join([s['display_label'] for s in stockouts[:3]])}.",
                "financial_impact": "Direct sales loss and customer dissatisfaction",
                "recommended_action": "Generate emergency Purchase Order with primary supplier.",
                "score": 19.0,
                "count": count
            })
        elif low_stocks:
            count = len(low_stocks)
            items.append({
                "id": "att_low_stock",
                "severity": "WARNING",
                "category": "INVENTORY",
                "title": f"{count} {'product is' if count == 1 else 'products are'} approaching reorder threshold",
                "description": f"Items below threshold: {', '.join([s['display_label'] for s in low_stocks[:3]])}.",
                "financial_impact": "Risk of stockouts within 48 to 72 hours",
                "recommended_action": "Review inventory levels and place replenishment order.",
                "score": 14.0,
                "count": count
            })

        # 4. Overdue Tasks
        tasks = await self.list_sme_entities(db, real_id, "sme_project_task", limit=100)
        overdue_tasks = [t for t in tasks if t["attributes"].get("status", "").upper() not in ["DONE", "COMPLETED"] and t["attributes"].get("due_date", "") < now_date_str and t["attributes"].get("due_date", "")]
        if overdue_tasks:
            count = len(overdue_tasks)
            items.append({
                "id": "att_overdue_tasks",
                "severity": "MEDIUM",
                "category": "OPERATIONS",
                "title": f"{count} project {'task is' if count == 1 else 'tasks are'} overdue",
                "description": f"Delayed deliverables: {', '.join([t['display_label'] for t in overdue_tasks[:3]])}.",
                "financial_impact": "Potential client delivery delays and penalty exposure",
                "recommended_action": "Reassign tasks or check in with responsible team members.",
                "score": 11.0,
                "count": count
            })

        # 5. Missed Appointments
        apts = await self.list_sme_entities(db, real_id, "sme_appointment", limit=100)
        no_shows = [a for a in apts if a["attributes"].get("status", "").upper() == "NO_SHOW"]
        if no_shows:
            count = len(no_shows)
            items.append({
                "id": "att_appointment_no_shows",
                "severity": "INFO",
                "category": "SCHEDULING",
                "title": f"{count} appointment no-show recorded this period",
                "description": "Clients missed reserved appointment slots without prior cancellation notice.",
                "financial_impact": "Idle staff capacity and unrealized service revenue",
                "recommended_action": "Dispatch rescheduling invite and consider deposit requirements for peak slots.",
                "score": 9.0,
                "count": count
            })

        # Sort by Attention Score descending
        items.sort(key=lambda x: x.get("score", 0.0), reverse=True)
        return items

    # --------------------------------------------------------------------------
    # 9. 16 DATABASE-BACKED ARGUS INTELLIGENCE SKILLS
    # --------------------------------------------------------------------------

    async def skill_daily_business_brief(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            overview = await self.get_dashboard_overview(session, real_id)
            metrics = overview["metrics"]
            currency = overview["currency"]
            attention = overview["attention_items"]

            has_data = metrics["orders_count"] > 0 or metrics["customers_count"] > 0 or len(overview["recent_signals"]) > 0

            return {
                "skill_key": "module_sme:daily_business_brief",
                "data_sources": ["EntityV2", "ObservationV2", "Conversations"],
                "calculation_method": "Multi-domain aggregation across sales, finance, inventory, and signals over active window",
                "insufficient_data": not has_data,
                "executive_summary": f"Business recorded {metrics['orders_count']} total orders yielding {currency} {metrics['total_revenue']:,.2f} in realized revenue. Unpaid receivables stand at {currency} {metrics['total_receivables']:,.2f} with {metrics['overdue_invoices_count']} overdue invoices.",
                "key_metrics": metrics,
                "top_priorities": [item["title"] for item in attention[:3]],
                "recommended_action": attention[0]["recommended_action"] if attention else "Business operations running smoothly. Maintain current marketing velocity."
            }

    async def skill_sales_pipeline_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            leads = await self.list_sme_entities(session, real_id, "sme_lead")
            opps = await self.list_sme_entities(session, real_id, "sme_opportunity")

            if not leads and not opps:
                return {
                    "skill_key": "module_sme:sales_pipeline_analyzer",
                    "insufficient_data": True,
                    "message": "Insufficient data. No leads or sales opportunities recorded in tenant database."
                }

            stage_counts = {}
            total_pipeline_val = 0.0
            for opp in opps:
                st = opp["attributes"].get("stage", "NEW").upper()
                val = float(opp["attributes"].get("value") or 0.0)
                stage_counts[st] = stage_counts.get(st, 0) + 1
                total_pipeline_val += val

            return {
                "skill_key": "module_sme:sales_pipeline_analyzer",
                "data_sources": ["sme_lead", "sme_opportunity"],
                "total_leads": len(leads),
                "total_opportunities": len(opps),
                "total_pipeline_value": total_pipeline_val,
                "stages_breakdown": stage_counts,
                "recommended_action": "Focus sales effort on opportunities in 'PROPOSAL' or 'NEGOTIATION' stages."
            }

    async def skill_unanswered_enquiry_detector(self, org_id: str = "default_business", threshold_minutes: int = 15, **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            cutoff = datetime.utcnow() - timedelta(minutes=threshold_minutes)
            try:
                stmt = select(
                    Conversation.id,
                    Conversation.customer_name,
                    Conversation.platform,
                    Conversation.last_message,
                    Conversation.last_timestamp
                ).where(
                    Conversation.business_id == real_id,
                    Conversation.status == "waiting",
                    Conversation.last_timestamp <= cutoff
                )
                res = await session.execute(stmt)
                convs = res.all()

                return {
                    "skill_key": "module_sme:unanswered_enquiry_detector",
                    "threshold_minutes": threshold_minutes,
                    "unanswered_count": len(convs),
                    "conversations": [
                        {
                            "id": c[0],
                            "customer": c[1],
                            "platform": c[2],
                            "last_message": c[3],
                            "waiting_since": c[4].isoformat() if c[4] else None
                        }
                        for c in convs[:5]
                    ],
                    "recommended_action": "Immediate agent assignment required to prevent customer drop-off." if convs else "No unanswered enquiries pending beyond SLA."
                }
            except Exception as e:
                logger.warning(f"Error querying unanswered enquiries in skill: {e}")
                return {
                    "skill_key": "module_sme:unanswered_enquiry_detector",
                    "threshold_minutes": threshold_minutes,
                    "unanswered_count": 0,
                    "conversations": [],
                    "recommended_action": "No unanswered enquiries pending beyond SLA."
                }

    async def skill_lead_followup_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            leads = await self.list_sme_entities(session, real_id, "sme_lead")
            now_str = datetime.utcnow().strftime("%Y-%m-%d")

            overdue_leads = []
            for l in leads:
                attrs = l["attributes"]
                follow_up = attrs.get("next_followup_at", "")
                if follow_up and follow_up < now_str and attrs.get("stage") not in ["WON", "LOST"]:
                    overdue_leads.append({
                        "id": l["id"],
                        "name": l["display_label"],
                        "contact": attrs.get("phone") or attrs.get("email"),
                        "stage": attrs.get("stage"),
                        "overdue_date": follow_up
                    })

            return {
                "skill_key": "module_sme:lead_followup_analyzer",
                "overdue_followup_count": len(overdue_leads),
                "overdue_leads": overdue_leads[:5],
                "recommended_action": "Assign sales rep to contact overdue leads within 24 hours." if overdue_leads else "All active leads are up-to-date on follow-ups."
            }

    async def skill_customer_activity_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            customers = await self.list_sme_entities(session, real_id, "sme_customer")

            if not customers:
                return {"skill_key": "module_sme:customer_activity_analyzer", "insufficient_data": True, "message": "No customers found."}

            high_value = [c for c in customers if float(c["attributes"].get("total_spend") or 0.0) >= 50000.0]
            return {
                "skill_key": "module_sme:customer_activity_analyzer",
                "total_customers": len(customers),
                "high_value_customers_count": len(high_value),
                "top_customers": [
                    {"name": c["display_label"], "total_spend": float(c["attributes"].get("total_spend") or 0.0)}
                    for c in sorted(customers, key=lambda x: float(x["attributes"].get("total_spend") or 0.0), reverse=True)[:5]
                ],
                "recommended_action": "Deliver VIP appreciation message or exclusive promotion to top spenders."
            }

    async def skill_customer_churn_signal_detector(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            customers = await self.list_sme_entities(session, real_id, "sme_customer")
            sixty_days_ago = (datetime.utcnow() - timedelta(days=60)).strftime("%Y-%m-%d")

            churn_risk_customers = []
            for c in customers:
                last_interaction = c["attributes"].get("last_interaction_at", "")
                spend = float(c["attributes"].get("total_spend") or 0.0)
                if last_interaction and last_interaction < sixty_days_ago and spend > 0:
                    churn_risk_customers.append({
                        "name": c["display_label"],
                        "last_interaction": last_interaction,
                        "past_spend": spend
                    })

            return {
                "skill_key": "module_sme:customer_churn_signal_detector",
                "churn_risk_count": len(churn_risk_customers),
                "at_risk_customers": churn_risk_customers[:5],
                "recommended_action": "Trigger reactivation campaign offer to re-engage lapsed customers." if churn_risk_customers else "Healthy retention rate across customer base."
            }

    async def skill_revenue_trend_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            orders = await self.list_sme_entities(session, real_id, "sme_order")
            paid_orders = [o for o in orders if o["attributes"].get("payment_status") == "PAID"]

            total_rev = sum(float(o["attributes"].get("total_amount") or 0.0) for o in paid_orders)
            return {
                "skill_key": "module_sme:revenue_trend_analyzer",
                "total_realized_revenue": total_rev,
                "paid_order_count": len(paid_orders),
                "average_order_value": (total_rev / len(paid_orders)) if paid_orders else 0.0,
                "recommended_action": "Boost average order value by bundling complementary accessories or services."
            }

    async def skill_outstanding_payment_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            invoices = await self.list_sme_entities(session, real_id, "sme_invoice")

            unpaid = []
            total_unpaid = 0.0
            for inv in invoices:
                status = inv["attributes"].get("status", "").upper()
                if status != "PAID":
                    due = float(inv["attributes"].get("total_amount") or 0.0) - float(inv["attributes"].get("paid_amount") or 0.0)
                    if due > 0:
                        unpaid.append(inv)
                        total_unpaid += due

            return {
                "skill_key": "module_sme:outstanding_payment_analyzer",
                "unpaid_invoice_count": len(unpaid),
                "total_unpaid_amount": total_unpaid,
                "recommended_action": "Prioritize follow-ups on largest outstanding receivables." if unpaid else "No outstanding debts."
            }

    async def skill_inventory_risk_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            products = await self.list_sme_entities(session, real_id, "sme_product")

            risks = []
            for p in products:
                stock = float(p["attributes"].get("current_stock") or 0.0)
                reorder = float(p["attributes"].get("reorder_threshold") or 5.0)
                if stock <= reorder:
                    risks.append({"product": p["display_label"], "stock": stock, "reorder_level": reorder, "status": "OUT_OF_STOCK" if stock <= 0 else "LOW_STOCK"})

            return {
                "skill_key": "module_sme:inventory_risk_analyzer",
                "inventory_risks_count": len(risks),
                "items_at_risk": risks,
                "recommended_action": "Order replacement batches for critical stockout products immediately." if risks else "Inventory levels optimal across all SKUs."
            }

    async def skill_supplier_performance_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            suppliers = await self.list_sme_entities(session, real_id, "sme_supplier")
            pos = await self.list_sme_entities(session, real_id, "sme_purchase_order")

            return {
                "skill_key": "module_sme:supplier_performance_analyzer",
                "total_suppliers": len(suppliers),
                "total_purchase_orders": len(pos),
                "received_pos_count": sum(1 for p in pos if p["attributes"].get("status") == "RECEIVED"),
                "recommended_action": "Review on-time fulfillment rates before signing contract renewals."
            }

    async def skill_appointment_no_show_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            apts = await self.list_sme_entities(session, real_id, "sme_appointment")

            total = len(apts)
            no_shows = sum(1 for a in apts if a["attributes"].get("status", "").upper() == "NO_SHOW")
            rate = (no_shows / total * 100) if total > 0 else 0.0

            return {
                "skill_key": "module_sme:appointment_no_show_analyzer",
                "total_appointments": total,
                "no_show_count": no_shows,
                "no_show_rate_pct": round(rate, 1),
                "recommended_action": "Introduce mandatory 20% booking deposit if no-show rate exceeds 15%."
            }

    async def skill_staff_workload_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            tasks = await self.list_sme_entities(session, real_id, "sme_project_task")

            workload = {}
            for t in tasks:
                assignee = t["attributes"].get("assignee_name") or "Unassigned"
                workload[assignee] = workload.get(assignee, 0) + 1

            return {
                "skill_key": "module_sme:staff_workload_analyzer",
                "total_tasks": len(tasks),
                "staff_task_distribution": workload,
                "recommended_action": "Rebalance work if any individual team member holds more than 35% of total active tasks."
            }

    async def skill_project_delay_analyzer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            projects = await self.list_sme_entities(session, real_id, "sme_project")
            tasks = await self.list_sme_entities(session, real_id, "sme_project_task")
            now_str = datetime.utcnow().strftime("%Y-%m-%d")

            overdue_p = []
            for p in projects:
                deadline = p["attributes"].get("deadline", "")
                status = p["attributes"].get("status", "").upper()
                if status == "ACTIVE" and deadline and deadline < now_str:
                    overdue_p.append({"name": p["display_label"], "deadline": deadline})

            return {
                "skill_key": "module_sme:project_delay_analyzer",
                "active_projects": len(projects),
                "delayed_projects_count": len(overdue_p),
                "delayed_projects": overdue_p,
                "recommended_action": "Hold project milestone sprint to unblock overdue deliverable items." if overdue_p else "All active projects are on track."
            }

    async def skill_business_bottleneck_detector(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            overview = await self.get_dashboard_overview(session, real_id)
            m = overview["metrics"]

            bottlenecks = []
            if m["overdue_invoices_count"] > 0:
                bottlenecks.append("Cash Flow: Overdue receivables delaying operational liquidity.")
            if m["low_stock_count"] > 0:
                bottlenecks.append("Supply Chain: Low stock limiting product sales volume.")
            if m["overdue_tasks_count"] > 0:
                bottlenecks.append("Execution: Overdue operational tasks creating backlog.")

            return {
                "skill_key": "module_sme:business_bottleneck_detector",
                "bottlenecks_identified": bottlenecks,
                "status": "CONGESTED" if len(bottlenecks) >= 2 else "CLEAR",
                "recommended_action": "Resolve financial receivables collection first, then replenish stock." if bottlenecks else "Operations running with minimal friction."
            }

    async def skill_business_signal_summary(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            stmt = select(ObservationV2).where(ObservationV2.org_id == real_id).order_by(desc(ObservationV2.created_at)).limit(30)
            res = await session.execute(stmt)
            obs = res.scalars().all()

            severity_breakdown = {}
            for o in obs:
                severity_breakdown[o.severity] = severity_breakdown.get(o.severity, 0) + 1

            return {
                "skill_key": "module_sme:business_signal_summary",
                "total_recent_signals": len(obs),
                "severity_counts": severity_breakdown,
                "most_recent_signal": obs[0].observation_type if obs else None,
                "recommended_action": "Review CRITICAL signals immediately in the Security/Signal Intelligence dashboard."
            }

    async def skill_owner_attention_prioritizer(self, org_id: str = "default_business", **kwargs) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            real_id = await resolve_business_id(org_id)
            items = await self.get_owner_attention_items(session, real_id)

            return {
                "skill_key": "module_sme:owner_attention_prioritizer",
                "attention_items_count": len(items),
                "prioritized_queue": items,
                "top_recommendation": items[0]["recommended_action"] if items else "All systems green. No immediate management intervention needed."
            }

    # --------------------------------------------------------------------------
    # 10. REAL SEED DEMO FIXTURES (Beauty, Consulting, Fashion, Printing, Cleaning)
    # --------------------------------------------------------------------------

    async def seed_demo_data(self, db: AsyncSession, org_id: str, preset_key: str = "beauty") -> Dict[str, Any]:
        """
        Seeds complete, realistic demonstration data across all entities,
        observations, and attention items for a specific SME archetype.
        """
        real_id = await resolve_business_id(org_id)
        await self.apply_preset(db, real_id, preset_key)
        await self.initialize_entity_types_for_org(real_id, db)

        # Clear legacy SME entities for this test organization to avoid clutter
        stmt_del = select(EntityV2).join(EntityType).where(EntityV2.org_id == real_id, EntityType.module_id == "module_sme")
        res_del = await db.execute(stmt_del)
        old_ents = res_del.scalars().all()
        for e in old_ents:
            await db.delete(e)
        await db.commit()

        # Seed archetype data
        if preset_key == "beauty":
            # 1. Customers
            c1 = await self.create_sme_entity(db, real_id, "sme_customer", "Amina Bello", {"email": "amina.b@gmail.com", "phone": "+2348031234567", "total_spend": 85000.0, "status": "VIP"})
            c2 = await self.create_sme_entity(db, real_id, "sme_customer", "Chidinma Okafor", {"email": "chidinma@yahoo.com", "phone": "+2348129876543", "total_spend": 32000.0, "status": "ACTIVE"})

            # 2. Products
            p1 = await self.create_sme_entity(db, real_id, "sme_product", "Organic Argan Hair Serum 100ml", {"sku": "GLOW-ARG-01", "selling_price": 12500.0, "cost_price": 6000.0, "current_stock": 3.0, "reorder_threshold": 5.0})
            p2 = await self.create_sme_entity(db, real_id, "sme_product", "Moroccan Clay Face Mask 250g", {"sku": "GLOW-MSK-02", "selling_price": 8500.0, "cost_price": 3800.0, "current_stock": 14.0, "reorder_threshold": 6.0})

            # 3. Services
            s1 = await self.create_sme_entity(db, real_id, "sme_service", "Deep Tissue Hot Stone Massage", {"price": 25000.0, "duration_minutes": 60, "category": "Spa"})
            s2 = await self.create_sme_entity(db, real_id, "sme_service", "Luxury Hydration Facial & Scrub", {"price": 18000.0, "duration_minutes": 45, "category": "Facial"})

            # 4. Orders
            await self.record_order(db, real_id, {
                "customer_id": c1["id"],
                "customer_name": "Amina Bello",
                "items": [{"product_id": p1["id"], "name": "Organic Argan Hair Serum", "quantity": 1, "price": 12500.0}],
                "total_amount": 12500.0,
                "payment_status": "PAID",
                "payment_method": "paystack"
            })

            # 5. Appointments
            await self.record_appointment(db, real_id, {
                "customer_id": c2["id"],
                "customer_name": "Chidinma Okafor",
                "service_name": "Deep Tissue Hot Stone Massage",
                "start_time": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
                "price": 25000.0,
                "status": "CONFIRMED"
            })

            # 6. Overdue Invoice
            await self.create_sme_entity(db, real_id, "sme_invoice", "INV-2026-004 (Bridal Party Package)", {
                "invoice_number": "INV-2026-004",
                "customer_id": c1["id"],
                "total_amount": 95000.0,
                "paid_amount": 35000.0,
                "due_date": (datetime.utcnow() - timedelta(days=5)).strftime("%Y-%m-%d"),
                "status": "OVERDUE"
            })

            # 7. Expense
            await self.create_sme_entity(db, real_id, "sme_expense", "Studio Monthly Utilities & Power", {
                "category": "UTILITIES",
                "amount": 45000.0,
                "date": datetime.utcnow().strftime("%Y-%m-%d"),
                "payment_method": "bank_transfer"
            })

        elif preset_key == "consulting":
            c1 = await self.create_sme_entity(db, real_id, "sme_customer", "Zenith Commercial Bank PLC", {"email": "strategy@zenith.com", "total_spend": 4500000.0, "status": "ENTERPRISE"})
            prj1 = await self.create_sme_entity(db, real_id, "sme_project", "Digital Transformation Architecture Review", {
                "customer_id": c1["id"],
                "budget": 3500000.0,
                "deadline": (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d"),
                "status": "ACTIVE"
            })
            await self.create_sme_entity(db, real_id, "sme_project_task", "Finalize Cloud Governance Policy Document", {
                "project_id": prj1["id"],
                "assignee_name": "Victor Sylva",
                "due_date": (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d"),
                "priority": "HIGH",
                "status": "IN_PROGRESS"
            })
            await self.create_sme_entity(db, real_id, "sme_invoice", "INV-APEX-089 (Phase 1 Deliverables)", {
                "invoice_number": "INV-APEX-089",
                "customer_id": c1["id"],
                "total_amount": 1750000.0,
                "paid_amount": 0.0,
                "due_date": (datetime.utcnow() - timedelta(days=10)).strftime("%Y-%m-%d"),
                "status": "OVERDUE"
            })

        elif preset_key == "fashion":
            c1 = await self.create_sme_entity(db, real_id, "sme_customer", "Tunde Balogun", {"email": "tunde@balogun.ng", "phone": "+2348023456789", "total_spend": 120000.0})
            p1 = await self.create_sme_entity(db, real_id, "sme_product", "Lagos Monogram Oversized Hoodie (Black, L)", {"sku": "KT-HD-BLK-L", "selling_price": 38000.0, "cost_price": 18000.0, "current_stock": 2.0, "reorder_threshold": 5.0})
            p2 = await self.create_sme_entity(db, real_id, "sme_product", "Adire Pattern Relaxed Trousers", {"sku": "KT-TR-ADR-M", "selling_price": 28000.0, "cost_price": 12000.0, "current_stock": 18.0, "reorder_threshold": 6.0})
            sup = await self.create_sme_entity(db, real_id, "sme_supplier", "Aba Quality Textile Mills", {"phone": "+2348033333333", "lead_time_days": 7})
            await self.record_purchase_order(db, real_id, {
                "supplier_id": sup["id"],
                "supplier_name": "Aba Quality Textile Mills",
                "total_cost": 240000.0,
                "items": [{"product_id": p1["id"], "name": "Raw Fleece Cotton Fabric", "quantity": 20}],
                "status": "APPROVED"
            })

        elif preset_key == "printing":
            c1 = await self.create_sme_entity(db, real_id, "sme_customer", "Eko Tech Summit 2026", {"phone": "+2348187654321", "total_spend": 850000.0})
            prj = await self.create_sme_entity(db, real_id, "sme_project", "2,500 Hardcover Event Brochures & Name Badges", {
                "customer_id": c1["id"],
                "budget": 650000.0,
                "deadline": (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%d"),
                "status": "ACTIVE"
            })
            p1 = await self.create_sme_entity(db, real_id, "sme_product", "300gsm Gloss Art Card Reams", {"sku": "PAP-300G-GLOSS", "selling_price": 15000.0, "cost_price": 11000.0, "current_stock": 4.0, "reorder_threshold": 10.0})

        elif preset_key == "cleaning":
            c1 = await self.create_sme_entity(db, real_id, "sme_customer", "Heritage Court Apartments", {"phone": "+2348099887766", "total_spend": 340000.0})
            s1 = await self.create_sme_entity(db, real_id, "sme_service", "Bi-Weekly Corporate Facility Janitorial Cleaning", {"price": 75000.0, "duration_minutes": 180})
            await self.record_appointment(db, real_id, {
                "customer_id": c1["id"],
                "customer_name": "Heritage Court Apartments",
                "service_name": "Bi-Weekly Corporate Facility Janitorial Cleaning",
                "start_time": (datetime.utcnow() + timedelta(days=1)).isoformat(),
                "price": 75000.0,
                "status": "CONFIRMED"
            })

        elif preset_key == "general_trade":
            c1 = await self.create_sme_entity(db, real_id, "sme_customer", "Dantata & Sons Superstore", {"email": "purchasing@dantata.ng", "phone": "+2348035551122", "total_spend": 1250000.0, "status": "VIP"})
            p1 = await self.create_sme_entity(db, real_id, "sme_product", "Premium Parboiled Rice 50kg Sack", {"sku": "FMCG-RICE-50K", "selling_price": 78000.0, "cost_price": 71000.0, "current_stock": 25.0, "reorder_threshold": 10.0})
            p2 = await self.create_sme_entity(db, real_id, "sme_product", "Refined Vegetable Oil 25L", {"sku": "FMCG-OIL-25L", "selling_price": 42000.0, "cost_price": 38000.0, "current_stock": 6.0, "reorder_threshold": 8.0})
            await self.record_order(db, real_id, {
                "customer_id": c1["id"],
                "customer_name": "Dantata & Sons Superstore",
                "items": [{"product_id": p1["id"], "name": "Premium Parboiled Rice 50kg Sack", "quantity": 10, "price": 78000.0}],
                "total_amount": 780000.0,
                "payment_status": "PAID",
                "payment_method": "bank_transfer"
            })

        logger.info(f"[SMEService] Seeded realistic demo data for '{preset_key}' in org '{real_id}'")
        return {"success": True, "preset": preset_key, "org_id": real_id}


    # --------------------------------------------------------------------------
    # 11. 15 PRE-BUILT STARTER WORKFLOW TEMPLATES
    # --------------------------------------------------------------------------

    def get_starter_workflow_templates(self) -> List[Dict[str, Any]]:
        """Returns the 15 canonical SME workflow templates specified by the platform architecture."""
        return [
            {
                "id": "wf_sme_01_enquiry_ack",
                "name": "1. Inbound Enquiry Auto-Acknowledge & Owner Assignment",
                "description": "Triggered on new enquiry: sends greeting, captures lead, assigns to sales owner.",
                "trigger_type": "message_created",
                "trigger_config": {"channel": "any"},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "New Customer Enquiry", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Send Instant Greeting", "config": {"action_type": "send_message", "template": "Hello! Thank you for reaching out to us. An advisor has been assigned to help you right away."}, "position": {"x": 300, "y": 100}},
                    {"id": "n3", "type": "lead_capture", "label": "Capture Lead in CRM", "config": {"source": "inbound_chat"}, "position": {"x": 500, "y": 100}},
                    {"id": "n4", "type": "action", "label": "Route to Sales", "config": {"action_type": "route_to_department", "department": "sales"}, "position": {"x": 700, "y": 100}}
                ],
                "edges": [
                    {"source": "n1", "target": "n2"},
                    {"source": "n2", "target": "n3"},
                    {"source": "n3", "target": "n4"}
                ]
            },
            {
                "id": "wf_sme_02_unanswered_escalation",
                "name": "2. Unanswered Enquiry SLA Escalation",
                "description": "If an enquiry receives no staff response within 15 minutes, notify the supervisor.",
                "trigger_type": "sme_enquiry_unanswered",
                "trigger_config": {"threshold_minutes": 15},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Enquiry Unanswered > 15m", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Alert Operations Lead", "config": {"action_type": "send_email", "recipient_type": "department", "department": "operations", "subject": "Urgent: Unanswered Customer Enquiry", "body": "A customer enquiry is pending without response for over 15 minutes."}, "position": {"x": 350, "y": 100}},
                    {"id": "n3", "type": "action", "label": "Record Alert Signal", "config": {"action_type": "record_observation", "observation_type": "sme_sla_breach", "severity": "WARNING"}, "position": {"x": 600, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
            },
            {
                "id": "wf_sme_03_lead_nurture",
                "name": "3. New Lead Follow-up Scheduler",
                "description": "Assigns sales owner and schedules reminder task for 24-hour follow-up.",
                "trigger_type": "sme_lead_created",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "New Lead Created", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "time_delay", "label": "Wait 2 Hours", "config": {"delay_seconds": 7200}, "position": {"x": 300, "y": 100}},
                    {"id": "n3", "type": "action", "label": "Send Personalized Intro", "config": {"action_type": "send_message", "template": "Hi! Just following up to see how we can assist with your requirements today."}, "position": {"x": 550, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
            },
            {
                "id": "wf_sme_04_quote_followup",
                "name": "4. Quotation Sent Follow-up Sequence",
                "description": "Checks for quotation acceptance after 48 hours and prompts client.",
                "trigger_type": "sme_quotation_sent",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Quote Sent", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "time_delay", "label": "Wait 48 Hours", "config": {"delay_seconds": 172800}, "position": {"x": 350, "y": 100}},
                    {"id": "n3", "type": "action", "label": "Check In With Client", "config": {"action_type": "send_message", "template": "Hello! We wanted to check if you had any questions regarding the estimate we sent over."}, "position": {"x": 600, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
            },
            {
                "id": "wf_sme_05_payment_fulfillment",
                "name": "5. Payment Received $\\rightarrow$ Invoice & Fulfillment",
                "description": "Updates invoice status, records observation, and alerts fulfillment staff.",
                "trigger_type": "sme_order_paid",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Order Payment Cleared", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Send Payment Receipt", "config": {"action_type": "send_message", "template": "Payment confirmed! Your order is now being processed by our fulfillment team."}, "position": {"x": 350, "y": 100}},
                    {"id": "n3", "type": "action", "label": "Record Finance Signal", "config": {"action_type": "record_observation", "observation_type": "sme_payment_verified", "severity": "INFO"}, "position": {"x": 600, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
            },
            {
                "id": "wf_sme_06_invoice_overdue",
                "name": "6. Overdue Invoice Collection Reminder",
                "description": "Sends polite collection reminder to client and alerts finance team.",
                "trigger_type": "sme_invoice_overdue",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Invoice Overdue Detected", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Send Friendly Payment Reminder", "config": {"action_type": "send_message", "template": "Gentle reminder: Your invoice is due. Please click here to complete payment or view details."}, "position": {"x": 350, "y": 100}},
                    {"id": "n3", "type": "action", "label": "Alert Finance Manager", "config": {"action_type": "send_email", "recipient_type": "department", "department": "finance", "subject": "Overdue Receivable Alert", "body": "An outstanding customer invoice has exceeded agreed credit terms."}, "position": {"x": 600, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
            },
            {
                "id": "wf_sme_07_low_stock_reorder",
                "name": "7. Low Stock Level Replenishment Alert",
                "description": "Alerts inventory owner and flags draft purchase order when stock is below threshold.",
                "trigger_type": "sme_stock_low",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Low Stock Threshold Breached", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Alert Inventory Manager", "config": {"action_type": "send_email", "recipient_type": "department", "department": "inventory", "subject": "Stock Replenishment Warning", "body": "One or more products have reached reorder thresholds."}, "position": {"x": 350, "y": 100}},
                    {"id": "n3", "type": "action", "label": "Log Stock Risk Signal", "config": {"action_type": "record_observation", "observation_type": "sme_stockout_imminent", "severity": "WARNING"}, "position": {"x": 600, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
            },
            {
                "id": "wf_sme_08_appointment_reminder",
                "name": "8. Appointment Booking Confirmation & Reminder",
                "description": "Sends immediate confirmation and schedules reminder before appointment time.",
                "trigger_type": "appointment_booked",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Appointment Booked", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Send Instant Confirmation", "config": {"action_type": "send_message", "template": "Your appointment is confirmed! We look forward to welcoming you."}, "position": {"x": 350, "y": 100}},
                    {"id": "n3", "type": "action", "label": "Record Booking Observation", "config": {"action_type": "record_observation", "observation_type": "sme_appointment_active", "severity": "INFO"}, "position": {"x": 600, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
            },
            {
                "id": "wf_sme_09_noshow_recovery",
                "name": "9. Appointment No-Show Recovery Sequence",
                "description": "Records observation on missed appointment and sends rebooking invitation.",
                "trigger_type": "sme_appointment_no_show",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "No-Show Detected", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Send Rebooking Invite", "config": {"action_type": "send_message", "template": "We missed you today! Life gets busy—please click here to reschedule your appointment at your convenience."}, "position": {"x": 350, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}]
            },
            {
                "id": "wf_sme_10_complaint_escalation",
                "name": "10. Customer Complaint Priority Escalation",
                "description": "Creates high-priority ticket and routes directly to management.",
                "trigger_type": "sme_customer_complaint",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Complaint Detected", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Create Urgent Ticket", "config": {"action_type": "create_ticket", "priority": "high", "subject": "Urgent Customer Complaint Escalation"}, "position": {"x": 350, "y": 100}},
                    {"id": "n3", "type": "action", "label": "Notify General Manager", "config": {"action_type": "send_email", "recipient_type": "owner", "subject": "Critical Customer Complaint", "body": "Immediate attention needed for customer dissatisfaction."}, "position": {"x": 600, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
            },
            {
                "id": "wf_sme_11_task_overdue",
                "name": "11. Operational Task Overdue Escalation",
                "description": "Alerts task assignee and escalates to department head if unaddressed.",
                "trigger_type": "sme_task_overdue",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Task Overdue", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Alert Operations Lead", "config": {"action_type": "send_email", "recipient_type": "department", "department": "operations", "subject": "Overdue Deliverable Alert", "body": "A critical project task has exceeded its scheduled deadline."}, "position": {"x": 350, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}]
            },
            {
                "id": "wf_sme_12_project_risk",
                "name": "12. Project Deadline At Risk Alert",
                "description": "Triggers when a project deadline is $< 72$ hours away with incomplete tasks.",
                "trigger_type": "sme_project_at_risk",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Project Approaching Deadline", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Notify Project Manager", "config": {"action_type": "send_email", "recipient_type": "department", "department": "operations", "subject": "Project Milestone Due Soon", "body": "Project milestone is due within 72 hours. Review open task progress."}, "position": {"x": 350, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}]
            },
            {
                "id": "wf_sme_13_welcome_customer",
                "name": "13. New Customer Onboarding Welcome",
                "description": "Sends warm welcome note and catalogue link on new customer creation.",
                "trigger_type": "sme_customer_created",
                "trigger_config": {},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Customer Record Created", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Send Welcome Packet", "config": {"action_type": "send_message", "template": "Welcome to our family! We are excited to serve you. Reach out here anytime you need assistance."}, "position": {"x": 350, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}]
            },
            {
                "id": "wf_sme_14_retention_winback",
                "name": "14. Customer Lapsed Retention Win-back",
                "description": "Identifies customer inactive for 60+ days and sends exclusive check-in offer.",
                "trigger_type": "sme_customer_inactive",
                "trigger_config": {"inactive_days": 60},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Customer Inactive > 60d", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Send Re-engagement Offer", "config": {"action_type": "send_offer_link", "message": "We have missed you! Here is a special 15% discount for your next booking or order."}, "position": {"x": 350, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}]
            },
            {
                "id": "wf_sme_15_daily_brief",
                "name": "15. Daily SME Executive Brief Delivery",
                "description": "Compiles daily business brief and sends management summary.",
                "trigger_type": "cron",
                "trigger_config": {"cron": "0 8 * * *"},
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Daily Morning Trigger", "config": {}, "position": {"x": 100, "y": 100}},
                    {"id": "n2", "type": "action", "label": "Dispatch Daily Brief", "config": {"action_type": "send_email", "recipient_type": "owner", "subject": "InteracAI Morning Business Brief", "body": "Your daily business intelligence brief is ready in your command dashboard."}, "position": {"x": 350, "y": 100}}
                ],
                "edges": [{"source": "n1", "target": "n2"}]
            }
        ]

    async def deploy_starter_workflows(self, db: AsyncSession, org_id: str) -> List[str]:
        """Deploys the 15 starter workflows into the tenant's Workflow engine."""
        import uuid
        from services.workflow_engine import workflow_engine
        real_id = await resolve_business_id(org_id)
        templates = self.get_starter_workflow_templates()
        created_ids = []

        for tmpl in templates:
            try:
                # Remap node IDs to unique IDs to satisfy global primary key uniqueness in workflow_nodes
                id_map = {n["id"]: f"sme_node_{uuid.uuid4().hex[:12]}" for n in tmpl.get("nodes", [])}
                remapped_nodes = [{**n, "id": id_map.get(n["id"], n["id"])} for n in tmpl.get("nodes", [])]
                remapped_edges = [
                    {
                        **e,
                        "source": id_map.get(e.get("source"), e.get("source")),
                        "target": id_map.get(e.get("target"), e.get("target"))
                    }
                    for e in tmpl.get("edges", [])
                ]

                res = await workflow_engine.create_workflow(real_id, {
                    "name": tmpl["name"],
                    "description": tmpl["description"],
                    "trigger_type": tmpl["trigger_type"],
                    "trigger_config": tmpl["trigger_config"],
                    "nodes": remapped_nodes,
                    "edges": remapped_edges
                })
                if res.get("status") == "success":
                    created_ids.append(res.get("id"))
            except Exception as e:
                logger.warning(f"Error deploying starter workflow '{tmpl['name']}': {e}")

        logger.info(f"[SMEService] Deployed {len(created_ids)} starter workflows for {real_id}")
        return created_ids


# Singleton export
sme_service = SMEService()
