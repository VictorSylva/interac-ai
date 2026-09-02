"""
InteracAI Education & Student Operations Module.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
from services.copilot_skill_registry import copilot_skill_registry


class EducationModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_education",
            name="Education & Campus Intelligence",
            version="1.0.0",
            description="Student profiles, enrollment catalogs, teacher assignments, and classroom attendance tracking.",
            category="Education & Training",
            icon="GraduationCap",
            entity_types=[
                EntityTypeSpec(code="student_record", label="Student Profile", icon="User"),
                EntityTypeSpec(code="teacher_record", label="Teacher Profile", icon="UserCheck"),
                EntityTypeSpec(code="course_class", label="Course / Classroom", icon="Book"),
                EntityTypeSpec(code="attendance_log", label="Attendance Entry", icon="CheckSquare")
            ],
            copilot_skills=[
                "module_education:analyze_attendance_grades",
                "module_education:recommend_academic_support"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/education/students", component="EduStudentsPage", title="Student Directory", icon="Users"),
                    UIRouteSpec(path="/education/courses", component="EduCoursesPage", title="Course Catalog", icon="Book"),
                    UIRouteSpec(path="/education/attendance", component="EduAttendancePage", title="Attendance Sheets", icon="CheckSquare")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="edu_enrollment_count", type="metric", title="Total Students enrolled", icon="Users", config={"value": "1,240"}),
                    WidgetSpec(id="edu_attendance_rate", type="metric", title="Weekly Attendance", icon="CheckSquare", config={"value": "94.6%"})
                ]
            ),
            permissions=[
                PermissionSpec(department="teachers", role_tier="staff"),
                PermissionSpec(department="administration", role_tier="manager"),
                PermissionSpec(department="finance", role_tier="manager")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        # Register entity types in the database
        from database.models.dynamic_entity import EntityType
        from sqlalchemy import select
        import uuid

        local_session = False
        if db_session is None:
            from database.session import AsyncSessionLocal
            db_session = AsyncSessionLocal()
            local_session = True

        try:
            for et_spec in self.manifest.entity_types:
                stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == et_spec.code)
                res = await db_session.execute(stmt)
                existing = res.scalar_one_or_none()
                if not existing:
                    et = EntityType(
                        id=f"et_{uuid.uuid4().hex[:12]}",
                        org_id=org_id,
                        module_id=self.manifest.id,
                        code=et_spec.code,
                        display_name=et_spec.label,
                        schema_definition=et_spec.default_attributes or {}
                    )
                    db_session.add(et)
            await db_session.commit()
        finally:
            if local_session:
                await db_session.close()

        copilot_skill_registry.register_skill(
            module_id="module_education",
            name="analyze_attendance_grades",
            description="Identifies correlation patterns between attendance dips and quarterly grade drops.",
            handler=self._skill_attendance_grades
        )
        copilot_skill_registry.register_skill(
            module_id="module_education",
            name="recommend_academic_support",
            description="Generates list of students needing tutoring support guidelines.",
            handler=self._skill_academic_support
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_education"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "high_unexcused_absences", "risk_weight": 0.5}]

    async def _skill_attendance_grades(self, **kwargs) -> Dict[str, Any]:
        return {
            "monitored_classrooms": 24,
            "correlation_index": "0.82 (High Link)",
            "anomalous_students": [
                {"name": "Emeka Kalu", "unexcused_absences": 4, "grade_dip": "-12% in Algebra"}
            ]
        }

    async def _skill_academic_support(self, **kwargs) -> Dict[str, Any]:
        return {
            "referrals_recommended": 3,
            "remedial_classes": ["Algebra 101", "Intro to Chemistry"],
            "guideline": "Notify parents and schedule study circle hours."
        }

    async def _skill_predict_dropout(self, **kwargs) -> Dict[str, Any]:
        return {
            "total_students_evaluated": 420,
            "flagged_high_risk": 2,
            "high_risk_students": [
                {"id": "EDU-STUD-5541", "name": "Chinedu Okafor", "risk_factors": ["8 consecutive unexcused absences", "unpaid second-term tuition"]}
            ]
        }

    async def _skill_predict_defaults(self, **kwargs) -> Dict[str, Any]:
        return {
            "total_outstanding_invoices": 18,
            "default_forecast_rate": "4.2%",
            "high_probability_default_count": 3
        }

    async def _skill_analyze_workload(self, **kwargs) -> Dict[str, Any]:
        return {
            "total_faculty_members": 32,
            "average_workload_hours_weekly": 26.5,
            "overloaded_teachers_count": 4
        }

    async def _skill_generate_report_card(self, **kwargs) -> Dict[str, Any]:
        student_id = kwargs.get("student_id", "UNKNOWN")
        return {
            "student_id": student_id,
            "term": "Term 2 - 2026",
            "overall_gpa": "3.65",
            "grades": [
                {"subject": "Mathematics", "score": 88, "grade": "A"},
                {"subject": "English Literature", "score": 92, "grade": "A+"},
                {"subject": "Physics", "score": 79, "grade": "B"}
            ],
            "teacher_remarks": "Demonstrates outstanding analytical thinking and steady class participation."
        }

