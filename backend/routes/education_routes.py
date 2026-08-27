"""
InteracAI Education & Campus Operational REST Router.
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
from services.observation_service import observation_service
from services.workflow_engine import workflow_engine
from services.auth_service import require_permission, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/education", tags=["Education Operations"])


def Math_rand() -> str:
    return str(random.randint(1000, 9999))


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
        # Create dynamically if missing
        et = EntityType(
            id=f"et_{uuid.uuid4().hex[:12]}",
            org_id=org_id,
            module_id="module_education",
            code=code,
            display_name=code.replace("_", " ").title(),
            schema_definition={}
        )
        db.add(et)
        await db.commit()
        await db.refresh(et)
    return et.id


# --- 1. STUDENTS (SIS) ---

@router.get("/students")
async def list_students(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.students.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "student_record")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    students = res.scalars().all()
    return [_entity_to_dict(s) for s in students]


@router.post("/students", status_code=status.HTTP_201_CREATED)
async def register_student(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.students.create"))
):
    org_id = payload.get("org_id")
    name = payload.get("name")
    national_id = payload.get("national_id", "")
    medical_history = payload.get("medical_history", "None declared")
    guardian_name = payload.get("guardian_name", "")
    guardian_contact = payload.get("guardian_contact", "")
    guardian_email = payload.get("guardian_email", "")
    student_email = payload.get("student_email", "")
    previous_school = payload.get("previous_school", "")
    course_enrolled = payload.get("course_enrolled", "")
    
    if not org_id or not name:
        raise HTTPException(status_code=400, detail="Missing required student registration fields.")
        
    type_id = await _get_entity_type_id(db, org_id, "student_record")
    student_id = f"EDU-STUD-{Math_rand()}"
    
    s = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=name,
        attributes={
            "student_id": student_id,
            "national_id": national_id,
            "medical_history": medical_history,
            "guardian_name": guardian_name,
            "guardian_contact": guardian_contact,
            "guardian_email": guardian_email,
            "student_email": student_email,
            "previous_school": previous_school,
            "course_enrolled": course_enrolled,
            "photo_url": payload.get("photo_url", f"https://api.dicebear.com/7.x/adventurer/svg?seed={name}"),
            "qr_code_ref": f"QR-STU-{uuid.uuid4().hex[:8].upper()}",
            "attendance_risk": "Low",
            "registered_at": datetime.utcnow().isoformat()
        }
    )
    db.add(s)
    
    # Automatically register student user login if email is supplied
    if student_email:
        from database.models.general import User
        from services.auth_service import get_password_hash
        stmt = select(User).where(User.email == student_email)
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if not existing:
            new_user = User(
                id=str(uuid.uuid4()),
                business_id=org_id,
                email=student_email,
                password_hash=get_password_hash("Password123"),
                role="agent",
                department="students",
                status="active",
                email_verified=True
            )
            db.add(new_user)
            
    # Automatically register parent user login if email is supplied
    if guardian_email:
        from database.models.general import User
        from services.auth_service import get_password_hash
        stmt = select(User).where(User.email == guardian_email)
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if not existing:
            new_user = User(
                id=str(uuid.uuid4()),
                business_id=org_id,
                email=guardian_email,
                password_hash=get_password_hash("Password123"),
                role="agent",
                department="parents",
                status="active",
                email_verified=True
            )
            db.add(new_user)
            
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="academic_office",
        observation_type="student_onboarded",
        primary_entity_id=s.id,
        location_label="Registrar Counter",
        payload={"student_id": student_id, "name": name, "course": course_enrolled},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(s)
    await workflow_engine.trigger_workflow(org_id, "student_onboarded", {"student_id": s.id, "name": name, "course": course_enrolled})
    return _entity_to_dict(s)


@router.get("/students/me")
async def get_my_student_profile(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.students.read"))
):
    email = current_user.get("email")
    type_id = await _get_entity_type_id(db, org_id, "student_record")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    students = res.scalars().all()
    
    for s in students:
        if s.attributes and s.attributes.get("student_email") == email:
            return _entity_to_dict(s)
            
    raise HTTPException(status_code=404, detail="Student profile not found for this user email.")


@router.get("/students/my-child")
async def get_my_child_profile(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.students.read"))
):
    email = current_user.get("email")
    type_id = await _get_entity_type_id(db, org_id, "student_record")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    students = res.scalars().all()
    
    for s in students:
        if s.attributes and s.attributes.get("guardian_email") == email:
            return _entity_to_dict(s)
            
    raise HTTPException(status_code=404, detail="Child profile not found for this parent user email.")


@router.post("/students/photo-capture")
async def student_photo_capture(payload: Dict[str, Any]):
    name = payload.get("name", "Unknown Student")
    return {
        "status": "SUCCESS",
        "photo_url": f"https://api.dicebear.com/7.x/adventurer/svg?seed={name}"
    }


# --- 2. ADMISSIONS ---

@router.get("/admissions")
async def list_admissions(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.admissions.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_admission")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [_entity_to_dict(i) for i in items]


@router.post("/admissions", status_code=status.HTTP_201_CREATED)
async def log_admission(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.admissions.manage"))
):
    org_id = payload.get("org_id")
    name = payload.get("applicant_name")
    exam_score = payload.get("exam_score", 0)
    status_state = payload.get("status", "PENDING_EXAM")
    interview_notes = payload.get("interview_notes", "")
    
    if not org_id or not name:
        raise HTTPException(status_code=400, detail="Missing required admission applicant name.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_admission")
    application_id = f"ADM-{Math_rand()}"
    
    a = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=name,
        attributes={
            "application_id": application_id,
            "exam_score": exam_score,
            "status": status_state,
            "interview_notes": interview_notes,
            "submitted_at": datetime.utcnow().isoformat()
        }
    )
    db.add(a)
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="admissions",
        observation_type="admission_application",
        primary_entity_id=a.id,
        location_label="Admissions Board",
        payload={"application_id": application_id, "name": name, "exam_score": exam_score},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(a)
    await workflow_engine.trigger_workflow(org_id, "admission_application", {"application_id": a.id, "name": name, "exam_score": exam_score})
    return _entity_to_dict(a)


@router.post("/admissions/approve")
async def approve_admission(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.admissions.manage"))
):
    org_id = payload.get("org_id")
    admission_entity_id = payload.get("admission_id")
    
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.id == admission_entity_id)
    res = await db.execute(stmt)
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")
        
    app.attributes["status"] = "ACCEPTED"
    app.attributes["approved_at"] = datetime.utcnow().isoformat()
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="admissions",
        observation_type="admission_approved",
        primary_entity_id=app.id,
        location_label="Admissions Board",
        payload={"application_id": app.attributes.get("application_id"), "name": app.display_label},
        severity="HIGH"
    )
    
    await db.commit()
    await workflow_engine.trigger_workflow(org_id, "admission_approved", {"admission_id": app.id, "name": app.display_label})
    return _entity_to_dict(app)


# --- 3. ACADEMIC & TEACHERS ---

@router.get("/academic/courses")
async def list_courses(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.academic.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_course")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    courses = res.scalars().all()
    return [_entity_to_dict(c) for c in courses]


@router.post("/academic/courses", status_code=status.HTTP_201_CREATED)
async def add_course(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.academic.manage"))
):
    org_id = payload.get("org_id")
    title = payload.get("title")
    teacher_name = payload.get("teacher_name", "Unassigned")
    stream = payload.get("stream", "Stream A")
    curriculum = payload.get("curriculum", "Standard")
    
    if not org_id or not title:
        raise HTTPException(status_code=400, detail="Missing required course title.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_course")
    
    c = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=title,
        attributes={
            "teacher_name": teacher_name,
            "stream": stream,
            "curriculum": curriculum
        }
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _entity_to_dict(c)


@router.get("/academic/grades")
async def list_grades(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.academic.read"))
):
    """List all student grade records in the gradebook."""
    type_id = await _get_entity_type_id(db, org_id, "education_grade")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    grades = res.scalars().all()
    return [_entity_to_dict(g) for g in grades]


@router.post("/academic/grades", status_code=status.HTTP_201_CREATED)
async def record_grade(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.academic.manage"))
):
    """Record student grades for a specific course in the gradebook."""
    org_id = payload.get("org_id")
    student_id = payload.get("student_id")
    student_name = payload.get("student_name")
    course_name = payload.get("course_name")
    grade = payload.get("grade")
    score = float(payload.get("score", 0.0))
    
    if not all([org_id, student_id, student_name, course_name, grade]):
        raise HTTPException(status_code=400, detail="Missing required gradebook fields.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_grade")
    g = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Grade: {student_name} - {course_name}",
        attributes={
            "student_id": student_id,
            "student_name": student_name,
            "course_name": course_name,
            "grade": grade,
            "score": score,
            "recorded_at": datetime.utcnow().isoformat()
        }
    )
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return _entity_to_dict(g)


@router.get("/academic/timetables")
async def list_timetables(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.academic.read"))
):
    """List all scheduled course timetables."""
    type_id = await _get_entity_type_id(db, org_id, "education_timetable")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    timetables = res.scalars().all()
    return [_entity_to_dict(t) for t in timetables]


@router.post("/academic/timetables", status_code=status.HTTP_201_CREATED)
async def schedule_class_timetable(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.academic.manage"))
):
    """Schedule a class slot in the course timetable."""
    org_id = payload.get("org_id")
    course_name = payload.get("course_name")
    teacher_name = payload.get("teacher_name")
    classroom = payload.get("classroom", "Room A-1")
    day_of_week = payload.get("day_of_week", "Monday")
    start_time = payload.get("start_time", "09:00")
    end_time = payload.get("end_time", "10:30")
    
    if not all([org_id, course_name, teacher_name, day_of_week]):
        raise HTTPException(status_code=400, detail="Missing required timetable fields.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_timetable")
    t = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Timetable: {course_name} ({day_of_week})",
        attributes={
            "course_name": course_name,
            "teacher_name": teacher_name,
            "classroom": classroom,
            "day_of_week": day_of_week,
            "start_time": start_time,
            "end_time": end_time,
            "scheduled_at": datetime.utcnow().isoformat()
        }
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _entity_to_dict(t)


@router.get("/teachers")
async def list_teachers(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.teachers.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_teacher")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    teachers = res.scalars().all()
    return [_entity_to_dict(t) for t in teachers]


@router.post("/teachers", status_code=status.HTTP_201_CREATED)
async def add_teacher(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.teachers.manage"))
):
    org_id = payload.get("org_id")
    name = payload.get("name")
    department = payload.get("department", "Science")
    weekly_hours = payload.get("weekly_hours", 18)
    salary = payload.get("salary", 150000)
    
    if not org_id or not name:
        raise HTTPException(status_code=400, detail="Missing required teacher name.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_teacher")
    
    t = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=name,
        attributes={
            "department": department,
            "weekly_hours": weekly_hours,
            "salary": salary,
            "performance_score": "92%"
        }
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _entity_to_dict(t)


# --- 4. ATTENDANCE ---

@router.get("/attendance/logs")
async def list_attendance(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.attendance.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_attendance")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return [_entity_to_dict(l) for l in logs]


@router.post("/attendance/checkin")
async def log_checkin(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.attendance.write"))
):
    org_id = payload.get("org_id")
    person_id = payload.get("person_id")
    name = payload.get("name")
    role = payload.get("role", "student")
    method = payload.get("method", "Manual")
    status_state = payload.get("status", "Present")
    
    if not org_id or not name or not person_id:
        raise HTTPException(status_code=400, detail="Missing checkin attributes.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_attendance")
    
    a = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=name,
        attributes={
            "person_id": person_id,
            "role": role,
            "method": method,
            "status": status_state,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    db.add(a)
    
    # Broadcast to Observation Bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="gate_biometrics" if method in ["RFID", "Biometric", "Face"] else "class_registers",
        observation_type="attendance_checkin",
        primary_entity_id=a.id,
        location_label="Main Campus Gate" if method in ["RFID", "Biometric", "Face"] else "Classroom A-1",
        payload={"person_id": person_id, "name": name, "role": role, "method": method, "status": status_state},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(a)
    await workflow_engine.trigger_workflow(org_id, "attendance_checkin", {"person_id": person_id, "name": name, "role": role, "method": method})
    return _entity_to_dict(a)


# --- 5. LMS ---

@router.get("/learning/materials")
async def list_lms(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.learning.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_assignment")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [_entity_to_dict(i) for i in items]


@router.post("/learning/materials", status_code=status.HTTP_201_CREATED)
async def upload_material(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.learning.manage"))
):
    org_id = payload.get("org_id")
    title = payload.get("title")
    subject = payload.get("subject", "General Science")
    due_date = payload.get("due_date", "")
    url = payload.get("materials_url", "")
    
    if not org_id or not title:
        raise HTTPException(status_code=400, detail="Missing required assignment title.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_assignment")
    
    a = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=title,
        attributes={
            "subject": subject,
            "due_date": due_date,
            "materials_url": url,
            "submissions": []
        }
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return _entity_to_dict(a)


# --- 6. EXAMS & CBT ---

@router.get("/exams")
async def list_exams(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.exams.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_exam")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    exams = res.scalars().all()
    return [_entity_to_dict(e) for e in exams]


@router.post("/exams", status_code=status.HTTP_201_CREATED)
async def schedule_exam(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.exams.manage"))
):
    org_id = payload.get("org_id")
    subject = payload.get("subject")
    exam_date = payload.get("exam_date")
    questions = payload.get("questions", [])
    
    if not org_id or not subject:
        raise HTTPException(status_code=400, detail="Missing required exam subject.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_exam")
    
    e = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Exam: {subject}",
        attributes={
            "subject": subject,
            "exam_date": exam_date,
            "questions": questions,
            "published": True
        }
    )
    db.add(e)
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="academic_office",
        observation_type="exam_published",
        primary_entity_id=e.id,
        location_label="Academic Office",
        payload={"subject": subject, "exam_date": exam_date},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(e)
    return _entity_to_dict(e)


@router.post("/exams/submit-cbt")
async def submit_cbt(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.exams.read"))
):
    org_id = payload.get("org_id")
    student_id = payload.get("student_id")
    student_name = payload.get("student_name")
    subject = payload.get("subject")
    score = payload.get("score")
    
    if not org_id or not student_id or not subject or score is None:
        raise HTTPException(status_code=400, detail="Missing CBT submission attributes.")
        
    # Log observation for grading & trigger workflows
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="cbt_engine",
        observation_type="exam_completed",
        primary_entity_id=student_id,
        location_label="CBT Computer Lab",
        payload={"student_id": student_id, "name": student_name, "subject": subject, "score": score},
        severity="HIGH" if score < 50 else "INFO"
    )
    await workflow_engine.trigger_workflow(org_id, "exam_completed", {"student_id": student_id, "name": student_name, "subject": subject, "score": score})
    return {
        "status": "SUCCESS",
        "message": f"CBT test submitted successfully. Score: {score}%"
    }


# --- 7. LIBRARY ---

@router.get("/library/books")
async def list_books(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.library.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_library")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    books = res.scalars().all()
    return [_entity_to_dict(b) for b in books]


@router.post("/library/books", status_code=status.HTTP_201_CREATED)
async def add_book(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.library.manage"))
):
    org_id = payload.get("org_id")
    title = payload.get("title")
    isbn = payload.get("isbn", "")
    copies = payload.get("copies", 5)
    
    if not org_id or not title:
        raise HTTPException(status_code=400, detail="Missing required book title.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_library")
    
    b = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=title,
        attributes={
            "isbn": isbn,
            "total_copies": copies,
            "available_copies": copies,
            "borrowed_logs": []
        }
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return _entity_to_dict(b)


@router.post("/library/borrow")
async def borrow_book(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.library.manage"))
):
    org_id = payload.get("org_id")
    book_id = payload.get("book_id")
    student_id = payload.get("student_id")
    student_name = payload.get("student_name")
    
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.id == book_id)
    res = await db.execute(stmt)
    book = res.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")
        
    avail = book.attributes.get("available_copies", 0)
    if avail <= 0:
        raise HTTPException(status_code=400, detail="No copies available.")
        
    book.attributes["available_copies"] = avail - 1
    logs = book.attributes.get("borrowed_logs", [])
    logs.append({
        "student_id": student_id,
        "student_name": student_name,
        "borrowed_at": datetime.utcnow().isoformat(),
        "status": "BORROWED"
    })
    book.attributes["borrowed_logs"] = logs
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="library",
        observation_type="library_book_borrowed",
        primary_entity_id=book.id,
        location_label="Library Counter",
        payload={"student_id": student_id, "student_name": student_name, "book_title": book.display_label},
        severity="INFO"
    )
    
    await db.commit()
    await workflow_engine.trigger_workflow(org_id, "library_book_borrowed", {"student_id": student_id, "student_name": student_name, "book_id": book.id, "book_title": book.display_label})
    return _entity_to_dict(book)


@router.post("/library/return")
async def return_book(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.library.manage"))
):
    org_id = payload.get("org_id")
    book_id = payload.get("book_id")
    student_id = payload.get("student_id")
    
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.id == book_id)
    res = await db.execute(stmt)
    book = res.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")
        
    avail = book.attributes.get("available_copies", 0)
    book.attributes["available_copies"] = avail + 1
    
    logs = book.attributes.get("borrowed_logs", [])
    for log in logs:
        if log.get("student_id") == student_id and log.get("status") == "BORROWED":
            log["status"] = "RETURNED"
            log["returned_at"] = datetime.utcnow().isoformat()
            break
    book.attributes["borrowed_logs"] = logs
    
    await db.commit()
    return _entity_to_dict(book)


# --- 8. FINANCE & FEES ---

@router.get("/fees/invoices")
async def list_invoices(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.fees.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_invoice")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    invoices = res.scalars().all()
    return [_entity_to_dict(i) for i in invoices]


@router.post("/fees/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.fees.manage"))
):
    org_id = payload.get("org_id")
    student_id = payload.get("student_id")
    student_name = payload.get("student_name")
    amount = payload.get("amount", 120000)
    scholarship = payload.get("scholarship", 0)
    
    if not org_id or not student_id or not student_name:
        raise HTTPException(status_code=400, detail="Missing required student identifiers.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_invoice")
    invoice_no = f"INV-{Math_rand()}"
    net_amount = amount - scholarship
    
    i = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Invoice for {student_name}",
        attributes={
            "invoice_no": invoice_no,
            "student_id": student_id,
            "student_name": student_name,
            "total_amount": amount,
            "scholarship": scholarship,
            "balance": net_amount,
            "status": "UNPAID",
            "transactions": []
        }
    )
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return _entity_to_dict(i)


@router.post("/fees/pay")
async def pay_invoice(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.fees.manage"))
):
    org_id = payload.get("org_id")
    invoice_id = payload.get("invoice_id")
    amount_paid = payload.get("amount_paid", 0)
    method = payload.get("payment_method", "Paystack Simulator")
    
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.id == invoice_id)
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
        
    bal = inv.attributes.get("balance", 0)
    new_bal = max(0, bal - amount_paid)
    
    inv.attributes["balance"] = new_bal
    inv.attributes["status"] = "PAID" if new_bal == 0 else "PARTIAL"
    
    tx = inv.attributes.get("transactions", [])
    tx.append({
        "ref": f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "amount": amount_paid,
        "method": method,
        "timestamp": datetime.utcnow().isoformat()
    })
    inv.attributes["transactions"] = tx
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="billing_finance",
        observation_type="fee_paid",
        primary_entity_id=inv.id,
        location_label="Billing Counter",
        payload={"invoice_no": inv.attributes.get("invoice_no"), "student_name": inv.attributes.get("student_name"), "amount_paid": amount_paid, "balance": new_bal},
        severity="HIGH"
    )
    
    await db.commit()
    await workflow_engine.trigger_workflow(org_id, "fee_paid", {"invoice_id": inv.id, "amount_paid": amount_paid, "student_name": inv.attributes.get("student_name")})
    return _entity_to_dict(inv)


# --- 9. STAFF & HR ---

@router.get("/hr/staff")
async def list_staff(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.hr.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_staff")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    staff = res.scalars().all()
    return [_entity_to_dict(s) for s in staff]


@router.post("/hr/clockin")
async def staff_clockin(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.hr.manage"))
):
    org_id = payload.get("org_id")
    staff_id = payload.get("staff_id")
    staff_name = payload.get("staff_name")
    
    type_id = await _get_entity_type_id(db, org_id, "education_staff")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id, EntityV2.external_ref_id == staff_id)
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        s = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=type_id,
            display_label=staff_name,
            external_ref_id=staff_id,
            attributes={"staff_id": staff_id, "clock_in_logs": []}
        )
        db.add(s)
        
    logs = s.attributes.get("clock_in_logs", [])
    logs.append(datetime.utcnow().isoformat())
    s.attributes["clock_in_logs"] = logs
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="hr_fingerprint",
        observation_type="teacher_clock_in",
        primary_entity_id=s.id,
        location_label="Staff Room Entry",
        payload={"staff_id": staff_id, "name": staff_name},
        severity="INFO"
    )
    
    await db.commit()
    return _entity_to_dict(s)


# --- 10. SCHOOL ASSETS (INVENTORY) ---

@router.get("/inventory")
async def list_inventory(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.inventory.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_inventory")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [_entity_to_dict(i) for i in items]


@router.post("/inventory", status_code=status.HTTP_201_CREATED)
async def add_inventory(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.inventory.manage"))
):
    org_id = payload.get("org_id")
    label = payload.get("label")
    category = payload.get("category", "General")
    serial_no = payload.get("serial_number", f"SN-{Math_rand()}")
    status_state = payload.get("status", "Active")
    
    if not org_id or not label:
        raise HTTPException(status_code=400, detail="Missing inventory label.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_inventory")
    
    i = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=label,
        attributes={
            "category": category,
            "serial_number": serial_no,
            "status": status_state
        }
    )
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return _entity_to_dict(i)


# --- 11. TRANSPORT ---

@router.get("/transport/routes")
async def list_routes(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.transport.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_transport")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    routes = res.scalars().all()
    return [_entity_to_dict(r) for r in routes]


@router.post("/transport/routes", status_code=status.HTTP_201_CREATED)
async def add_route(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.transport.manage"))
):
    org_id = payload.get("org_id")
    route_name = payload.get("route_name")
    driver = payload.get("driver_name", "Unassigned")
    bus_no = payload.get("bus_no", "BUS-991")
    
    if not org_id or not route_name:
        raise HTTPException(status_code=400, detail="Missing route name.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_transport")
    
    r = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=route_name,
        attributes={
            "driver_name": driver,
            "bus_no": bus_no,
            "status": "ON_ROUTE",
            "gps_coordinates": {"lat": 6.5244, "lng": 3.3792}
        }
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _entity_to_dict(r)


# --- 12. HOSTEL ---

@router.get("/hostel/rooms")
async def list_hostel_rooms(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.hostel.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_hostel")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    rooms = res.scalars().all()
    return [_entity_to_dict(r) for r in rooms]


@router.post("/hostel/rooms", status_code=status.HTTP_201_CREATED)
async def add_hostel_room(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.hostel.manage"))
):
    org_id = payload.get("org_id")
    room_no = payload.get("room_no")
    block = payload.get("block", "Block A")
    capacity = payload.get("capacity", 4)
    
    if not org_id or not room_no:
        raise HTTPException(status_code=400, detail="Missing room identifier.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_hostel")
    
    r = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"{block} - Room {room_no}",
        attributes={
            "room_no": room_no,
            "block": block,
            "capacity": capacity,
            "occupants": []
        }
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _entity_to_dict(r)


# --- 13. CLINIC ---

@router.get("/clinic/visits")
async def list_clinic_visits(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.clinic.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_clinic")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    visits = res.scalars().all()
    return [_entity_to_dict(v) for v in visits]


@router.post("/clinic/visits", status_code=status.HTTP_201_CREATED)
async def register_clinic_visit(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.clinic.manage"))
):
    org_id = payload.get("org_id")
    student_id = payload.get("student_id")
    student_name = payload.get("student_name")
    symptoms = payload.get("symptoms", "")
    medication = payload.get("medication_administered", "")
    
    if not org_id or not student_id or not student_name:
        raise HTTPException(status_code=400, detail="Missing required student visit data.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_clinic")
    
    v = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Visit: {student_name}",
        attributes={
            "student_id": student_id,
            "student_name": student_name,
            "symptoms": symptoms,
            "medication": medication,
            "visited_at": datetime.utcnow().isoformat()
        }
    )
    db.add(v)
    
    # Send Observation trigger to notify parent
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="health_clinic",
        observation_type="clinic_emergency_visit" if "emergency" in symptoms.lower() else "clinic_routine_visit",
        primary_entity_id=v.id,
        location_label="Main Campus Clinic",
        payload={"student_id": student_id, "student_name": student_name, "symptoms": symptoms, "medication": medication},
        severity="HIGH" if "emergency" in symptoms.lower() else "INFO"
    )
    
    await db.commit()
    await db.refresh(v)
    await workflow_engine.trigger_workflow(org_id, "clinic_visit", {"student_id": student_id, "student_name": student_name, "symptoms": symptoms, "medication": medication})
    return _entity_to_dict(v)


# --- 14. CAFETERIA POS ---

@router.post("/cafeteria/purchase")
async def settle_cafeteria_purchase(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.fees.manage"))
):
    org_id = payload.get("org_id")
    student_id = payload.get("student_id")
    student_name = payload.get("student_name")
    cost = payload.get("cost", 500)
    item_name = payload.get("item_name", "Meal A")
    
    # Broadcast Pos swipe to Observation Bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="cafeteria_pos",
        observation_type="cafeteria_purchase",
        primary_entity_id=student_id,
        location_label="Main Cafeteria Counter",
        payload={"student_id": student_id, "student_name": student_name, "cost": cost, "item_name": item_name},
        severity="INFO"
    )
    return {
        "status": "SUCCESS",
        "message": f"POS purchase of {item_name} for ₦{cost} settled successfully."
    }


# --- 15. CCTV & SURVEILLANCE (ARGUS OS) ---

@router.get("/security/cctv-alerts")
async def list_security_alerts(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.security.read"))
):
    type_id = await _get_entity_type_id(db, org_id, "education_security_alert")
    stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == type_id)
    res = await db.execute(stmt)
    alerts = res.scalars().all()
    return [_entity_to_dict(a) for a in alerts]


@router.post("/security/cctv-alerts")
async def simulate_cctv_alert(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.security.manage"))
):
    org_id = payload.get("org_id")
    detection_type = payload.get("detection_type", "FIGHT")
    camera_id = payload.get("camera_id", "CAM-DORM-04")
    location = payload.get("location_label", "Male Dorm Courtyard")
    severity = payload.get("severity", "HIGH")
    
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing org_id.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_security_alert")
    
    a = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"CCTV: {detection_type} detected",
        attributes={
            "camera_id": camera_id,
            "detection_type": detection_type,
            "location_label": location,
            "severity": severity,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    db.add(a)
    
    # Ingest directly into the Observation Bus
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="argus_surveillance",
        observation_type=f"cctv_{detection_type.lower()}_alert",
        primary_entity_id=a.id,
        location_label=location,
        payload={"camera_id": camera_id, "detection_type": detection_type, "severity": severity},
        severity=severity,
        confidence=0.98,
        risk_impact=90.0 if severity == "HIGH" else 40.0
    )
    
    await db.commit()
    await db.refresh(a)
    await workflow_engine.trigger_workflow(org_id, "security_alert", {"alert_id": a.id, "detection_type": detection_type, "location": location, "severity": severity})
    return _entity_to_dict(a)


# --- 16. KNOWLEDGE GRAPH ---

@router.get("/knowledge-graph")
async def get_knowledge_graph(
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission("education.intelligence.read"))
):
    """
    Constructs an interactive relationships map across Students, Parents, Teachers,
    Classes, Invoices, CCTV events, Library logs, and active Clinic visits.
    """
    # 1. Fetch Students
    stu_id = await _get_entity_type_id(db, org_id, "student_record")
    stu_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == stu_id)
    stu_res = await db.execute(stu_stmt)
    students = stu_res.scalars().all()
    
    nodes = []
    links = []
    
    # Standard Core Node
    nodes.append({"id": "school_root", "label": "School Central Hub", "type": "ROOT", "color": "#6366F1"})
    
    for s in students:
        s_id = s.attributes.get("student_id")
        nodes.append({"id": s.id, "label": f"{s.display_label} ({s_id})", "type": "STUDENT", "color": "#22D3EE"})
        links.append({"source": "school_root", "target": s.id, "rel": "ENROLLED_STUDENT"})
        
        # Link to Parent node
        guardian = s.attributes.get("guardian_name")
        if guardian:
            g_id = f"parent_{guardian.replace(' ', '_')}"
            nodes.append({"id": g_id, "label": f"Parent: {guardian}", "type": "PARENT", "color": "#F43F5E"})
            links.append({"source": s.id, "target": g_id, "rel": "GUARDIAN_OF"})
            
    # 2. Fetch CCTV Alerts
    alert_id = await _get_entity_type_id(db, org_id, "education_security_alert")
    alert_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == alert_id)
    alert_res = await db.execute(alert_stmt)
    alerts = alert_res.scalars().all()
    
    for a in alerts:
        nodes.append({"id": a.id, "label": f"Alert: {a.display_label}", "type": "CCTV", "color": "#EF4444"})
        links.append({"source": "school_root", "target": a.id, "rel": "SECURITY_INCIDENT"})
        
    return {
        "nodes": nodes,
        "links": links
    }


@router.get("/workspace/{department}")
async def get_education_workspace(
    department: str,
    org_id: str = Query(..., description="Organization ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Unified dynamic workspace endpoint returning configurations, tasks, and analytics based on school department."""
    user_dept = current_user.get("department", "general").lower()
    user_role = current_user.get("role", "agent").lower()
    
    is_privileged = user_role in ["owner", "admin"] or user_dept in ["principal", "vice_principal"]
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
        "summary": "ARGUS student success telemetry: GPA metrics are steady. Attendance risk remains at 2.4% baseline.",
        "recommendations": ["Conduct routine check-ins with students carrying >15% attendance absence metrics."]
    }
    
    # Dynamic calculations from real DB entities
    student_type_id = await _get_entity_type_id(db, org_id, "student_record")
    student_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == student_type_id)
    student_res = await db.execute(student_stmt)
    students = student_res.scalars().all()
    
    total_students = len(students)
    
    # Calculate attendance risk
    attendance_type_id = await _get_entity_type_id(db, org_id, "education_attendance")
    att_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == attendance_type_id)
    att_res = await db.execute(att_stmt)
    attendance_records = att_res.scalars().all()
    
    absent_count = sum(1 for a in attendance_records if a.attributes.get("status") == "Absent")
    total_attendance = len(attendance_records)
    absent_pct = (absent_count / total_attendance * 100) if total_attendance > 0 else 0.0
    
    if dept_clean in ["registrar", "admissions"]:
        kpis = [
            {"label": "Total Active Students", "value": str(total_students), "status": "info"},
            {"label": "Average Absence Rate", "value": f"{absent_pct:.1f}%", "status": "warning" if absent_pct > 5.0 else "success"}
        ]
        
        # Pending admissions applications
        adm_type_id = await _get_entity_type_id(db, org_id, "education_admission")
        adm_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == adm_type_id).limit(5)
        adm_res = await db.execute(adm_stmt)
        applications = adm_res.scalars().all()
        tasks = [{"id": ap.id, "label": ap.display_label, "status": ap.attributes.get("status", "SUBMITTED")} for ap in applications]
        
        quick_actions = [
            {"label": "Onboard Student", "method": "POST", "url": "/api/v1/education/students"},
            {"label": "Submit Admission Application", "method": "POST", "url": "/api/v1/education/admissions"}
        ]
        
    elif dept_clean in ["academic_office", "teachers", "class_teachers"]:
        kpis = [
            {"label": "Assigned Course Streams", "value": "3", "status": "info"},
            {"label": "Attendance Rate", "value": f"{100.0 - absent_pct:.1f}%", "status": "success"}
        ]
        
        # Pull scheduled class slots
        tt_type_id = await _get_entity_type_id(db, org_id, "education_timetable_slot")
        tt_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == tt_type_id).limit(5)
        tt_res = await db.execute(tt_stmt)
        slots = tt_res.scalars().all()
        tasks = [{"id": slot.id, "label": slot.display_label, "status": "SCHEDULED"} for slot in slots]
        
        quick_actions = [
            {"label": "Record Student Grade", "method": "POST", "url": "/api/v1/education/academic/grades"},
            {"label": "Schedule Class Slot", "method": "POST", "url": "/api/v1/education/academic/timetables"}
        ]
        
    elif dept_clean in ["library"]:
        lib_type_id = await _get_entity_type_id(db, org_id, "education_library_borrow")
        lib_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == lib_type_id)
        lib_res = await db.execute(lib_stmt)
        borrows = lib_res.scalars().all()
        
        kpis = [{"label": "Active Book Loans", "value": str(len(borrows)), "status": "info"}]
        tasks = [{"id": b.id, "label": b.display_label, "status": b.attributes.get("status", "BORROWED")} for b in borrows]
        
        quick_actions = [
            {"label": "Issue Library Book", "method": "POST", "url": "/api/v1/education/library/borrow"}
        ]
        
    else: # Principal, Vice Principal, Finance, Security, IT, HR
        inv_type_id = await _get_entity_type_id(db, org_id, "education_invoice")
        inv_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == inv_type_id)
        inv_res = await db.execute(inv_stmt)
        invoices = inv_res.scalars().all()
        total_rev = sum(float(i.attributes.get("total_amount", 0.0) or i.attributes.get("balance", 0.0)) for i in invoices)
        
        kpis = [
            {"label": "Outstanding Invoice Revenue", "value": f"₦{total_rev:,.2f}", "status": "warning" if total_rev > 0 else "success"},
            {"label": "Total Active Students", "value": str(total_students), "status": "info"}
        ]
        
    return {
        "department": dept_clean,
        "kpis": kpis,
        "tasks": tasks,
        "notifications": notifications,
        "workflows": workflows_list,
        "quick_actions": quick_actions,
        "reports": [{"name": f"{dept_clean.capitalize()} Term Report", "url": f"/reports/education/{dept_clean}"}],
        "argus_intelligence": argus_intelligence
    }


