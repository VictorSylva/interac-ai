"""
InteracAI Church & Ministry Operating Module.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
from services.copilot_skill_registry import copilot_skill_registry


class ChurchModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_church",
            name="Church & Ministry Operations",
            version="1.0.0",
            description="Member management, small groups, attendance logs, volunteer rosters, and contribution tracking.",
            category="Non-Profit & Religion",
            icon="Heart",
            entity_types=[
                EntityTypeSpec(code="church_member", label="Member Profile", icon="UserCheck"),
                EntityTypeSpec(code="church_attendance", label="Attendance Record", icon="Calendar"),
                EntityTypeSpec(code="church_giving", label="Contribution Ledger", icon="DollarSign"),
                EntityTypeSpec(code="church_volunteer", label="Volunteer Schedule", icon="Clock")
            ],
            copilot_skills=[
                "module_church:summarize_attendance_trends",
                "module_church:recommend_visitor_followup"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/church/members", component="ChurchMembersPage", title="Member Directory", icon="Users"),
                    UIRouteSpec(path="/church/giving", component="ChurchGivingPage", title="Giving & Finances", icon="DollarSign"),
                    UIRouteSpec(path="/church/volunteers", component="ChurchVolunteersPage", title="Volunteer Rosters", icon="Clock")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="church_weekly_attendance", type="chart", title="Weekly Attendance", icon="TrendingUp", config={}),
                    WidgetSpec(id="church_giving_summary", type="metric", title="Mtd Contributions", icon="DollarSign", config={"value": "$45,200"})
                ]
            ),
            permissions=[
                PermissionSpec(department="pastor", role_tier="officer"),
                PermissionSpec(department="finance", role_tier="manager"),
                PermissionSpec(department="media", role_tier="staff"),
                PermissionSpec(department="choir", role_tier="staff"),
                PermissionSpec(department="youth", role_tier="staff"),
                PermissionSpec(department="children", role_tier="staff"),
                PermissionSpec(department="prayer", role_tier="staff")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_church",
            name="summarize_attendance_trends",
            description="Analyzes monthly weekly service attendance across all ministries.",
            handler=self._skill_attendance_trends
        )
        copilot_skill_registry.register_skill(
            module_id="module_church",
            name="recommend_visitor_followup",
            description="Identifies first-time visitors and flags pastoral care outreach needs.",
            handler=self._skill_visitor_followup
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_church"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "consecutive_missed_services", "risk_weight": 0.4}]

    async def _skill_attendance_trends(self, **kwargs) -> Dict[str, Any]:
        return {
            "weekly_average": 420,
            "growth_rate": "+6% MoM",
            "fastest_growing": "Youth Ministry",
            "retention_index": "92%"
        }

    async def _skill_visitor_followup(self, **kwargs) -> Dict[str, Any]:
        return {
            "new_visitors_this_week": 8,
            "pending_followups": [
                {"name": "Sister Emem Udo", "status": "Needs Call", "assigned_pastor": "Pastor Joshua"}
            ],
            "action_item": "Send welcome package to 8 new families."
        }
