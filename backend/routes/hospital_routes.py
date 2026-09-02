"""
InteracAI Hospital & Healthcare REST API Router.
Defines endpoints for clinical EMR workspace, pharmacy dispensing, billing POS,
ward bed occupancy, ICU telemetry, ambulance tracking, FHIR/HL7 integrations, and security alerts.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, List, Optional
import uuid
import logging
from datetime import datetime, timedelta

from database.session import get_db
from database.models.dynamic_entity import EntityType, EntityV2
from services.observation_service import observation_service
from services.workflow_engine import workflow_engine
from services.auth_service import require_permission, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/hospital", tags=["Healthcare Operations"])


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
    """Helper to resolve EntityType ID from its string code for hospital module."""
    stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == code)
    res = await db.execute(stmt)
    et = res.scalar_one_or_none()
    if not et:
        # Create dynamically if missing
        et = EntityType(
            id=f"et_{uuid.uuid4().hex[:12]}",
            org_id=org_id,
            module_id="module_hospital",
            code=code,
            display_name=code.replace("hospital_", "").replace("_", " ").title(),
            schema_definition={}
        )
        db.add(et)
        await db.commit()
        await db.refresh(et)
    return et.id


# --- 1. PATIENT REGISTRATION ---

@router.get("/patients")
async def list_patients(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.patients.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    patients = res.scalars().all()
    return [_entity_to_dict(p) for p in patients]


@router.post("/patients", status_code=status.HTTP_201_CREATED)
async def register_patient(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.patients.create"))
):
    org_id = payload.get("org_id")
    name = payload.get("name")
    national_id = payload.get("national_id", "")
    insurance_policy = payload.get("insurance_policy", "")
    insurance_provider = payload.get("insurance_provider", "")
    emergency_contact = payload.get("emergency_contact", "")
    medical_history = payload.get("medical_history", "")
    allergies = payload.get("allergies", [])
    
    if not org_id or not name:
        raise HTTPException(status_code=400, detail="Missing required patient registration fields.")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
    patient_id = f"PAT-{Math_rand()}"
    
    p = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=name,
        attributes={
            "patient_id": patient_id,
            "national_id": national_id,
            "insurance_policy": insurance_policy,
            "insurance_provider": insurance_provider,
            "emergency_contact": emergency_contact,
            "medical_history": medical_history,
            "allergies": allergies,
            "photo_url": payload.get("photo_url", f"https://api.dicebear.com/7.x/adventurer/svg?seed={name}"),
            "qr_code_ref": f"QR-PAT-{uuid.uuid4().hex[:8].upper()}",
            "triage_level": "Normal",
            "registered_at": datetime.utcnow().isoformat()
        }
    )
    db.add(p)
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="reception",
        observation_type="patient_checkin",
        primary_entity_id=p.id,
        location_label="Triage Reception",
        payload={"patient_id": patient_id, "name": name, "triage_level": "Normal"},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(p)
    return _entity_to_dict(p)


@router.post("/patients/photo-capture")
async def photo_capture(payload: Dict[str, Any]):
    # Simulator photo capture endpoint
    name = payload.get("name", "Unknown Patient")
    return {
        "status": "SUCCESS",
        "photo_url": f"https://api.dicebear.com/7.x/adventurer/svg?seed={name}"
    }


# --- 2. APPOINTMENTS ---

@router.get("/appointments")
async def list_appointments(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.appointments.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_appointment")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    appts = res.scalars().all()
    return [_entity_to_dict(a) for a in appts]


@router.post("/appointments", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.appointments.create"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    doctor_id = payload.get("doctor_id", "doc_yusuf")
    doctor_name = payload.get("doctor_name", "Dr. Amina Yusuf")
    scheduled_time = payload.get("scheduled_time", datetime.utcnow().isoformat())
    department = payload.get("department", "General Outpatient")
    visit_type = payload.get("visit_type", "Walk-in") # Walk-in, Scheduled, Emergency
    
    if not org_id or not patient_name:
        raise HTTPException(status_code=400, detail="Missing required parameters")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_appointment")
    
    appt = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Appointment - {patient_name} with {doctor_name}",
        attributes={
            "patient_id": patient_id,
            "patient_name": patient_name,
            "doctor_id": doctor_id,
            "doctor_name": doctor_name,
            "scheduled_time": scheduled_time,
            "department": department,
            "visit_type": visit_type,
            "status": "BOOKED",
            "reminders_sent": False
        }
    )
    db.add(appt)
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="reception",
        observation_type="appointment_booked",
        primary_entity_id=appt.id,
        location_label=f"{department} Clinic",
        payload={"patient_name": patient_name, "doctor_name": doctor_name, "time": scheduled_time},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(appt)
    
    # Trigger reminder sync
    await workflow_engine.trigger_workflow(org_id, "appointment_booked", {
        "appointment_id": appt.id,
        "patient_name": patient_name,
        "doctor_name": doctor_name,
        "time": scheduled_time
    })
    
    return _entity_to_dict(appt)


@router.post("/appointments/reminders")
async def trigger_reminders(payload: Dict[str, Any]):
    # Trigger SMS/WhatsApp reminder simulator
    return {
        "status": "SUCCESS",
        "reminders_dispatched": 1,
        "channel": "WhatsApp & SMS",
        "recipient": payload.get("phone", "+2348030000000"),
        "message": "Friendly reminder of your appointment at InteracAI Specialist Hospital."
    }


# --- 3. ELECTRONIC MEDICAL RECORDS (EMR) ---

@router.get("/emr")
async def get_emr_records(
    org_id: str = Query(..., description="Organization ID"),
    patient_id: Optional[str] = Query(None, description="Patient Entity ID filter"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.emr.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_emr")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    emrs = res.scalars().all()
    
    output = []
    for e in emrs:
        e_dict = _entity_to_dict(e)
        if patient_id and e_dict["attributes"].get("patient_id") != patient_id:
            continue
        output.append(e_dict)
    return output


@router.post("/emr", status_code=status.HTTP_201_CREATED)
async def create_emr_record(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.emr.create"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    diagnoses = payload.get("diagnoses", "General Consultation")
    notes = payload.get("notes", "")
    vitals = payload.get("vitals", {})
    prescriptions = payload.get("prescriptions", [])
    lab_requests = payload.get("lab_requests", [])
    radiology_requests = payload.get("radiology_requests", [])
    surgery_notes = payload.get("surgery_notes", "")
    
    if not org_id or not patient_id:
        raise HTTPException(status_code=400, detail="Missing required EMR payload values.")
        
    # Check patient allergies against prescribed drugs
    pat_type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
    pat_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == pat_type_id, EntityV2.id == patient_id)
    pat_res = await db.execute(pat_stmt)
    patient_entity = pat_res.scalar_one_or_none()
    
    if patient_entity and patient_entity.attributes:
        patient_allergies = patient_entity.attributes.get("allergies", [])
        if isinstance(patient_allergies, str):
            patient_allergies = [patient_allergies]
        for rx in prescriptions:
            rx_name = rx.get("drug_name", "").lower()
            for allergy in patient_allergies:
                if allergy.lower() in rx_name or rx_name in allergy.lower():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Allergy Warning: Patient has a recorded allergy to {allergy}. Cannot prescribe {rx.get('drug_name')}."
                    )
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_emr")
    
    emr = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Clinical Summary - {patient_name} ({diagnoses})",
        attributes={
            "patient_id": patient_id,
            "patient_name": patient_name,
            "doctor_id": current_user.get("id", "doc_yusuf"),
            "doctor_name": current_user.get("email", "Dr. Amina Yusuf"),
            "diagnoses": diagnoses,
            "notes": notes,
            "vitals": vitals,
            "prescriptions": prescriptions,
            "lab_requests": lab_requests,
            "radiology_requests": radiology_requests,
            "surgery_notes": surgery_notes,
            "recorded_at": datetime.utcnow().isoformat()
        }
    )
    db.add(emr)
    
    # Post observations
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="clinical",
        observation_type="doctor_consultation",
        primary_entity_id=patient_id,
        location_label="Consultation Room 3",
        payload={"diagnoses": diagnoses, "doctor": current_user.get("email")},
        severity="INFO"
    )
    
    # Check if vitals are critical
    sys_bp = float(vitals.get("systolic", 120))
    dia_bp = float(vitals.get("diastolic", 80))
    hr = float(vitals.get("heart_rate", 75))
    spo2 = float(vitals.get("spo2", 98))
    
    if sys_bp > 160 or dia_bp > 100 or hr > 110 or spo2 < 90:
        observation_service.record_observation(
            db=db,
            org_id=org_id,
            source_channel="clinical",
            observation_type="vitals_changed",
            primary_entity_id=patient_id,
            location_label="Consultation Room 3",
            payload={"systolic": sys_bp, "diastolic": dia_bp, "heart_rate": hr, "spo2": spo2},
            severity="CRITICAL",
            risk_impact=0.45
        )
        
    await db.commit()
    await db.refresh(emr)
    return _entity_to_dict(emr)


# --- 4. NURSING DASHBOARD ---

@router.get("/nursing/logs")
async def list_nursing_logs(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.nursing.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_nursing_log")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return [_entity_to_dict(l) for l in logs]


@router.post("/nursing/logs")
async def create_nursing_log(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.nursing.write"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    action_taken = payload.get("action_taken") # Rounds, Administer Meds, Shift Handover
    vitals = payload.get("vitals", {})
    notes = payload.get("notes", "")
    
    if not org_id or not patient_id or not action_taken:
        raise HTTPException(status_code=400, detail="Missing nursing log parameters.")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_nursing_log")
    
    log = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Nurse Round - {patient_name} ({action_taken})",
        attributes={
            "patient_id": patient_id,
            "patient_name": patient_name,
            "action_taken": action_taken,
            "vitals": vitals,
            "notes": notes,
            "recorded_by": current_user.get("email", "Staff Nurse"),
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    db.add(log)
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="nursing",
        observation_type="vitals_changed",
        primary_entity_id=patient_id,
        location_label="Ward Block B",
        payload={"vitals": vitals, "nurse": current_user.get("email")},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(log)
    return _entity_to_dict(log)


# --- 5. PHARMACY ---

@router.get("/pharmacy/inventory")
async def list_pharmacy_inventory(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.pharmacy.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_medicine")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    inventory = res.scalars().all()
    
    # If empty, pre-populate default inventory list
    if not inventory:
        inventory = await _provision_default_pharmacy(db, org_id, type_id)
        
    return [_entity_to_dict(i) for i in inventory]


@router.post("/pharmacy/inventory")
async def add_medicine_stock(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.pharmacy.manage"))
):
    org_id = payload.get("org_id")
    drug_name = payload.get("drug_name")
    qty = int(payload.get("qty", 0))
    min_alert_stock = int(payload.get("min_alert_stock", 20))
    expiry_date = payload.get("expiry_date", "2027-12-31")
    supplier = payload.get("supplier", "Emzor Pharmaceuticals")
    
    if not org_id or not drug_name:
        raise HTTPException(status_code=400, detail="Missing required stock values.")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_medicine")
    
    stmt = select(EntityV2).where(
        EntityV2.org_id == org_id,
        EntityV2.entity_type_id == type_id,
        EntityV2.display_label == drug_name
    )
    res = await db.execute(stmt)
    med = res.scalar_one_or_none()
    
    if med:
        attrs = dict(med.attributes or {})
        attrs["qty"] = int(attrs.get("qty", 0)) + qty
        attrs["expiry_date"] = expiry_date
        attrs["supplier"] = supplier
        med.attributes = attrs
    else:
        med = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=drug_name,
            attributes={
                "qty": qty,
                "min_alert_stock": min_alert_stock,
                "expiry_date": expiry_date,
                "supplier": supplier,
                "controlled_substance": payload.get("controlled_substance", False)
            }
        )
        db.add(med)
        
    await db.commit()
    await db.refresh(med)
    return _entity_to_dict(med)


@router.post("/pharmacy/dispense")
async def dispense_medicine(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.pharmacy.manage"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name", "Walk-in Patient")
    drug_name = payload.get("drug_name")
    qty = int(payload.get("qty", 1))
    prescription_id = payload.get("prescription_id", "")
    
    if not org_id or not drug_name:
        raise HTTPException(status_code=400, detail="Missing drug selection.")
        
    # Check patient allergies before dispensing
    if patient_id:
        pat_type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
        pat_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == pat_type_id, EntityV2.id == patient_id)
        pat_res = await db.execute(pat_stmt)
        patient_entity = pat_res.scalar_one_or_none()
        
        if patient_entity and patient_entity.attributes:
            patient_allergies = patient_entity.attributes.get("allergies", [])
            if isinstance(patient_allergies, str):
                patient_allergies = [patient_allergies]
            for allergy in patient_allergies:
                if allergy.lower() in drug_name.lower() or drug_name.lower() in allergy.lower():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Dispensation Blocked: Patient has a recorded allergy to {allergy}. Cannot dispense {drug_name}."
                    )
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_medicine")
    stmt = select(EntityV2).where(
        EntityV2.org_id == org_id,
        EntityV2.entity_type_id == type_id,
        EntityV2.display_label == drug_name
    )
    res = await db.execute(stmt)
    med = res.scalar_one_or_none()
    
    if not med:
        raise HTTPException(status_code=404, detail="Drug not found in inventory catalog.")
        
    attrs = dict(med.attributes or {})
    current_qty = int(attrs.get("qty", 0))
    
    if current_qty < qty:
        raise HTTPException(status_code=400, detail=f"Insufficient pharmacy stock: {current_qty} remaining.")
        
    attrs["qty"] = current_qty - qty
    med.attributes = attrs
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="pharmacy",
        observation_type="medicine_dispensed",
        primary_entity_id=patient_id,
        location_label="Pharmacy Dispensation B",
        payload={"drug_dispensed": drug_name, "quantity": qty, "patient_name": patient_name, "prescription_id": prescription_id},
        severity="INFO"
    )
    
    # Check low stock alerts
    if attrs["qty"] <= int(attrs.get("min_alert_stock", 20)):
        observation_service.record_observation(
            db=db,
            org_id=org_id,
            source_channel="pharmacy",
            observation_type="medicine_shortage_alert",
            primary_entity_id=med.id,
            location_label="Pharmacy Store",
            payload={"drug_name": drug_name, "remaining_qty": attrs["qty"]},
            severity="WARNING"
        )
        
    await db.commit()
    return {
        "status": "SUCCESS",
        "dispensed_qty": qty,
        "remaining_qty": attrs["qty"],
        "drug_name": drug_name
    }


@router.get("/pharmacy/predict-demand")
async def predict_pharmacy_demand(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db)
):
    from database.models.observation import ObservationV2
    
    # 1. Fetch current medicine stock
    med_type_id = await _get_entity_type_id(db, org_id, "hospital_medicine")
    med_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == med_type_id)
    med_res = await db.execute(med_stmt)
    medicines = med_res.scalars().all()
    
    med_stock_map = {}
    for m in medicines:
        med_stock_map[m.display_label] = float(m.attributes.get("qty", 0.0))
        
    # 2. Query actual medicine_dispensed observations
    stmt = select(ObservationV2).where(
        ObservationV2.org_id == org_id,
        ObservationV2.observation_type == "medicine_dispensed"
    )
    res = await db.execute(stmt)
    observations = res.scalars().all()
    
    demand = {}
    for obs in observations:
        payload = obs.payload or {}
        drug = payload.get("drug_name")
        qty = float(payload.get("quantity_dispensed", 1.0))
        if drug:
            demand[drug] = demand.get(drug, 0.0) + qty
            
    predicted = []
    for drug, total_qty in demand.items():
        expected_7d = total_qty
        stock = med_stock_map.get(drug, 0.0)
        risk = "HIGH" if stock < expected_7d else "LOW"
        predicted.append({
            "drug": drug,
            "expected_dispense_7d": expected_7d,
            "shortage_risk": risk,
            "lead_time_days": 3
        })
        
    return {"predicted_high_demand_skus": predicted}


# Helper to auto-create standard medicines
async def _provision_default_pharmacy(db: AsyncSession, org_id: str, type_id: str) -> List[EntityV2]:
    defaults = [
        {"name": "Paracetamol IV Infusion", "qty": 14, "min": 20, "controlled": False},
        {"name": "Amoxicillin 500mg Caps", "qty": 150, "min": 30, "controlled": False},
        {"name": "Artemether Lumefantrine", "qty": 75, "min": 20, "controlled": False},
        {"name": "Metformin 500mg Tab", "qty": 200, "min": 40, "controlled": False},
        {"name": "Morphine 10mg Ampoule", "qty": 25, "min": 10, "controlled": True},
        {"name": "Diazepam 5mg Tab", "qty": 12, "min": 15, "controlled": True}
    ]
    meds = []
    for d in defaults:
        med = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=d["name"],
            attributes={
                "qty": d["qty"],
                "min_alert_stock": d["min"],
                "expiry_date": "2027-12-31",
                "supplier": "Emzor Pharmaceuticals",
                "controlled_substance": d["controlled"]
            }
        )
        db.add(med)
        meds.append(med)
    await db.commit()
    return meds


# --- 6. LABORATORY ---

@router.get("/laboratory/tests")
async def list_lab_tests(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.laboratory.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_lab_test")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    tests = res.scalars().all()
    return [_entity_to_dict(t) for t in tests]


@router.post("/laboratory/tests")
async def create_lab_test(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.laboratory.manage"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    test_type = payload.get("test_type", "Full Blood Count")
    doctor_name = payload.get("doctor_name", "Dr. Amina Yusuf")
    
    if not org_id or not patient_id or not test_type:
        raise HTTPException(status_code=400, detail="Missing required lab parameters")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_lab_test")
    
    test = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Lab Request - {patient_name} ({test_type})",
        attributes={
            "patient_id": patient_id,
            "patient_name": patient_name,
            "test_type": test_type,
            "doctor_name": doctor_name,
            "status": "SAMPLE_PENDING", # SAMPLE_PENDING, ANALYZING, COMPLETED
            "results": "",
            "is_critical": False,
            "turnaround_minutes": 0
        }
    )
    db.add(test)
    await db.commit()
    await db.refresh(test)
    return _entity_to_dict(test)


@router.put("/laboratory/tests/{test_id}")
async def update_lab_test(
    test_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.laboratory.manage"))
):
    org_id = payload.get("org_id")
    status_update = payload.get("status") # PENDING, ANALYZING, COMPLETED
    results = payload.get("results")
    is_critical = payload.get("is_critical", False)
    
    stmt = select(EntityV2).where(EntityV2.id == test_id, EntityV2.org_id == org_id)
    res = await db.execute(stmt)
    test = res.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Lab test request not found.")
        
    attrs = dict(test.attributes or {})
    attrs["status"] = status_update
    if results:
        attrs["results"] = results
    attrs["is_critical"] = is_critical
    attrs["turnaround_minutes"] = 45
    test.attributes = attrs
    
    if status_update == "COMPLETED":
        observation_service.record_observation(
            db=db,
            org_id=org_id,
            source_channel="laboratory",
            observation_type="lab_completed",
            primary_entity_id=attrs.get("patient_id"),
            location_label="Main Laboratory Wing",
            payload={"test_type": attrs.get("test_type"), "results": results, "is_critical": is_critical},
            severity="CRITICAL" if is_critical else "INFO",
            risk_impact=0.4 if is_critical else 0.0
        )
        
    await db.commit()
    return _entity_to_dict(test)


# --- 7. RADIOLOGY ---

@router.get("/radiology/scans")
async def list_radiology_scans(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.radiology.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_radiology_scan")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    scans = res.scalars().all()
    return [_entity_to_dict(s) for s in scans]


@router.post("/radiology/scans")
async def create_radiology_scan(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.radiology.manage"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    imaging_type = payload.get("imaging_type", "Chest X-Ray")
    
    if not org_id or not patient_id or not imaging_type:
        raise HTTPException(status_code=400, detail="Missing required parameters")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_radiology_scan")
    
    scan = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Imaging - {patient_name} ({imaging_type})",
        attributes={
            "patient_id": patient_id,
            "patient_name": patient_name,
            "imaging_type": imaging_type,
            "status": "AWAITING_SCAN", # AWAITING_SCAN, COMPLETED
            "report_details": "",
            "image_pacs_url": ""
        }
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    return _entity_to_dict(scan)


@router.put("/radiology/scans/{scan_id}")
async def update_radiology_scan(
    scan_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.radiology.manage"))
):
    org_id = payload.get("org_id")
    status_update = payload.get("status")
    report_details = payload.get("report_details", "")
    image_pacs_url = payload.get("image_pacs_url", "https://imaging-archive.interac.ai/dicom/study-889012.png")
    
    stmt = select(EntityV2).where(EntityV2.id == scan_id, EntityV2.org_id == org_id)
    res = await db.execute(stmt)
    scan = res.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan request not found.")
        
    attrs = dict(scan.attributes or {})
    attrs["status"] = status_update
    attrs["report_details"] = report_details
    attrs["image_pacs_url"] = image_pacs_url
    scan.attributes = attrs
    
    await db.commit()
    return _entity_to_dict(scan)


# --- 8. BILLING & POS ---

@router.get("/billing/invoices")
async def list_billing_invoices(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.billing.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_invoice")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    invoices = res.scalars().all()
    return [_entity_to_dict(i) for i in invoices]


@router.post("/billing/invoices")
async def create_billing_invoice(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.billing.manage"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    items = payload.get("items", []) # List of {"desc": "", "price": 0.0}
    
    if not org_id or not patient_id:
        raise HTTPException(status_code=400, detail="Missing required parameters")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_invoice")
    total_amount = sum(float(it.get("price", 0)) for it in items)
    invoice_id = f"INV-{Math_rand()}"
    
    inv = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Invoice {invoice_id} for {patient_name}",
        attributes={
            "invoice_id": invoice_id,
            "patient_id": patient_id,
            "patient_name": patient_name,
            "items": items,
            "total_amount": total_amount,
            "paid_amount": 0.0,
            "balance": total_amount,
            "status": "UNPAID", # UNPAID, PARTIAL, PAID
            "insurance_covered": 0.0
        }
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return _entity_to_dict(inv)


@router.post("/billing/pay")
async def pay_billing_invoice(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.billing.manage"))
):
    org_id = payload.get("org_id")
    invoice_id = payload.get("invoice_id") # Database Entity ID
    amount = float(payload.get("amount", 0.0))
    payment_method = payload.get("payment_method", "Cash") # Cash, POS Card, Bank Transfer
    insurance_provider = payload.get("insurance_provider", "")
    
    stmt = select(EntityV2).where(EntityV2.id == invoice_id, EntityV2.org_id == org_id)
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice record not found.")
        
    attrs = dict(inv.attributes or {})
    total = float(attrs.get("total_amount", 0.0))
    paid = float(attrs.get("paid_amount", 0.0))
    
    new_paid = paid + amount
    new_bal = max(0.0, total - new_paid)
    
    attrs["paid_amount"] = new_paid
    attrs["balance"] = new_bal
    
    if new_bal == 0.0:
        attrs["status"] = "PAID"
    else:
        attrs["status"] = "PARTIAL"
        
    inv.attributes = attrs
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="finance",
        observation_type="payment_received",
        primary_entity_id=attrs.get("patient_id"),
        location_label="Billing Cashier POS",
        payload={"invoice_no": attrs.get("invoice_id"), "amount_paid": amount, "method": payment_method, "insurance": insurance_provider},
        severity="INFO"
    )
    
    await db.commit()
    return _entity_to_dict(inv)


@router.get("/billing/dashboard")
async def get_billing_dashboard(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db)
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_invoice")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    invoices = res.scalars().all()
    
    total_rev = 0.0
    total_paid = 0.0
    total_bal = 0.0
    for inv in invoices:
        attrs = inv.attributes or {}
        total_rev += float(attrs.get("total_amount", 0.0))
        total_paid += float(attrs.get("paid_amount", 0.0))
        total_bal += float(attrs.get("balance", 0.0))
        
    return {
        "revenue_total": total_rev,
        "cash_reconciled": total_paid,
        "outstanding_debts": total_bal,
        "reconciliation_rate": f"{(total_paid / total_rev * 100):.1f}%" if total_rev > 0 else "100%"
    }


# --- 9. INSURANCE ---

@router.get("/insurance/claims")
async def list_insurance_claims(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.insurance.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_insurance_claim")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    claims = res.scalars().all()
    return [_entity_to_dict(c) for c in claims]


@router.post("/insurance/claims")
async def create_insurance_claim(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.insurance.manage"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    provider = payload.get("provider", "AXA Mansard")
    policy_no = payload.get("policy_no")
    claim_amount = float(payload.get("claim_amount", 0.0))
    pre_auth_code = payload.get("pre_auth_code", "")
    
    if not org_id or not patient_id or not policy_no:
        raise HTTPException(status_code=400, detail="Missing required claim codes.")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_insurance_claim")
    claim_id = f"CLM-{Math_rand()}"
    
    claim = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Insurance Claim {claim_id} ({provider})",
        attributes={
            "claim_id": claim_id,
            "patient_id": patient_id,
            "patient_name": patient_name,
            "provider": provider,
            "policy_no": policy_no,
            "claim_amount": claim_amount,
            "pre_auth_code": pre_auth_code,
            "status": "SUBMITTED", # SUBMITTED, APPROVED, REJECTED
            "rejection_reason": ""
        }
    )
    db.add(claim)
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="finance",
        observation_type="insurance_approved",
        primary_entity_id=patient_id,
        location_label="Insurance Desk",
        payload={"claim_id": claim_id, "provider": provider, "amount": claim_amount},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(claim)
    return _entity_to_dict(claim)


@router.post("/insurance/validate")
async def validate_insurance_policy(payload: Dict[str, Any]):
    # Simulator validation endpoint
    provider = payload.get("provider", "AXA Mansard")
    policy_no = payload.get("policy_no")
    
    if not policy_no:
        return {"valid": False, "status": "EXPIRED", "detail": "Missing policy reference"}
        
    is_valid = not policy_no.endswith("99") # Simulates ending in 99 as invalid
    return {
        "valid": is_valid,
        "status": "ACTIVE" if is_valid else "INACTIVE_OR_SUSPENDED",
        "authorized_limit": 500000.0 if is_valid else 0.0,
        "copay_percent": 10.0 if is_valid else 0.0,
        "provider": provider
    }


# --- 10. WARD & BED MANAGEMENT ---

@router.get("/wards/beds")
async def list_ward_beds(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.ward.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_bed")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    beds = res.scalars().all()
    
    if not beds:
        beds = await _provision_default_beds(db, org_id, type_id)
        
    return [_entity_to_dict(b) for b in beds]


@router.post("/wards/beds")
async def allocate_bed(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.ward.manage"))
):
    org_id = payload.get("org_id")
    bed_id = payload.get("bed_id") # Database Entity ID
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    
    stmt = select(EntityV2).where(EntityV2.id == bed_id, EntityV2.org_id == org_id)
    res = await db.execute(stmt)
    bed = res.scalar_one_or_none()
    
    if not bed:
        raise HTTPException(status_code=404, detail="Bed record not found.")
        
    attrs = dict(bed.attributes or {})
    if attrs.get("status") == "OCCUPIED" and patient_id:
        raise HTTPException(status_code=400, detail="Target bed is already occupied.")
        
    if patient_id:
        attrs["status"] = "OCCUPIED"
        attrs["patient_id"] = patient_id
        attrs["patient_name"] = patient_name
        attrs["occupied_at"] = datetime.utcnow().isoformat()
    else:
        # Discharge/Deallocate
        old_patient = attrs.get("patient_name", "Patient")
        attrs["status"] = "DIRTY"
        attrs["patient_id"] = ""
        attrs["patient_name"] = ""
        attrs["occupied_at"] = ""
        
    bed.attributes = attrs
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="ward",
        observation_type="bed_occupied" if patient_id else "patient_discharged",
        primary_entity_id=patient_id or bed_id,
        location_label=f"Ward Bed {attrs.get('bed_number')}",
        payload={"bed_number": attrs.get("bed_number"), "patient": patient_name or old_patient},
        severity="INFO"
    )
    
    await db.commit()
    return _entity_to_dict(bed)


@router.put("/wards/beds/{bed_id}/status")
async def update_bed_status(
    bed_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.ward.manage"))
):
    org_id = payload.get("org_id")
    status_update = payload.get("status") # OCCUPIED, VACANT, DIRTY, ISOLATION, MAINTENANCE
    
    stmt = select(EntityV2).where(EntityV2.id == bed_id, EntityV2.org_id == org_id)
    res = await db.execute(stmt)
    bed = res.scalar_one_or_none()
    
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
        
    attrs = dict(bed.attributes or {})
    attrs["status"] = status_update
    bed.attributes = attrs
    
    await db.commit()
    return _entity_to_dict(bed)


@router.get("/wards/predict-occupancy")
async def predict_ward_occupancy(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_bed")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    beds = res.scalars().all()
    
    total_beds = len(beds)
    occupied_beds = sum(1 for b in beds if b.attributes.get("status") == "OCCUPIED")
    occupancy_pct = (occupied_beds / total_beds * 100.0) if total_beds > 0 else 0.0
    
    import calendar
    from datetime import datetime, timedelta
    
    forecast = []
    for i in range(4):
        target_date = datetime.utcnow() + timedelta(days=i)
        day_name = calendar.day_name[target_date.weekday()]
        day_pct = min(100.0, max(0.0, occupancy_pct + (5.0 if day_name in ["Saturday", "Sunday"] else -2.0)))
        needed = int(round(total_beds * day_pct / 100.0))
        forecast.append({
            "day": day_name,
            "expected_occupancy": f"{day_pct:.1f}%",
            "beds_needed": needed
        })
        
    return {"days_forecast": forecast}


async def _provision_default_beds(db: AsyncSession, org_id: str, type_id: str) -> List[EntityV2]:
    beds = []
    # ICU Wards
    for i in range(1, 6):
        bed = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=f"ICU Bed {i}",
            attributes={
                "bed_number": f"ICU-{i}",
                "ward": "Intensive Care Unit (ICU)",
                "status": "VACANT",
                "patient_id": "",
                "patient_name": "",
                "isolation": True
            }
        )
        db.add(bed)
        beds.append(bed)
        
    # General Wards
    for i in range(1, 11):
        bed = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=f"General Ward Bed {i}",
            attributes={
                "bed_number": f"GW-{i}",
                "ward": "General Ward A",
                "status": "VACANT",
                "patient_id": "",
                "patient_name": "",
                "isolation": False
            }
        )
        db.add(bed)
        beds.append(bed)
        
    await db.commit()
    return beds


# --- 11. EMERGENCY DEPARTMENT (ER) ---

@router.get("/emergency/triage")
async def list_emergency_triage(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db)
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
    # Fetch all patients that have urgent triage levels
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    patients = res.scalars().all()
    
    er_list = []
    for p in patients:
        attrs = p.attributes or {}
        level = attrs.get("triage_level", "Normal")
        if level in ["Critical", "Emergency", "Urgent"]:
            er_list.append(_entity_to_dict(p))
            
    # Sort er_list by triage level weight
    level_weights = {"Critical": 1, "Emergency": 2, "Urgent": 3}
    er_list.sort(key=lambda x: level_weights.get(x["attributes"].get("triage_level"), 99))
    return er_list


@router.post("/emergency/triage")
async def update_patient_triage(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.emergency.manage"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id") # Database Entity ID
    triage_level = payload.get("triage_level") # Critical, Emergency, Urgent, Normal
    
    stmt = select(EntityV2).where(EntityV2.id == patient_id, EntityV2.org_id == org_id)
    res = await db.execute(stmt)
    p = res.scalar_one_or_none()
    
    if not p:
        raise HTTPException(status_code=404, detail="Patient profile not found.")
        
    attrs = dict(p.attributes or {})
    attrs["triage_level"] = triage_level
    p.attributes = attrs
    
    if triage_level in ["Critical", "Emergency"]:
        observation_service.record_observation(
            db=db,
            org_id=org_id,
            source_channel="emergency",
            observation_type="emergency_alert",
            primary_entity_id=patient_id,
            location_label="ER Triage Bay",
            payload={"patient_name": p.display_label, "triage_level": triage_level},
            severity="CRITICAL",
            risk_impact=0.6
        )
        
    await db.commit()
    return _entity_to_dict(p)


@router.get("/emergency/congestion")
async def get_er_congestion(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    patients = res.scalars().all()
    
    er_patients = [p for p in patients if p.attributes.get("triage_level") is not None]
    
    red_count = sum(1 for p in er_patients if p.attributes.get("triage_level") == "RED")
    orange_count = sum(1 for p in er_patients if p.attributes.get("triage_level") == "ORANGE")
    yellow_count = sum(1 for p in er_patients if p.attributes.get("triage_level") == "YELLOW")
    
    total_er = len(er_patients)
    er_occupancy_pct = (total_er / 10 * 100) if total_er > 0 else 0.0
    avg_wait = 10 + (red_count * 15) + (orange_count * 10) + (yellow_count * 5)
    
    return {
        "avg_waiting_time_mins": avg_wait,
        "er_occupancy": f"{min(100.0, er_occupancy_pct):.1f}%",
        "active_triage_bay": "Triage Room 1" if total_er > 0 else "None",
        "red_priority_count": red_count,
        "orange_priority_count": orange_count
    }


# --- 12. THEATRE ---

@router.get("/theatre/schedule")
async def list_theatre_surgeries(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.theatre.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_theatre_schedule")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    surgeries = res.scalars().all()
    return [_entity_to_dict(s) for s in surgeries]


@router.post("/theatre/schedule")
async def schedule_surgery(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.theatre.manage"))
):
    org_id = payload.get("org_id")
    patient_id = payload.get("patient_id")
    patient_name = payload.get("patient_name")
    procedure = payload.get("procedure", "Appendectomy")
    surgeon = payload.get("surgeon", "Dr. Amina Yusuf")
    scheduled_time = payload.get("scheduled_time", datetime.utcnow().isoformat())
    theatre_room = payload.get("theatre_room", "OR Room 1")
    
    if not org_id or not patient_id:
        raise HTTPException(status_code=400, detail="Missing procedure requirements")
        
    type_id = await _get_entity_type_id(db, org_id, "hospital_theatre_schedule")
    
    s = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Surgery - {patient_name} ({procedure})",
        attributes={
            "patient_id": patient_id,
            "patient_name": patient_name,
            "procedure": procedure,
            "surgeon": surgeon,
            "scheduled_time": scheduled_time,
            "theatre_room": theatre_room,
            "surgical_team": payload.get("team", ["Nurse Bola", "Anaesthetist Dr. Obi"]),
            "equipment_precheck": True,
            "status": "SCHEDULED" # SCHEDULED, IN_PROGRESS, RECOVERY, COMPLETED
        }
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _entity_to_dict(s)


# --- 13. ICU TELEMETRY SIMULATOR ---

@router.get("/icu/monitoring")
async def get_icu_telemetry(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db)
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_bed")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    beds = res.scalars().all()
    
    emr_type_id = await _get_entity_type_id(db, org_id, "hospital_emr")
    telemetry = []
    
    for b in beds:
        attrs = b.attributes or {}
        if attrs.get("ward") == "Intensive Care Unit (ICU)" and attrs.get("status") == "OCCUPIED":
            patient = attrs.get("patient_name")
            p_id = attrs.get("patient_id")
            
            # Query the latest EMR for this patient to retrieve real vital signs
            stmt_emr = select(EntityV2).where(
                EntityV2.org_id == org_id,
                EntityV2.entity_type_id == emr_type_id
            ).order_by(EntityV2.created_at.desc())
            
            res_emr = await db.execute(stmt_emr)
            emrs = res_emr.scalars().all()
            
            latest_emr = None
            for emr in emrs:
                if emr.attributes.get("patient_id") == p_id:
                    latest_emr = emr
                    break
                    
            vitals = latest_emr.attributes.get("vitals", {}) if latest_emr else {}
            
            heart_rate = int(vitals.get("pulse", vitals.get("heart_rate", 75)))
            spo2 = int(vitals.get("spo2", 98))
            bp = vitals.get("bp", vitals.get("blood_pressure", "120/80"))
            resp_rate = int(vitals.get("resp_rate", vitals.get("respiration_rate", 16)))
            
            telemetry.append({
                "bed": attrs.get("bed_number"),
                "patient_id": p_id,
                "patient_name": patient,
                "heart_rate": heart_rate,
                "spo2": spo2,
                "blood_pressure": bp,
                "respiration_rate": resp_rate,
                "ventilator_mode": "SIMV" if heart_rate > 100 or spo2 < 93 else "CPAP",
                "alert": "CRITICAL" if spo2 < 90 or heart_rate > 110 else "NORMAL"
            })
            
    return telemetry


# --- 14. HR & STAFF CLOCK-IN ---

@router.get("/hr/staff")
async def list_staff_members(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.hr.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_staff")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    staff = res.scalars().all()
    
    if not staff:
        staff = await _provision_default_staff(db, org_id, type_id)
        
    return [_entity_to_dict(s) for s in staff]


@router.post("/hr/clockin")
async def staff_clockin(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    org_id = payload.get("org_id")
    staff_id = payload.get("staff_id")
    staff_name = payload.get("staff_name", "Doctor Yusuf")
    
    if not org_id or not staff_id:
         raise HTTPException(status_code=400, detail="Missing staff ID references")
         
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="hr",
        observation_type="staff_clocked_in",
        primary_entity_id=staff_id,
        location_label="Main Lobby Staff Terminal",
        payload={"staff_name": staff_name, "clock_in_time": datetime.utcnow().isoformat()},
        severity="INFO"
    )
    return {"status": "SUCCESS", "message": f"{staff_name} clocked in successfully."}


async def _provision_default_staff(db: AsyncSession, org_id: str, type_id: str) -> List[EntityV2]:
    staff_list = [
        {"name": "Dr. Amina Yusuf", "role": "Senior Consultant Physician", "license": "MD-40912-A"},
        {"name": "Dr. Chidi Obi", "role": "Consultant Anaesthetist", "license": "MD-55829-B"},
        {"name": "Nurse Bola Adebayo", "role": "ICU Head Nurse", "license": "RN-99214-N"},
        {"name": "Pharmacist Segun Alao", "role": "Chief Pharmacist", "license": "PH-44810-P"}
    ]
    staff_entities = []
    for s in staff_list:
        se = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=s["name"],
            attributes={
                "role": s["role"],
                "license_code": s["license"],
                "license_status": "ACTIVE",
                "attendance_status": "OFF_DUTY",
                "schedule_shift": "Day Shift"
            }
        )
        db.add(se)
        staff_entities.append(se)
    await db.commit()
    return staff_entities


# --- 15. MAINTENANCE ---

@router.get("/maintenance/equipment")
async def list_maintenance_equipment(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.maintenance.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_maintenance_schedule")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    equipment = res.scalars().all()
    
    if not equipment:
        equipment = await _provision_default_maintenance(db, org_id, type_id)
        
    return [_entity_to_dict(e) for e in equipment]


@router.post("/maintenance/equipment")
async def report_equipment_failure(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.maintenance.manage"))
):
    org_id = payload.get("org_id")
    equipment_id = payload.get("equipment_id") # Database Entity ID
    failure_description = payload.get("failure_description", "Faulty Power Connection")
    
    stmt = select(EntityV2).where(EntityV2.id == equipment_id, EntityV2.org_id == org_id)
    res = await db.execute(stmt)
    eq = res.scalar_one_or_none()
    
    if not eq:
        raise HTTPException(status_code=404, detail="Medical asset not found.")
        
    attrs = dict(eq.attributes or {})
    attrs["status"] = "DOWN"
    attrs["last_failure_report"] = failure_description
    eq.attributes = attrs
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="maintenance",
        observation_type="equipment_failure",
        primary_entity_id=equipment_id,
        location_label=attrs.get("location", "Main Ward"),
        payload={"asset_name": eq.display_label, "failure": failure_description},
        severity="WARNING",
        risk_impact=0.35
    )
    
    await db.commit()
    return _entity_to_dict(eq)


async def _provision_default_maintenance(db: AsyncSession, org_id: str, type_id: str) -> List[EntityV2]:
    items = [
        {"name": "MRI Scanner 3T", "loc": "Radiology Room 1"},
        {"name": "ICU Ventilator B2", "loc": "ICU Bay 2"},
        {"name": "Hematology Analyzer X", "loc": "Pathology Lab 3"}
    ]
    eqs = []
    for it in items:
        eq = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=it["name"],
            attributes={
                "location": it["loc"],
                "status": "OPERATIONAL",
                "next_preventive_maintenance": "2026-09-15",
                "downtime_hours_ytd": 12.5
            }
        )
        db.add(eq)
        eqs.append(eq)
    await db.commit()
    return eqs


# --- 16. AMBULANCE TRACKING ---

@router.get("/ambulance/dispatch")
async def get_ambulance_status(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.ambulance.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "hospital_ambulance")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    vehicles = res.scalars().all()
    
    if not vehicles:
        vehicles = await _provision_default_ambulances(db, org_id, type_id)
        
    return [_entity_to_dict(v) for v in vehicles]


@router.post("/ambulance/dispatch")
async def dispatch_ambulance(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("hospital.ambulance.manage"))
):
    org_id = payload.get("org_id")
    vehicle_id = payload.get("vehicle_id") # Database Entity ID
    destination = payload.get("destination", "Ikeja Expressway Mile 12")
    patient_id = payload.get("patient_id", "")
    
    stmt = select(EntityV2).where(EntityV2.id == vehicle_id, EntityV2.org_id == org_id)
    res = await db.execute(stmt)
    v = res.scalar_one_or_none()
    
    if not v:
        raise HTTPException(status_code=404, detail="Ambulance not registered.")
        
    attrs = dict(v.attributes or {})
    attrs["status"] = "DISPATCHED"
    attrs["destination"] = destination
    attrs["patient_id"] = patient_id
    v.attributes = attrs
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="ambulance",
        observation_type="ambulance_dispatched",
        primary_entity_id=patient_id or vehicle_id,
        location_label=destination,
        payload={"vehicle_plate": attrs.get("plate_number"), "destination": destination},
        severity="INFO"
    )
    
    await db.commit()
    return _entity_to_dict(v)


async def _provision_default_ambulances(db: AsyncSession, org_id: str, type_id: str) -> List[EntityV2]:
    vehicles = []
    plates = ["LAG-991-AMB", "FCT-220-AMB"]
    for idx, p in enumerate(plates):
        v = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=f"Ambulance Vehicle - {p}",
            attributes={
                "plate_number": p,
                "status": "STANDBY",
                "gps_lat": 6.5244 + (idx * 0.01),
                "gps_lng": 3.3792 + (idx * 0.01),
                "destination": "",
                "driver": "Driver James" if idx == 0 else "Driver Chinedu"
            }
        )
        db.add(v)
        vehicles.append(v)
    await db.commit()
    return vehicles


# --- 17. INTEGRATION SYNC LAYER (MODE A) ---

@router.post("/sync/fhir")
async def sync_fhir_payload(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """
    Ingests and validates standard FHIR resources.
    Converts FHIR Patient, Encounter, or Observation resources into InteracAI entities.
    """
    org_id = payload.get("org_id", "demo")
    resource_type = payload.get("resourceType")
    
    if not resource_type:
        raise HTTPException(status_code=400, detail="Not a valid FHIR resource format: missing resourceType.")
        
    # Map FHIR fields to InteracAI specs
    if resource_type == "Patient":
        patient_name = ""
        names = payload.get("name", [])
        if names:
            given = " ".join(names[0].get("given", []))
            family = names[0].get("family", "")
            patient_name = f"{given} {family}".strip() or "FHIR Patient"
            
        telecoms = payload.get("telecom", [])
        phone = telecoms[0].get("value", "") if telecoms else ""
        
        type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
        p = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=patient_name,
            attributes={
                "patient_id": f"FHIR-{payload.get('id', 'UNK')}",
                "national_id": "FHIR-SYNC",
                "emergency_contact": phone,
                "triage_level": "Normal",
                "registered_at": datetime.utcnow().isoformat(),
                "photo_url": f"https://api.dicebear.com/7.x/adventurer/svg?seed={patient_name}",
            }
        )
        db.add(p)
        
        observation_service.record_observation(
            db=db,
            org_id=org_id,
            source_channel="reception",
            observation_type="patient_checkin",
            primary_entity_id=p.id,
            location_label="FHIR REST Bridge",
            payload={"patient_id": p.attributes["patient_id"], "name": patient_name, "fhir_resource": payload.get("id")},
            severity="INFO"
        )
        await db.commit()
        return {"status": "SUCCESS", "message": "FHIR Patient Resource Synced", "entity": _entity_to_dict(p)}
        
    elif resource_type == "Observation":
        # Parse vitals observation
        patient_ref = payload.get("subject", {}).get("reference", "Patient/unknown")
        code = payload.get("code", {}).get("text", "Vitals")
        value_qty = payload.get("valueQuantity", {})
        value = f"{value_qty.get('value')} {value_qty.get('unit')}"
        
        # Publish observation immediately to bus
        obs = observation_service.record_observation(
            db=db,
            org_id=org_id,
            source_channel="clinical",
            observation_type="vitals_changed",
            location_label="FHIR Ingestion Gateway",
            payload={"fhir_subject": patient_ref, "observation_type": code, "value": value},
            severity="INFO"
        )
        return {"status": "SUCCESS", "message": "FHIR Observation Resource Ingested", "observation_id": obs.id}
        
    else:
        return {"status": "SUCCESS", "message": f"FHIR {resource_type} parsed, stored in raw Sync history."}


@router.post("/sync/hl7")
async def sync_hl7_pipe_string(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """
    Parses standard pipe-delimited HL7 v2 messages.
    Example payload: {"hl7": "MSH|^~\\&|SENDING_APP|...\\nPID|||PAT-8802||Adeola^Adekunle||19880112|M"}
    """
    org_id = payload.get("org_id", "demo")
    hl7_str = payload.get("hl7", "")
    
    if not hl7_str:
        raise HTTPException(status_code=400, detail="Missing hl7 pipe-delimited message string.")
        
    # Extract PID segment
    lines = hl7_str.split("\n")
    pid_segment = None
    for l in lines:
        if l.startswith("PID|"):
            pid_segment = l
            break
            
    if not pid_segment:
        return {"status": "SUCCESS", "message": "HL7 Message processed, PID patient segment not found."}
        
    fields = pid_segment.split("|")
    patient_id = fields[3] if len(fields) > 3 else "HL7-UNK"
    patient_name = "HL7 Patient"
    if len(fields) > 5:
        name_parts = fields[5].split("^")
        if len(name_parts) > 1:
            patient_name = f"{name_parts[1]} {name_parts[0]}"
            
    type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
    p = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=patient_name,
        attributes={
            "patient_id": patient_id,
            "national_id": "HL7-SYNC",
            "triage_level": "Normal",
            "registered_at": datetime.utcnow().isoformat(),
            "photo_url": f"https://api.dicebear.com/7.x/adventurer/svg?seed={patient_name}",
        }
    )
    db.add(p)
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="reception",
        observation_type="patient_checkin",
        primary_entity_id=p.id,
        location_label="HL7 TCP MLLP Sync Bridge",
        payload={"patient_id": patient_id, "name": patient_name},
        severity="INFO"
    )
    await db.commit()
    return {"status": "SUCCESS", "message": "HL7 Patient Registered via PID parse", "patient": _entity_to_dict(p)}


# --- 18. COMPUTER VISION SECURITY ALERTS (ARGUS OS SURVEILLANCE) ---

@router.get("/security/surveillance-alerts")
async def list_surveillance_alerts(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db)
):
    # Fetch CCTV, fallback to generic intelligence alerts
    from database.models.observation import ObservationV2
    stmt = select(ObservationV2).where(
        ObservationV2.org_id == org_id,
        ObservationV2.source_channel == "security"
    ).order_by(ObservationV2.created_at.desc()).limit(15)
    res = await db.execute(stmt)
    obs = res.scalars().all()
    
    alerts = []
    for o in obs:
        alerts.append({
            "id": o.id,
            "event": o.observation_type,
            "location": o.location_label,
            "details": o.payload.get("detail", "CCTV Movement detected"),
            "severity": o.severity,
            "confidence": o.confidence,
            "timestamp": o.created_at.isoformat() if o.created_at else None
        })
        
    if not alerts:
        alerts.append({
            "id": "obs_mock_alert",
            "event": "visitor_count_peak",
            "location": "Awaiting Live Argus OS Streams...",
            "details": "CCTV crowd estimation online.",
            "severity": "INFO",
            "confidence": 1.0,
            "timestamp": datetime.utcnow().isoformat()
        })
    return alerts


@router.post("/security/surveillance-alerts")
async def trigger_mock_surveillance_alert(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    org_id = payload.get("org_id")
    event = payload.get("event", "patient_fall") # patient_fall, violence_detection, restricted_area_intrusion
    location = payload.get("location", "ICU Room 2 Lobby")
    details = payload.get("details", "AI Camera detected patient slipped beside ICU Bed 2.")
    
    obs = observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="security",
        observation_type=event,
        location_label=location,
        payload={"detail": details},
        severity="CRITICAL",
        risk_impact=0.75
    )
    return {"status": "SUCCESS", "alert_id": obs.id, "message": "Argus CV Alert generated."}


# --- 19. KNOWLEDGE GRAPH EXPLORER ---

@router.get("/knowledge-graph")
async def get_hospital_knowledge_graph(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Compiles a Graph schema representation for the AI Copilot.
    Nodes: Patient, Doctor, Bed, Invoice, Pharmacy
    Edges: ASSIGNED_DOCTOR, OCCUPIES_BED, BILLED_TO
    """
    nodes = []
    edges = []
    
    # 1. Fetch patients
    pat_type = await _get_entity_type_id(db, org_id, "hospital_patient")
    pat_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == pat_type)
    pat_res = await db.execute(pat_stmt)
    patients = pat_res.scalars().all()
    for p in patients:
        nodes.append({"id": p.id, "label": p.display_label, "type": "Patient", "color": "#f43f5e"})
        
    # 2. Fetch appointments
    appt_type = await _get_entity_type_id(db, org_id, "hospital_appointment")
    appt_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == appt_type)
    appt_res = await db.execute(appt_stmt)
    appts = appt_res.scalars().all()
    for a in appts:
        nodes.append({"id": a.id, "label": a.display_label, "type": "Appointment", "color": "#6366f1"})
        p_id = a.attributes.get("patient_id")
        if p_id:
            edges.append({"source": p_id, "target": a.id, "relationship": "HAS_APPOINTMENT"})
            
    # 3. Fetch beds
    bed_type = await _get_entity_type_id(db, org_id, "hospital_bed")
    bed_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == bed_type)
    bed_res = await db.execute(bed_stmt)
    beds = bed_res.scalars().all()
    for b in beds:
        nodes.append({"id": b.id, "label": b.display_label, "type": "Bed", "color": "#0ea5e9"})
        p_id = b.attributes.get("patient_id")
        if p_id:
            edges.append({"source": p_id, "target": b.id, "relationship": "OCCUPIES_BED"})
            
    # Default node if empty
    if not nodes:
        nodes.append({"id": "pat_demo_1", "label": "Babatunde Alao", "type": "Patient", "color": "#f43f5e"})
        nodes.append({"id": "doc_demo_1", "label": "Dr. Amina Yusuf", "type": "Doctor", "color": "#10b981"})
        edges.append({"source": "pat_demo_1", "target": "doc_demo_1", "relationship": "CONSULTED_BY"})
        
    return {"nodes": nodes, "edges": edges}


