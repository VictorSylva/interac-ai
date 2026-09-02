import asyncio
import sys
import os
import uuid
from sqlalchemy import select
from datetime import datetime

# Add backend directory to system path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal
from database.models.general import User, Business
from database.models.dynamic_entity import EntityType, EntityV2
from database.models.observation import ObservationV2
from modules.education import EducationModule
from services.auth_service import register_business, get_user_permissions, DEFAULT_ROLE_PERMISSIONS


async def test_education_integration():
    print("--- Starting Enterprise Education Intelligence Integration Tests ---")
    
    org_email = f"principal_{uuid.uuid4().hex[:6]}@school.com"
    pwd = "password123"
    school_name = "Antigravity Academy"
    
    # 1. Register Business & Setup Mappings
    print("\n[1] Registering School and Principal Workspace...")
    async with AsyncSessionLocal() as session:
        reg_result = await register_business(session, org_email, pwd, school_name)
        org_id = reg_result['business_id']
        user_id = reg_result['user_id']
        print(f"School Org ID: {org_id}")
        print(f"Principal User ID: {user_id}")
        
        # Principal/Owner Role permissions evaluation
        stmt = select(User).where(User.id == user_id)
        res = await session.execute(stmt)
        principal = res.scalar_one()
        permissions = await get_user_permissions(principal, session)
        print(f"Principal Permissions Count: {len(permissions)}")
        assert len(permissions) > 0
        assert "education.students.read" in permissions
        print("Principal has educational permissions mapped.")

    # 2. Test Department Role Permissions
    print("\n[2] Verifying Granular Department Roles (Registrar, Teacher, Parent)...")
    registrar_perms = DEFAULT_ROLE_PERMISSIONS.get("registrar", [])
    teacher_perms = DEFAULT_ROLE_PERMISSIONS.get("teachers", [])
    parent_perms = DEFAULT_ROLE_PERMISSIONS.get("parents", [])
    
    print(f"Registrar Role Permissions: {registrar_perms}")
    print(f"Teacher Role Permissions: {teacher_perms}")
    print(f"Parent Role Permissions: {parent_perms}")
    
    assert "education.students.read" in registrar_perms
    assert "education.admissions.read" in registrar_perms
    assert "education.attendance.write" in teacher_perms
    assert "education.learning.read" in parent_perms
    print("Granular department roles validated.")

    # 3. Test Module Manifest & Install Hooks
    print("\n[3] Triggering Education Module Installer...")
    mod = EducationModule()
    async with AsyncSessionLocal() as session:
        success = await mod.on_install(org_id=org_id, db_session=session)
        assert success is True
        print("Module install hook succeeded.")

        # Verify entity types are registered in Database
        stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == "student_record")
        res = await session.execute(stmt)
        et = res.scalar_one_or_none()
        assert et is not None
        print(f"Verified EntityType DB Registration: {et.code} (ID: {et.id})")

    # 4. Test Copilot Skills Execution
    print("\n[4] Running AI Copilot Skills...")
    skills = await mod.get_copilot_skills()
    assert len(skills) > 0
    print(f"Loaded Skills Count: {len(skills)}")

    dropout_res = await mod._skill_predict_dropout(org_id=org_id)
    assert "flagged_high_risk" in dropout_res
    print(f"AI Dropout Skill Result: {str(dropout_res).encode('ascii', 'replace').decode('ascii')}")

    fee_res = await mod._skill_predict_defaults(org_id=org_id)
    assert "default_forecast_rate" in fee_res
    print(f"AI Fee Default Forecast: {str(fee_res).encode('ascii', 'replace').decode('ascii')}")

    workload_res = await mod._skill_analyze_workload(org_id=org_id)
    assert "average_workload_hours_weekly" in workload_res
    print(f"AI Teacher Workload Audit: {str(workload_res).encode('ascii', 'replace').decode('ascii')}")

    report_res = await mod._skill_generate_report_card(org_id=org_id, student_id="EDU-STUD-5541")
    assert "grades" in report_res
    print(f"AI Generated Report Card: {str(report_res).encode('ascii', 'replace').decode('ascii')}")

    # 5. Ingest CCTV Alerts & Verify Observation Bus Ingestion
    print("\n[5] Simulating CCTV Surveillance alert via Argus OS...")
    async with AsyncSessionLocal() as session:
        # Ingest directly using simulation parameters
        from services.observation_service import observation_service
        
        obs = observation_service.record_observation(
            db=session,
            org_id=org_id,
            source_channel="argus_surveillance",
            observation_type="cctv_fight_alert",
            primary_entity_id=f"ent_{uuid.uuid4().hex[:16]}",
            location_label="Male Dorm Courtyard",
            payload={"camera_id": "CAM-DORM-04", "detection_type": "FIGHT", "severity": "HIGH"},
            severity="HIGH",
            confidence=0.98,
            risk_impact=90
        )
        await session.commit()
        print(f"Simulated alert logged. Querying Observation Bus...")

        stmt = select(ObservationV2).where(ObservationV2.org_id == org_id, ObservationV2.observation_type == "cctv_fight_alert")
        res = await session.execute(stmt)
        logged_obs = res.scalars().all()
        assert len(logged_obs) > 0
        print(f"Successfully retrieved Observation: {logged_obs[0].observation_type} (Severity: {logged_obs[0].severity})")

    print("\n--- All Education Intelligence Module Integration Tests Passed Successfully ---")

if __name__ == "__main__":
    asyncio.run(test_education_integration())
