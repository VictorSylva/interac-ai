"""
InteracAI Hotels & Hospitality Special Operations REST Router.
Defines PMS operations like reservation lifecycles, frontdesk check-in/out, and folio billing.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Dict, Any, List, Optional
import uuid
import logging
from datetime import datetime, timedelta
import re

from database.session import get_db
from database.models.dynamic_entity import EntityType, EntityV2
from services.observation_service import observation_service
from services.workflow_engine import workflow_engine
from services.auth_service import require_permission, require_entitlement, require_department, get_current_user
from services.db_service import resolve_business_id, save_lead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/hotels", tags=["Hotels Operations"])


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
    """Helper to resolve EntityType ID from its string code with multi-tenant resolution."""
    real_org_id = await resolve_business_id(org_id)
    stmt = select(EntityType).where(
        or_(EntityType.org_id == real_org_id, EntityType.org_id == org_id),
        EntityType.code == code
    )
    res = await db.execute(stmt)
    et = res.scalar_one_or_none()
    if not et:
        et = EntityType(
            id=f"et_{uuid.uuid4().hex[:12]}",
            org_id=real_org_id,
            module_id="module_hotels",
            code=code,
            display_name=code.replace("_", " ").title(),
            schema_definition={}
        )
        db.add(et)
        await db.commit()
        await db.refresh(et)
    return et.id


# --- RESERVATIONS ENDPOINTS ---

@router.get("/reservations")
async def list_reservations(
    request: Request,
    org_id: str = Query(..., description="Organization ID"),
    status_filter: Optional[str] = Query(None, description="Filter by status (RESERVED, CHECKED_IN, CHECKED_OUT, CANCELLED)"),
    property_id: Optional[str] = Query(None, description="Filter by hotel property"),
    db: AsyncSession = Depends(get_db)
):
    """List all reservations for the hotel property with multi-format ID support."""
    real_org_id = await resolve_business_id(org_id)

    # Optional authorization validation
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from services.auth_service import decode_access_token
            token = auth_header.split(" ")[1]
            token_data = decode_access_token(token)
            if token_data and token_data.get("role") not in ["super_admin"]:
                user_bid = await resolve_business_id(token_data.get("business_id", ""))
                if user_bid and user_bid != real_org_id:
                    raise HTTPException(status_code=403, detail="Tenant mismatch")
        except HTTPException:
            raise
        except Exception as auth_err:
            logger.debug(f"[HotelRoutes] Token decode note: {auth_err}")
        
    type_id = await _get_entity_type_id(db, real_org_id, "hotel_reservation")
    stmt = select(EntityV2).where(
        or_(EntityV2.org_id == real_org_id, EntityV2.org_id == org_id),
        EntityV2.entity_type_id == type_id
    ).order_by(EntityV2.created_at.desc())
    res = await db.execute(stmt)
    reservations = res.scalars().all()
    
    output = []
    for r in reservations:
        r_dict = _entity_to_dict(r)
        attrs = r_dict.get("attributes", {})
        if status_filter and attrs.get("status") != status_filter:
            continue
        if property_id and attrs.get("property_id") != property_id:
            continue
        output.append(r_dict)
    return output


@router.post("/reservations", status_code=status.HTTP_201_CREATED)
async def create_reservation(
    payload: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create a new booking reservation and sync to CRM."""
    raw_org_id = payload.get("org_id")
    if not raw_org_id:
        raise HTTPException(status_code=400, detail="Missing required 'org_id'")
    
    real_org_id = await resolve_business_id(raw_org_id)
    
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from services.auth_service import decode_access_token
            token = auth_header.split(" ")[1]
            token_data = decode_access_token(token)
            if token_data and token_data.get("role") not in ["super_admin"]:
                user_bid = await resolve_business_id(token_data.get("business_id", ""))
                if user_bid and user_bid != real_org_id:
                    raise HTTPException(status_code=403, detail="Tenant mismatch")
        except HTTPException:
            raise
        except Exception:
            pass

    guest_name = payload.get("guest_name")
    room_number = payload.get("room_number")
    check_in_date = payload.get("check_in_date")
    check_out_date = payload.get("check_out_date")
    property_id = payload.get("property_id")
    
    if not all([guest_name, room_number, check_in_date, check_out_date]):
        raise HTTPException(status_code=400, detail="Missing required booking attributes.")

    guest_phone = payload.get("phone") or payload.get("guest_phone", "")
    guest_email = payload.get("email") or payload.get("guest_email", "")

    # 1. Resolve or Create Guest Entity
    guest_type_id = await _get_entity_type_id(db, real_org_id, "hotel_guest")
    guest_stmt = select(EntityV2).where(
        or_(EntityV2.org_id == real_org_id, EntityV2.org_id == raw_org_id), 
        EntityV2.entity_type_id == guest_type_id,
        EntityV2.display_label.ilike(f"%{guest_name}%")
    )
    guest_res = await db.execute(guest_stmt)
    guest = guest_res.scalars().first()
    
    if not guest:
        guest = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=real_org_id,
            entity_type_id=guest_type_id,
            display_label=guest_name,
            attributes={
                "vip_status": payload.get("vip_status", "Regular"),
                "phone": guest_phone,
                "email": guest_email,
                "nationality": payload.get("nationality", "Unknown"),
                "passport_id": payload.get("passport_id", ""),
                "preferences": payload.get("preferences", ""),
                "property_id": property_id
            }
        )
        db.add(guest)
        await db.flush()
    else:
        attrs = dict(guest.attributes or {})
        if guest_phone and not attrs.get("phone"): attrs["phone"] = guest_phone
        if guest_email and not attrs.get("email"): attrs["email"] = guest_email
        guest.attributes = attrs

    # 2. Resolve Room Entity to ensure room exists
    room_type_id = await _get_entity_type_id(db, real_org_id, "hotel_room")
    room_stmt = select(EntityV2).where(
        or_(EntityV2.org_id == real_org_id, EntityV2.org_id == raw_org_id),
        EntityV2.entity_type_id == room_type_id,
        EntityV2.display_label == room_number
    )
    room_res = await db.execute(room_stmt)
    room = room_res.scalar_one_or_none()
    
    if not room:
        room = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=real_org_id,
            entity_type_id=room_type_id,
            display_label=room_number,
            attributes={
                "room_type": payload.get("room_type", "Standard King"),
                "floor": payload.get("floor", "1"),
                "status": "VACANT",
                "housekeeping": "Clean",
                "nightly_rate": float(payload.get("nightly_rate", 150.0)),
                "property_id": property_id
            }
        )
        db.add(room)
        await db.flush()

    # 3. Create Reservation Entity
    res_type_id = await _get_entity_type_id(db, real_org_id, "hotel_reservation")
    nightly_rate = float(room.attributes.get("nightly_rate", payload.get("nightly_rate", 150.0)))
    reservation = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=real_org_id,
        entity_type_id=res_type_id,
        display_label=f"Res: {guest_name} - Room {room_number}",
        attributes={
            "guest_id": guest.id,
            "guest_name": guest.display_label,
            "guest_phone": guest_phone,
            "guest_email": guest_email,
            "room_id": room.id,
            "room_number": room_number,
            "room_type": room.attributes.get("room_type", "Standard King"),
            "check_in_date": check_in_date,
            "check_out_date": check_out_date,
            "status": "RESERVED",
            "nightly_rate": nightly_rate,
            "booking_source": payload.get("booking_source", "Walk-in"),
            "property_id": property_id
        }
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    
    # 4. Synchronize customer directly to CRM leads table
    try:
        await save_lead(real_org_id, {
            "name": guest_name,
            "phone": guest_phone,
            "email": guest_email,
            "source": payload.get("booking_source", "Front Desk Walk-in"),
            "notes": f"Hotel Reservation: Room {room_number} ({check_in_date} to {check_out_date}). Status: RESERVED",
            "status": "won",
            "value": int(nightly_rate),
            "tags": ["hotel_guest", "reservation"]
        })
        logger.info(f"[HotelRoutes] Synced reservation guest {guest_name} to CRM.")
    except Exception as crm_err:
        logger.warning(f"[HotelRoutes] CRM sync error: {crm_err}")

    # 5. Emit Reservation Created signal to workflow engine
    try:
        await workflow_engine.trigger_workflow(real_org_id, "reservation_booked", {
            "reservation_id": reservation.id,
            "guest_name": guest_name,
            "room_number": room_number,
            "check_in": check_in_date,
            "check_out": check_out_date
        })
    except Exception as wf_err:
        logger.warning(f"[HotelRoutes] Workflow trigger note: {wf_err}")

    return _entity_to_dict(reservation)