# Math rand helper for Python 3 syntax replacement
def Math_rand() -> str:
    import random
    return str(random.randint(1000, 9999))


@router.get("/workspace/{department}")
async def get_hospital_workspace(
    department: str,
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Unified dynamic workspace endpoint returning configurations, tasks, and analytics based on department."""
    user_dept = current_user.get("department", "general").lower()
    user_role = current_user.get("role", "agent").lower()
    
    is_privileged = user_role in ["owner", "admin"] or user_dept in ["management", "administration"]
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
        "summary": "ARGUS ER congestion analysis: Patient arrival volumes are normal. No surge patterns detected.",
        "recommendations": ["Optimize medication dispensing schedules to minimize wait times."]
    }
    
    # Live counts
    pat_type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
    pat_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == pat_type_id)
    pat_res = await db.execute(pat_stmt)
    patients = pat_res.scalars().all()
    
    bed_type_id = await _get_entity_type_id(db, org_id, "hospital_bed")
    bed_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == bed_type_id)
    bed_res = await db.execute(bed_stmt)
    beds = bed_res.scalars().all()
    
    total_beds = len(beds)
    occupied_beds = sum(1 for b in beds if b.attributes.get("status") == "OCCUPIED")
    vacancy_rate = ((total_beds - occupied_beds) / total_beds * 100) if total_beds > 0 else 0.0
    
    if dept_clean in ["reception", "billing"]:
        kpis = [
            {"label": "Total Patient Registry", "value": str(len(patients)), "status": "info"},
            {"label": "Bed Vacancy Rate", "value": f"{vacancy_rate:.1f}%", "status": "success"},
        ]
        
        # Pull active appointments
        appt_type_id = await _get_entity_type_id(db, org_id, "hospital_appointment")
        appt_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == appt_type_id).limit(5)
        appt_res = await db.execute(appt_stmt)
        appts = appt_res.scalars().all()
        tasks = [{"id": a.id, "label": a.display_label, "status": a.attributes.get("status", "SCHEDULED")} for a in appts]
        
        quick_actions = [
            {"label": "Register Patient", "method": "POST", "url": "/api/v1/hospital/patients"},
            {"label": "Book Appointment", "method": "POST", "url": "/api/v1/hospital/appointments"}
        ]
        
    elif dept_clean in ["doctors", "nurses", "icu", "emergency", "ward", "theatre"]:
        kpis = [
            {"label": "Occupied Wards Bed Count", "value": str(occupied_beds), "status": "warning" if occupied_beds > 2 else "info"},
            {"label": "Vitals Telemetry Logging Feed", "value": "Active", "status": "success"}
        ]
        
        # Clinical active EMR records
        emr_type_id = await _get_entity_type_id(db, org_id, "hospital_emr")
        emr_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == emr_type_id).limit(5)
        emr_res = await db.execute(emr_stmt)
        emrs = emr_res.scalars().all()
        tasks = [{"id": e.id, "label": e.display_label, "status": "RECORDED"} for e in emrs]
        
        quick_actions = [
            {"label": "Record EMR Consultation", "method": "POST", "url": "/api/v1/hospital/emr"},
            {"label": "Order Laboratory Diagnostics", "method": "POST", "url": "/api/v1/hospital/laboratory/test"}
        ]
        
    elif dept_clean in ["laboratory", "radiology"]:
        lab_type_id = await _get_entity_type_id(db, org_id, "hospital_lab_test")
        lab_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == lab_type_id)
        lab_res = await db.execute(lab_stmt)
        lab_tests = lab_res.scalars().all()
        
        kpis = [{"label": "Pending Lab Tests", "value": str(len(lab_tests)), "status": "warning" if len(lab_tests) > 0 else "success"}]
        tasks = [{"id": lt.id, "label": lt.display_label, "status": lt.attributes.get("status", "PENDING")} for lt in lab_tests]
        
        quick_actions = [
            {"label": "Submit Lab Test Result", "method": "POST", "url": "/api/v1/hospital/laboratory/results"}
        ]
        
    elif dept_clean in ["pharmacy", "procurement"]:
        med_type_id = await _get_entity_type_id(db, org_id, "hospital_medicine")
        med_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == med_type_id)
        med_res = await db.execute(med_stmt)
        medicines = med_res.scalars().all()
        
        out_of_stock = sum(1 for m in medicines if int(m.attributes.get("qty", 0)) <= int(m.attributes.get("min_alert_stock", 20)))
        kpis = [
            {"label": "Shortage Alert Medicines", "value": str(out_of_stock), "status": "danger" if out_of_stock > 0 else "success"}
        ]
        
        tasks = [{"id": m.id, "label": f"{m.display_label} - Qty: {m.attributes.get('qty', 0)}", "status": "LOW STOCK" if int(m.attributes.get("qty", 0)) <= int(m.attributes.get("min_alert_stock", 20)) else "OK"} for m in medicines]
        
        quick_actions = [
            {"label": "Dispense Patient Medicine", "method": "POST", "url": "/api/v1/hospital/pharmacy/dispense"}
        ]
        
    else: # Management, HR, Admin
        inv_type_id = await _get_entity_type_id(db, org_id, "hospital_invoice")
        inv_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == inv_type_id)
        inv_res = await db.execute(inv_stmt)
        invoices = inv_res.scalars().all()
        total_rev = sum(float(i.attributes.get("total_amount", 0.0) or i.attributes.get("balance", 0.0)) for i in invoices)
        
        kpis = [
            {"label": "Consolidated Billing Revenue", "value": f"₦{total_rev:,.2f}", "status": "success"},
            {"label": "ER Occupancy Capacity", "value": "Normal", "status": "info"}
        ]
        
    return {
        "department": dept_clean,
        "kpis": kpis,
        "tasks": tasks,
        "notifications": notifications,
        "workflows": workflows_list,
        "quick_actions": quick_actions,
        "reports": [{"name": f"{dept_clean.capitalize()} Operational Summary", "url": f"/reports/hospital/{dept_clean}"}],
        "argus_intelligence": argus_intelligence
    }


@router.post("/integrations/hl7")
async def hl7_admissions_connector(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Processes HL7 ADT A01 Admission Message and emits observation signals to Observation Bus."""
    org_id = payload.get("org_id")
    hl7_msg = payload.get("hl7_message", "")
    
    if not org_id or not hl7_msg:
        raise HTTPException(status_code=400, detail="Missing required HL7 parameters.")
        
    # Segment parser (e.g. PID and PV1 segments)
    pid_name = "HL7 Patient"
    patient_id = "pat_hl7_1"
    bed_number = "101"
    
    segments = hl7_msg.split("\n")
    for seg in segments:
        parts = seg.split("|")
        if parts[0] == "PID":
            # Extract name and ID
            if len(parts) > 5:
                pid_name = parts[5].replace("^", " ").strip()
            if len(parts) > 3:
                patient_id = parts[3].strip()
        elif parts[0] == "PV1":
            # Extract bed/room location
            if len(parts) > 3:
                bed_number = parts[3].strip()
                
    # Create or update patient profile
    pat_type_id = await _get_entity_type_id(db, org_id, "hospital_patient")
    pat_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == pat_type_id, EntityV2.display_label.ilike(f"%{pid_name}%"))
    pat_res = await db.execute(pat_stmt)
    patient = pat_res.scalars().first()
    
    if not patient:
        patient = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=pat_type_id,
            display_label=pid_name,
            attributes={"allergies": [], "gender": "Unknown", "phone": "HL7 Synced"}
        )
        db.add(patient)
        await db.flush()
        
    # Record check-in observation
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="hl7_connector",
        observation_type="patient_admitted",
        primary_entity_id=patient.id,
        location_label=f"Bed {bed_number}",
        payload={"patient_name": pid_name, "bed_assigned": bed_number, "integration": "HL7 Engine v2.5"},
        severity="INFO"
    )
    
    await db.commit()
    return {"status": "SUCCESS", "message": f"HL7 Admission Message parsed for {pid_name} and admitted to Bed {bed_number}."}


@router.post("/integrations/fhir")
async def fhir_admissions_connector(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Processes FHIR Encounter Resource JSON payload to synchronize clinical status."""
    org_id = payload.get("org_id")
    encounter_resource = payload.get("resource", {})
    
    if not org_id or encounter_resource.get("resourceType") != "Encounter":
        raise HTTPException(status_code=400, detail="Invalid FHIR Resource. Must be an Encounter type.")
        
    subject = encounter_resource.get("subject", {})
    patient_name = subject.get("display", "FHIR Patient")
    status_state = encounter_resource.get("status", "finished")
    
    # Ingest observation
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="fhir_connector",
        observation_type="patient_admitted" if status_state == "in-progress" else "patient_discharged",
        location_label="Clinic Encounter Sync",
        payload={"patient_name": patient_name, "encounter_status": status_state, "integration": "FHIR R4 API"},
        severity="INFO"
    )
    
    await db.commit()
    return {"status": "SUCCESS", "message": f"FHIR Encounter resource processed. Patient: {patient_name}, Status: {status_state}."}


# Math rand helper for Python 3 syntax replacement
def Math_rand() -> str:
    import random
    return str(random.randint(1000, 9999))
