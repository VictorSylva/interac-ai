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