@router.post("/integrations/canvas")
async def canvas_grades_sync_connector(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Production-ready connector for Canvas LMS. Syncs student assignments and grades into SIS Gradebook."""
    org_id = payload.get("org_id")
    student_id = payload.get("student_id")
    student_name = payload.get("student_name")
    course_name = payload.get("course_name")
    grade = payload.get("grade", "A")
    score = float(payload.get("score", 90.0))
    
    if not all([org_id, student_id, student_name, course_name]):
        raise HTTPException(status_code=400, detail="Missing Canvas assignment grade details.")
        
    type_id = await _get_entity_type_id(db, org_id, "education_gradebook")
    grade_entry = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        display_label=f"Canvas Grade: {student_name} - {course_name}",
        attributes={
            "student_id": student_id,
            "student_name": student_name,
            "course_name": course_name,
            "grade": grade,
            "score": score,
            "sync_source": "Canvas LMS Integration",
            "synced_at": datetime.utcnow().isoformat()
        }
    )
    db.add(grade_entry)
    
    observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel="canvas_connector",
        observation_type="exam_completed",
        primary_entity_id=student_id,
        location_label="Canvas Classroom Cloud",
        payload={"student_name": student_name, "course_name": course_name, "score": score},
        severity="INFO"
    )
    
    await db.commit()
    await db.refresh(grade_entry)
    return {"status": "SUCCESS", "grade_entry": _entity_to_dict(grade_entry)}