# --- FRONT DESK CHECK-IN & CHECK-OUT STATE MACHINES ---

@router.post("/checkin")
async def checkin_guest(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Check-in a guest based on their Reservation ID."""
    org_id = payload.get("org_id")
    reservation_id = payload.get("reservation_id")
    
    if not org_id or not reservation_id:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'reservation_id'")
        
    real_org_id = await resolve_business_id(org_id)
    res_stmt = select(EntityV2).where(
        EntityV2.id == reservation_id, 
        or_(EntityV2.org_id == real_org_id, EntityV2.org_id == org_id)
    )
    res_result = await db.execute(res_stmt)
    reservation = res_result.scalar_one_or_none()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
        
    res_attrs = dict(reservation.attributes or {})
    if res_attrs.get("status") != "RESERVED":
        raise HTTPException(status_code=400, detail=f"Cannot check in reservation in state: {res_attrs.get('status')}")
        
    guest_id = res_attrs.get("guest_id")
    room_id = res_attrs.get("room_id")
    room_number = res_attrs.get("room_number")
    nightly_rate = float(res_attrs.get("nightly_rate", 150.0))
    guest_name = res_attrs.get("guest_name", "Valued Guest")
    
    # 1. Update Reservation (Attributes queued for single assignment below)
    res_attrs["status"] = "CHECKED_IN"
    res_attrs["actual_check_in"] = datetime.utcnow().isoformat()
    
    # 2. Update Room status
    room_stmt = select(EntityV2).where(EntityV2.id == room_id)
    room_res = await db.execute(room_stmt)
    room = room_res.scalar_one_or_none()
    if room:
        room_attrs = dict(room.attributes or {})
        room_attrs["status"] = "OCCUPIED"
        room_attrs["guest_id"] = guest_id
        room_attrs["guest_name"] = guest_name
        room.attributes = dict(room_attrs)
        
    # 3. Create Folio Invoice Entity
    invoice_type_id = await _get_entity_type_id(db, real_org_id, "hotel_invoice")
    folio_id = f"ent_{uuid.uuid4().hex[:16]}"
    folio = EntityV2(
        id=folio_id,
        org_id=real_org_id,
        entity_type_id=invoice_type_id,
        display_label=f"Folio - {guest_name} (Room {room_number})",
        attributes={
            "reservation_id": reservation_id,
            "guest_id": guest_id,
            "room_number": room_number,
            "charges": [
                {"description": "Room Charge (Check-in Deposit)", "amount": nightly_rate, "timestamp": datetime.utcnow().isoformat()}
            ],
            "payments": [],
            "balance": nightly_rate,
            "status": "OPEN"
        }
    )
    db.add(folio)
    
    # Link folio to reservation attributes and commit both updates
    res_attrs["folio_id"] = folio_id
    reservation.attributes = dict(res_attrs)
    
    # 4. Ingest check-in observation
    observation_service.record_observation(
        db=db,
        org_id=real_org_id,
        source_channel="frontdesk",
        observation_type="guest_checkin",
        primary_entity_id=guest_id,
        location_label=f"Room {room_number}",
        payload={"room_number": room_number, "reservation_id": reservation_id, "guest_name": guest_name},
        severity="INFO"
    )
    
    await db.commit()
    
    # Trigger AI check-in workflow
    await workflow_engine.trigger_workflow(real_org_id, "guest_checkin", {
        "reservation_id": reservation_id,
        "guest_name": guest_name,
        "room_number": room_number,
        "folio_id": folio_id
    })
    
    return {
        "status": "SUCCESS",
        "message": "Guest checked in successfully",
        "reservation": _entity_to_dict(reservation),
        "folio_id": folio_id
    }


@router.post("/checkout")
async def checkout_guest(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Check-out a guest, verifying folio balance and setting room to dirty."""
    org_id = payload.get("org_id")
    reservation_id = payload.get("reservation_id")
    
    if not org_id or not reservation_id:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'reservation_id'")
        
    real_org_id = await resolve_business_id(org_id)
    res_stmt = select(EntityV2).where(
        EntityV2.id == reservation_id, 
        or_(EntityV2.org_id == real_org_id, EntityV2.org_id == org_id)
    )
    res_result = await db.execute(res_stmt)
    reservation = res_result.scalar_one_or_none()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
        
    res_attrs = dict(reservation.attributes or {})
    if res_attrs.get("status") != "CHECKED_IN":
        raise HTTPException(status_code=400, detail=f"Cannot check out reservation in state: {res_attrs.get('status')}")
        
    guest_id = res_attrs.get("guest_id")
    room_id = res_attrs.get("room_id")
    room_number = res_attrs.get("room_number")
    folio_id = res_attrs.get("folio_id")
    guest_name = res_attrs.get("guest_name", "Valued Guest")
    
    # 1. Verify Folio Balance
    if folio_id:
        folio_stmt = select(EntityV2).where(EntityV2.id == folio_id)
        folio_res = await db.execute(folio_stmt)
        folio = folio_res.scalar_one_or_none()
        if folio:
            folio_attrs = dict(folio.attributes or {})
            balance = float(folio_attrs.get("balance", 0.0))
            if balance > 0.0:
                raise HTTPException(
                    status_code=402, 
                    detail=f"Cannot check out. Guest has an outstanding folio balance of ₦{balance:.2f}. Please process payment first."
                )
            folio_attrs["status"] = "CLOSED"
            folio.attributes = folio_attrs

    # 2. Update Reservation
    res_attrs["status"] = "CHECKED_OUT"
    res_attrs["actual_check_out"] = datetime.utcnow().isoformat()
    reservation.attributes = res_attrs
    
    # 3. Update Room status (Vacant and Dirty)
    room_stmt = select(EntityV2).where(EntityV2.id == room_id)
    room_res = await db.execute(room_stmt)
    room = room_res.scalar_one_or_none()
    if room:
        room_attrs = dict(room.attributes or {})
        room_attrs["status"] = "VACANT"
        room_attrs["housekeeping"] = "Dirty"
        room_attrs["guest_id"] = None
        room_attrs["guest_name"] = None
        room.attributes = room_attrs
        
    # 4. Ingest check-out observation
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="frontdesk",
        observation_type="guest_checkout",
        primary_entity_id=guest_id,
        location_label=f"Room {room_number}",
        payload={"room_number": room_number, "reservation_id": reservation_id, "guest_name": guest_name},
        severity="INFO"
    )
    
    await db.commit()
    
    # Trigger checkout workflow (e.g. notify Housekeeping to clean room)
    await workflow_engine.trigger_workflow(org_id, "guest_checkout", {
        "reservation_id": reservation_id,
        "guest_name": guest_name,
        "room_number": room_number
    })
    
    return {
        "status": "SUCCESS",
        "message": "Guest checked out successfully. Room has been flagged for cleaning.",
        "reservation": _entity_to_dict(reservation)
    }


# --- GUEST FOLIO BILLING ENDPOINTS ---

@router.post("/folios/charge")
async def post_folio_charge(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Post an operational charge (minibar, restaurant checkout, laundry) to a guest folio."""
    org_id = payload.get("org_id")
    folio_id = payload.get("folio_id")
    description = payload.get("description")
    amount = float(payload.get("amount", 0.0))
    
    if not all([org_id, folio_id, description, amount]):
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'folio_id', 'description', 'amount'")
        
    folio_stmt = select(EntityV2).where(EntityV2.id == folio_id, EntityV2.org_id == org_id)
    folio_res = await db.execute(folio_stmt)
    folio = folio_res.scalar_one_or_none()
    
    if not folio:
        raise HTTPException(status_code=404, detail="Folio not found")
        
    folio_attrs = dict(folio.attributes or {})
    charges = list(folio_attrs.get("charges", []))
    charges.append({
        "description": description,
        "amount": amount,
        "timestamp": datetime.utcnow().isoformat()
    })
    folio_attrs["charges"] = charges
    folio_attrs["balance"] = float(folio_attrs.get("balance", 0.0)) + amount
    folio.attributes = folio_attrs
    
    await db.commit()
    await db.refresh(folio)
    return _entity_to_dict(folio)


@router.post("/folios/pay")
async def settle_folio_payment(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Process a payment for guest folio balance settlement."""
    org_id = payload.get("org_id")
    folio_id = payload.get("folio_id")
    amount = float(payload.get("amount", 0.0))
    payment_method = payload.get("payment_method", "Cash")
    
    if not all([org_id, folio_id, amount]):
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'folio_id', 'amount'")
        
    folio_stmt = select(EntityV2).where(EntityV2.id == folio_id, EntityV2.org_id == org_id)
    folio_res = await db.execute(folio_stmt)
    folio = folio_res.scalar_one_or_none()
    
    if not folio:
        raise HTTPException(status_code=404, detail="Folio not found")
        
    folio_attrs = dict(folio.attributes or {})
    payments = list(folio_attrs.get("payments", []))
    payments.append({
        "amount": amount,
        "payment_method": payment_method,
        "timestamp": datetime.utcnow().isoformat()
    })
    folio_attrs["payments"] = payments
    new_balance = max(0.0, float(folio_attrs.get("balance", 0.0)) - amount)
    folio_attrs["balance"] = new_balance
    
    if new_balance == 0.0:
        folio_attrs["status"] = "SETTLED"
        
    folio.attributes = folio_attrs
    
    # Log payment observation
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="accounts",
        observation_type="folio_payment",
        primary_entity_id=folio_attrs.get("guest_id"),
        location_label="Frontdesk Billing Cashier",
        payload={"folio_id": folio_id, "amount_paid": amount, "method": payment_method, "remaining_balance": new_balance},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(folio)
    return _entity_to_dict(folio)


# --- HOUSEKEEPING OPERATIONS ENDPOINTS ---

@router.get("/housekeeping/tasks")
async def list_housekeeping_tasks(
    org_id: str = Query(..., description="Organization ID"),
    property_id: Optional[str] = Query(None, description="Filter by hotel property"),
    db: AsyncSession = Depends(get_db)
):
    """List all dynamic housekeeping clean tasks."""
    type_id = await _get_entity_type_id(db, org_id, "housekeeping_task")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    tasks = res.scalars().all()
    
    output = []
    for t in tasks:
        t_dict = _entity_to_dict(t)
        if property_id and t_dict["attributes"].get("property_id") != property_id:
            continue
        output.append(t_dict)
    return output


@router.post("/housekeeping/tasks", status_code=status.HTTP_201_CREATED)
async def create_housekeeping_task(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Assign/create a room cleaning task."""
    org_id = payload.get("org_id")
    room_number = payload.get("room_number")
    assigned_to = payload.get("assigned_to", "Unassigned")
    priority = int(payload.get("priority", 3)) # 1 (Low) to 5 (Critical)
    property_id = payload.get("property_id")
    
    if not org_id or not room_number:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'room_number'")

    type_id = await _get_entity_type_id(db, org_id, "housekeeping_task")
    task = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Clean Room {room_number}",
        attributes={
            "room_number": room_number,
            "assigned_to": assigned_to,
            "status": "PENDING",
            "priority": priority,
            "notes": payload.get("notes", ""),
            "property_id": property_id,
            "updated_at": datetime.utcnow().isoformat()
        }
    )
    db.add(task)
    
    # Update room housekeeping status to cleaning in progress
    room_type_id = await _get_entity_type_id(db, org_id, "hotel_room")
    room_stmt = select(EntityV2).where(
        EntityV2.org_id == org_id,
        EntityV2.entity_type_id == room_type_id,
        EntityV2.display_label == room_number
    )
    room_res = await db.execute(room_stmt)
    room = room_res.scalar_one_or_none()
    if room:
        room_attrs = dict(room.attributes or {})
        room_attrs["housekeeping"] = "Cleaning"
        room.attributes = room_attrs
        
    await db.commit()
    await db.refresh(task)
    return _entity_to_dict(task)


@router.put("/housekeeping/tasks/{task_id}")
async def update_housekeeping_task(
    task_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Update a housekeeping task's status (PENDING, CLEANING, COMPLETED, INSPECTED)."""
    task_stmt = select(EntityV2).where(EntityV2.id == task_id)
    task_res = await db.execute(task_stmt)
    task = task_res.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task_attrs = dict(task.attributes or {})
    new_status = payload.get("status", task_attrs.get("status"))
    task_attrs.update(payload)
    task_attrs["updated_at"] = datetime.utcnow().isoformat()
    task.attributes = task_attrs
    
    # If completed or inspected, update associated room to Clean
    if new_status in ["COMPLETED", "INSPECTED"]:
        room_number = task_attrs.get("room_number")
        room_type_id = await _get_entity_type_id(db, task.org_id, "hotel_room")
        room_stmt = select(EntityV2).where(
            EntityV2.org_id == task.org_id,
            EntityV2.entity_type_id == room_type_id,
            EntityV2.display_label == room_number
        )
        room_res = await db.execute(room_stmt)
        room = room_res.scalar_one_or_none()
        if room:
            room_attrs = dict(room.attributes or {})
            room_attrs["housekeeping"] = "Clean"
            room.attributes = room_attrs

    await db.commit()
    await db.refresh(task)
    return _entity_to_dict(task)


# --- MAINTENANCE OPERATIONS ENDPOINTS ---

@router.get("/maintenance/tickets")
async def list_maintenance_tickets(
    org_id: str = Query(..., description="Organization ID"),
    property_id: Optional[str] = Query(None, description="Filter by hotel property"),
    db: AsyncSession = Depends(get_db)
):
    """List all dynamic maintenance tickets."""
    type_id = await _get_entity_type_id(db, org_id, "maintenance_ticket")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    tickets = res.scalars().all()
    
    output = []
    for t in tickets:
        t_dict = _entity_to_dict(t)
        if property_id and t_dict["attributes"].get("property_id") != property_id:
            continue
        output.append(t_dict)
    return output


@router.post("/maintenance/tickets", status_code=status.HTTP_201_CREATED)
async def create_maintenance_ticket(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Log a maintenance fault ticket and block the associated room."""
    org_id = payload.get("org_id")
    room_number = payload.get("room_number")
    issue_description = payload.get("issue_description")
    priority = payload.get("priority", "MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    property_id = payload.get("property_id")
    
    if not all([org_id, room_number, issue_description]):
        raise HTTPException(status_code=400, detail="Missing required ticket fields.")
        
    type_id = await _get_entity_type_id(db, org_id, "maintenance_ticket")
    ticket = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Maint Room {room_number}: {issue_description[:30]}",
        attributes={
            "room_number": room_number,
            "issue_description": issue_description,
            "status": "OPEN",
            "priority": priority,
            "assigned_technician": payload.get("assigned_technician", "Unassigned"),
            "notes": payload.get("notes", ""),
            "property_id": property_id,
            "updated_at": datetime.utcnow().isoformat()
        }
    )
    db.add(ticket)
    
    # 2. Block the Room (Set status to OUT_OF_SERVICE)
    room_type_id = await _get_entity_type_id(db, org_id, "hotel_room")
    room_stmt = select(EntityV2).where(
        EntityV2.org_id == org_id,
        EntityV2.entity_type_id == room_type_id,
        EntityV2.display_label == room_number
    )
    room_res = await db.execute(room_stmt)
    room = room_res.scalar_one_or_none()
    if room:
        room_attrs = dict(room.attributes or {})
        room_attrs["status"] = "OUT_OF_SERVICE"
        room.attributes = room_attrs
        
    # Ingest maintenance reported signal
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="maintenance",
        observation_type="maintenance_reported",
        location_label=f"Room {room_number}",
        payload={"room_number": room_number, "issue": issue_description},
        severity="WARNING" if priority in ["HIGH", "CRITICAL"] else "INFO"
    )
    
    await db.commit()
    
    # Trigger maintenance workflow
    await workflow_engine.trigger_workflow(org_id, "maintenance_reported", {
        "room_number": room_number,
        "issue": issue_description,
        "priority": priority
    })
    
    await db.refresh(ticket)
    return _entity_to_dict(ticket)


@router.put("/maintenance/tickets/{ticket_id}")
async def update_maintenance_ticket(
    ticket_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Update a maintenance ticket. If RESOLVED, unblock the associated room."""
    ticket_stmt = select(EntityV2).where(EntityV2.id == ticket_id)
    ticket_res = await db.execute(ticket_stmt)
    ticket = ticket_res.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket_attrs = dict(ticket.attributes or {})
    old_status = ticket_attrs.get("status")
    new_status = payload.get("status", old_status)
    ticket_attrs.update(payload)
    ticket_attrs["updated_at"] = datetime.utcnow().isoformat()
    ticket.attributes = ticket_attrs
    
    # If resolved, set associated room to VACANT
    if old_status != "RESOLVED" and new_status == "RESOLVED":
        room_number = ticket_attrs.get("room_number")
        room_type_id = await _get_entity_type_id(db, ticket.org_id, "hotel_room")
        room_stmt = select(EntityV2).where(
            EntityV2.org_id == ticket.org_id,
            EntityV2.entity_type_id == room_type_id,
            EntityV2.display_label == room_number
        )
        room_res = await db.execute(room_stmt)
        room = room_res.scalar_one_or_none()
        if room:
            room_attrs = dict(room.attributes or {})
            room_attrs["status"] = "VACANT"
            room.attributes = room_attrs

    await db.commit()
    await db.refresh(ticket)
    return _entity_to_dict(ticket)


# --- RESTAURANT POS OPERATIONS ENDPOINTS ---

@router.get("/restaurant/orders")
async def list_restaurant_orders(
    org_id: str = Query(..., description="Organization ID"),
    property_id: Optional[str] = Query(None, description="Filter by hotel property"),
    db: AsyncSession = Depends(get_db)
):
    """List restaurant/bar order tickets."""
    type_id = await _get_entity_type_id(db, org_id, "restaurant_order")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    orders = res.scalars().all()
    
    output = []
    for o in orders:
        o_dict = _entity_to_dict(o)
        if property_id and o_dict["attributes"].get("property_id") != property_id:
            continue
        output.append(o_dict)
    return output


@router.post("/restaurant/orders", status_code=status.HTTP_201_CREATED)
async def create_restaurant_order(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Create a new restaurant POS food/beverage order."""
    org_id = payload.get("org_id")
    table_number = payload.get("table_number", "Bar")
    items = payload.get("items", []) # List of dict: {name, qty, price}
    property_id = payload.get("property_id")
    
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing parameter 'org_id'")

    total_amount = sum(float(item.get("price", 0.0)) * int(item.get("qty", 1)) for item in items)
    type_id = await _get_entity_type_id(db, org_id, "restaurant_order")
    order = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Order Table {table_number}",
        attributes={
            "table_number": table_number,
            "items": items,
            "total_amount": total_amount,
            "status": "PENDING",
            "payment_status": "UNPAID",
            "property_id": property_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return _entity_to_dict(order)


@router.post("/restaurant/orders/{order_id}/room-charge")
async def post_order_to_room_charge(
    order_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Charges a POS order ticket bill directly to an active checked-in guest's room folio."""
    org_id = payload.get("org_id")
    room_number = payload.get("room_number")
    
    if not org_id or not room_number:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'room_number'")

    # 1. Resolve order
    order_stmt = select(EntityV2).where(EntityV2.id == order_id, EntityV2.org_id == org_id)
    order_res = await db.execute(order_stmt)
    order = order_res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order ticket not found")

    order_attrs = dict(order.attributes or {})
    total_amount = float(order_attrs.get("total_amount", 0.0))

    # 2. Find active checked-in reservation in this room
    res_type_id = await _get_entity_type_id(db, org_id, "hotel_reservation")
    res_stmt = select(EntityV2).where(
        EntityV2.org_id == org_id,
        EntityV2.entity_type_id == res_type_id
    )
    res_result = await db.execute(res_stmt)
    reservations = res_result.scalars().all()
    
    target_res = None
    for r in reservations:
        if r.attributes.get("room_number") == room_number and r.attributes.get("status") == "CHECKED_IN":
            target_res = r
            break
            
    if not target_res:
        raise HTTPException(
            status_code=404, 
            detail=f"No checked-in guest registered in room {room_number} to post POS order charge."
        )

    folio_id = target_res.attributes.get("folio_id")
    if not folio_id:
        raise HTTPException(status_code=400, detail="Checked-in reservation lacks a guest folio ID link.")

    # 3. Post charge to folio EAV attributes
    folio_stmt = select(EntityV2).where(EntityV2.id == folio_id)
    folio_res = await db.execute(folio_stmt)
    folio = folio_res.scalar_one_or_none()
    if not folio:
        raise HTTPException(status_code=404, detail="Guest folio not found")
        
    folio_attrs = dict(folio.attributes or {})
    charges = list(folio_attrs.get("charges", []))
    charges.append({
        "description": f"Restaurant Order (Table {order_attrs.get('table_number')})",
        "amount": total_amount,
        "timestamp": datetime.utcnow().isoformat()
    })
    folio_attrs["charges"] = charges
    folio_attrs["balance"] = float(folio_attrs.get("balance", 0.0)) + total_amount
    folio.attributes = folio_attrs

    # 4. Mark POS order payment status
    order_attrs["payment_status"] = "ROOM_CHARGE"
    order_attrs["status"] = "COMPLETED"
    order_attrs["folio_id"] = folio_id
    order.attributes = order_attrs

    # Log food order signal in Observation Bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="restaurant_pos",
        observation_type="pos_room_charge",
        primary_entity_id=folio_attrs.get("guest_id"),
        location_label=f"Table {order_attrs.get('table_number')} ➔ Room {room_number}",
        payload={"room_number": room_number, "order_id": order_id, "amount": total_amount},
        severity="INFO"
    )

    await db.commit()
    return {"status": "SUCCESS", "message": f"POS charge of ₦{total_amount} posted to Room {room_number}."}


@router.post("/restaurant/orders/{order_id}/settle-direct")
async def settle_restaurant_order_direct(
    order_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Settles a POS order ticket immediately via direct payment (Cash, Card, or Transfer)."""
    org_id = payload.get("org_id")
    payment_method = payload.get("payment_method", "CASH") # CASH, CARD, TRANSFER
    
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing parameter 'org_id'")

    # 1. Resolve order
    order_stmt = select(EntityV2).where(EntityV2.id == order_id, EntityV2.org_id == org_id)
    order_res = await db.execute(order_stmt)
    order = order_res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order ticket not found")

    order_attrs = dict(order.attributes or {})
    total_amount = float(order_attrs.get("total_amount", 0.0))

    # 2. Mark POS order payment status
    order_attrs["payment_status"] = "PAID"
    order_attrs["status"] = "COMPLETED"
    order_attrs["payment_method"] = payment_method.upper()
    order.attributes = order_attrs

    # Log POS direct payment signal in Observation Bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="restaurant_pos",
        observation_type="pos_direct_payment",
        primary_entity_id=order_id,
        location_label=f"Table {order_attrs.get('table_number')}",
        payload={"order_id": order_id, "amount": total_amount, "payment_method": payment_method},
        severity="INFO"
    )

    await db.commit()
    return {"status": "SUCCESS", "message": f"POS order settled via direct {payment_method}."}


# --- INVENTORY OPERATIONS ENDPOINTS ---

@router.get("/inventory")
async def list_inventory_skus(
    org_id: str = Query(..., description="Organization ID"),
    property_id: Optional[str] = Query(None, description="Filter by hotel property"),
    db: AsyncSession = Depends(get_db)
):
    """List hotel inventory SKUs (minibar, kitchen, laundry)."""
    type_id = await _get_entity_type_id(db, org_id, "hotel_inventory")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    skus = res.scalars().all()
    
    output = []
    for s in skus:
        s_dict = _entity_to_dict(s)
        if property_id and s_dict["attributes"].get("property_id") != property_id:
            continue
        output.append(s_dict)
    return output


@router.post("/inventory", status_code=status.HTTP_201_CREATED)
async def create_inventory_sku(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Register a new inventory SKU profile."""
    org_id = payload.get("org_id")
    sku_name = payload.get("sku_name")
    stock_level = int(payload.get("stock_level", 0))
    alert_threshold = int(payload.get("alert_threshold", 5))
    property_id = payload.get("property_id")
    
    if not org_id or not sku_name:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'sku_name'")

    type_id = await _get_entity_type_id(db, org_id, "hotel_inventory")
    sku = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=sku_name,
        attributes={
            "sku_name": sku_name,
            "stock_level": stock_level,
            "alert_threshold": alert_threshold,
            "supplier": payload.get("supplier", "General Store"),
            "cost_price": float(payload.get("cost_price", 0.0)),
            "unit": payload.get("unit", "pcs"),
            "property_id": property_id
        }
    )
    db.add(sku)
    await db.commit()
    await db.refresh(sku)
    return _entity_to_dict(sku)


@router.put("/inventory/{sku_id}/stock")
async def update_inventory_stock(
    sku_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Adjust inventory stock count. Triggers warnings if stock drops below threshold."""
    org_id = payload.get("org_id")
    stock_change = int(payload.get("stock_change", 0))
    
    sku_stmt = select(EntityV2).where(EntityV2.id == sku_id)
    sku_res = await db.execute(sku_stmt)
    sku = sku_res.scalar_one_or_none()
    
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
        
    sku_attrs = dict(sku.attributes or {})
    current_stock = int(sku_attrs.get("stock_level", 0))
    new_stock = max(0, current_stock + stock_change)
    sku_attrs["stock_level"] = new_stock
    sku.attributes = sku_attrs
    
    # Check alert threshold
    threshold = int(sku_attrs.get("alert_threshold", 5))
    if new_stock < threshold:
        observation_service.record_observation(
            db=db,
            org_id=sku.org_id,
            source_channel="store",
            observation_type="low_stock_warning",
            payload={"sku_name": sku.display_label, "stock_level": new_stock, "threshold": threshold},
            severity="WARNING"
        )
        
    await db.commit()
    await db.refresh(sku)
    return _entity_to_dict(sku)


# --- FINANCIAL REPORTING ANALYTICS ---

@router.get("/finance/reports")
async def get_financial_reports(
    org_id: str = Query(..., description="Organization ID"),
    property_id: Optional[str] = Query(None, description="Filter by hotel property"),
    db: AsyncSession = Depends(get_db)
):
    """Calculate ADR, RevPAR, and total revenue performance statistics dynamically."""
    room_type_id = await _get_entity_type_id(db, org_id, "hotel_room")
    res_type_id = await _get_entity_type_id(db, org_id, "hotel_reservation")
    
    # 1. Fetch count of rooms
    room_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == room_type_id)
    room_res = await db.execute(room_stmt)
    rooms = room_res.scalars().all()
    
    filtered_rooms = [r for r in rooms if not property_id or r.attributes.get("property_id") == property_id]
    total_rooms = max(1, len(filtered_rooms))
    
    # 2. Fetch reservations to count active occupied rooms
    res_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == res_type_id)
    res_result = await db.execute(res_stmt)
    reservations = res_result.scalars().all()
    
    occupied_count = 0
    total_room_revenue = 0.0
    for r in reservations:
        r_attrs = dict(r.attributes or {})
        if property_id and r_attrs.get("property_id") != property_id:
            continue
        if r_attrs.get("status") == "CHECKED_IN":
            occupied_count += 1
            total_room_revenue += float(r_attrs.get("nightly_rate", 150.0))
            
    occupancy_rate = (occupied_count / total_rooms) * 100.0
    adr = (total_room_revenue / occupied_count) if occupied_count > 0 else 0.0
    revpar = (total_room_revenue / total_rooms)
    
    # Fetch invoice stats for total billing revenue
    invoice_type_id = await _get_entity_type_id(db, org_id, "hotel_invoice")
    inv_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == invoice_type_id)
    inv_res = await db.execute(inv_stmt)
    invoices = inv_res.scalars().all()
    
    total_billing_collected = 0.0
    for inv in invoices:
        inv_attrs = dict(inv.attributes or {})
        if property_id and inv_attrs.get("property_id") != property_id:
            continue
        payments = inv_attrs.get("payments", [])
        total_billing_collected += sum(float(p.get("amount", 0.0)) for p in payments)

    return {
        "occupancy_rate": f"{occupancy_rate:.1f}%",
        "occupied_rooms": occupied_count,
        "total_rooms": total_rooms,
        "average_daily_rate": adr,
        "revpar": revpar,
        "total_room_revenue": total_room_revenue,
        "total_collected": total_billing_collected,
        "timestamp": datetime.utcnow().isoformat()
    }


# --- TYPE A INTEGRATIONS & CONNECTOR ENDPOINTS ---

@router.post("/integrations/webhook")
async def receive_external_webhook(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Webhook receiver to ingest and normalize bookings from Opera or Mews systems."""
    org_id = payload.get("org_id")
    property_id = payload.get("property_id")
    event_type = payload.get("event_type")      # e.g., BOOKING_CREATED, CHECK_IN, CHECK_OUT
    external_system = payload.get("source", "Opera") # Opera, Mews
    data = payload.get("data", {})
    
    if not org_id or not event_type:
        raise HTTPException(status_code=400, detail="Missing required webhook parameters: 'org_id', 'event_type'")

    # Extract standard fields from system-specific layout
    guest_name = data.get("guestFullName") or data.get("guest_name") or "External Guest"
    room_number = data.get("assignedRoomNumber") or data.get("room_number") or data.get("room") or "TBD"
    check_in = data.get("arrivalDate") or data.get("check_in_date") or data.get("check_in") or datetime.utcnow().date().isoformat()
    check_out = data.get("departureDate") or data.get("check_out_date") or data.get("check_out") or (datetime.utcnow() + timedelta(days=1)).date().isoformat()
    rate = float(data.get("dailyRate") or data.get("nightly_rate") or data.get("rate") or 150.0)

    booking_id = None

    # Re-use our core reservation flow or simulate check-in state machines based on event
    if event_type == "BOOKING_CREATED":
        # Create booking dynamically
        type_id = await _get_entity_type_id(db, org_id, "hotel_reservation")
        booking_id = f"ent_{uuid.uuid4().hex[:16]}"
        booking = EntityV2(
            id=booking_id,
            org_id=org_id,
            entity_type_id=type_id,
            display_label=f"Res: {guest_name} - Room {room_number}",
            attributes={
                "guest_name": guest_name,
                "room_number": room_number,
                "check_in_date": check_in,
                "check_out_date": check_out,
                "status": "RESERVED",
                "nightly_rate": rate,
                "booking_source": external_system,
                "property_id": property_id
            }
        )
        db.add(booking)
        
    elif event_type in ["CHECK_IN", "CHECK_OUT"]:
        # Find booking and toggle state
        type_id = await _get_entity_type_id(db, org_id, "hotel_reservation")
        stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
        res = await db.execute(stmt)
        reservations = res.scalars().all()
        
        target = None
        for r in reservations:
            if r.attributes.get("room_number") == room_number and r.attributes.get("guest_name") == guest_name:
                target = r
                break
                
        if target:
            booking_id = target.id
            attrs = dict(target.attributes or {})
            attrs["status"] = "CHECKED_IN" if event_type == "CHECK_IN" else "CHECKED_OUT"
            target.attributes = dict(attrs)
            
            # If checkin, update room occupancy
            if event_type == "CHECK_IN":
                room_type_id = await _get_entity_type_id(db, org_id, "hotel_room")
                room_stmt = select(EntityV2).where(
                    EntityV2.org_id == org_id,
                    EntityV2.entity_type_id == room_type_id,
                    EntityV2.display_label == room_number
                )
                room_res = await db.execute(room_stmt)
                room = room_res.scalar_one_or_none()
                if room:
                    room_attrs = dict(room.attributes or {})
                    room_attrs["status"] = "OCCUPIED"
                    room.attributes = dict(room_attrs)

    # Log observation signal indicating external webhook integration completed
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="external_pms_webhook",
        observation_type="connector_signal_received",
        primary_entity_id=booking_id,
        location_label=f"External {external_system} Link",
        payload={"event_type": event_type, "guest_name": guest_name, "room": room_number},
        severity="INFO"
    )

    await db.commit()
    return {"status": "SUCCESS", "message": f"Webhook event '{event_type}' processed and normalized."}


@router.post("/integrations/csv-import")
async def import_csv_reservations(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Ingest, parse and batch create reservations from CSV row data."""
    org_id = payload.get("org_id")
    property_id = payload.get("property_id")
    rows = payload.get("csv_rows", [])
    
    if not org_id or not rows:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'csv_rows'")

    type_id = await _get_entity_type_id(db, org_id, "hotel_reservation")
    count = 0
    
    for row in rows:
        guest_name = row.get("Guest Name") or row.get("guest_name")
        room_number = str(row.get("Room Number") or row.get("room_number"))
        check_in = row.get("Check-in Date") or row.get("check_in")
        check_out = row.get("Check-out Date") or row.get("check_out")
        rate = float(row.get("Rate") or row.get("rate", 150.0))
        
        if not all([guest_name, room_number, check_in, check_out]):
            continue
            
        booking = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=f"Res: {guest_name} - Room {room_number}",
            attributes={
                "guest_name": guest_name,
                "room_number": room_number,
                "check_in_date": check_in,
                "check_out_date": check_out,
                "status": "RESERVED",
                "nightly_rate": rate,
                "booking_source": "CSV Importer",
                "property_id": property_id
            }
        )
        db.add(booking)
        count += 1

    # Log observation
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="csv_connector",
        observation_type="connector_csv_imported",
        location_label="PMS Batch File Import",
        payload={"processed_rows": count},
        severity="INFO"
    )

    await db.commit()
    return {"status": "SUCCESS", "message": f"Successfully parsed and imported {count} booking rows."}


@router.post("/integrations/email-parser")
async def parse_email_booking(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Uses regular expressions to extract reservation metadata from raw HTML/Plain confirmation email bodies."""
    org_id = payload.get("org_id")
    property_id = payload.get("property_id")
    email_body = payload.get("email_body", "")
    
    if not org_id or not email_body:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'email_body'")

    # Extract fields via regex patterns
    guest_match = re.search(r"Guest:\s*(.*)", email_body, re.IGNORECASE)
    room_match = re.search(r"Room:\s*(?:Room)?\s*(\w+)", email_body, re.IGNORECASE)
    check_in_match = re.search(r"Check-in:\s*([\d-]+)", email_body, re.IGNORECASE)
    check_out_match = re.search(r"Check-out:\s*([\d-]+)", email_body, re.IGNORECASE)
    rate_match = re.search(r"Rate:\s*([\d,]+)\s*(?:NGN|USD)?", email_body, re.IGNORECASE)

    if not all([guest_match, room_match, check_in_match, check_out_match]):
        raise HTTPException(
            status_code=422, 
            detail="Failed to parse booking details from the email text. Ensure fields follow the format: 'Guest: ...', 'Room: ...', 'Check-in: ...', 'Check-out: ...'"
        )

    guest_name = guest_match.group(1).strip()
    room_number = room_match.group(1).strip()
    check_in = check_in_match.group(1).strip()
    check_out = check_out_match.group(1).strip()
    rate = float(rate_match.group(1).replace(",", "").strip()) if rate_match else 150.0

    # Create Reservation
    type_id = await _get_entity_type_id(db, org_id, "hotel_reservation")
    booking = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Res: {guest_name} - Room {room_number}",
        attributes={
            "guest_name": guest_name,
            "room_number": room_number,
            "check_in_date": check_in,
            "check_out_date": check_out,
            "status": "RESERVED",
            "nightly_rate": rate,
            "booking_source": "Email Parser",
            "property_id": property_id
        }
    )
    db.add(booking)
    
    # Log observation
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="email_parser",
        observation_type="connector_email_parsed",
        location_label="Booking Email Ingest",
        payload={"guest": guest_name, "room": room_number, "rate": rate},
        severity="INFO"
    )

    await db.commit()
    await db.refresh(booking)
    return {
        "status": "SUCCESS", 
        "message": f"Successfully parsed confirmation for {guest_name} and reserved Room {room_number}.",
        "booking": _entity_to_dict(booking)
    }


