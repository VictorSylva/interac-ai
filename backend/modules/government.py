"""
InteracAI Government & Case Management Module.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
from services.copilot_skill_registry import copilot_skill_registry


class GovernmentModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_government",
            name="Government & Public Administration Operations",
            version="1.0.0",
            description="Citizen directory, case administration, incident reports, and public investigations.",
            category="Government & Revenue Authority",
            icon="Globe",
            entity_types=[
                EntityTypeSpec(code="citizen_record", label="Citizen Profile", icon="UserCheck"),
                EntityTypeSpec(code="gov_case", label="Case File", icon="FolderOpen"),
                EntityTypeSpec(code="incident_log", label="Public Incident Report", icon="AlertTriangle")
            ],
            copilot_skills=[
                "module_government:analyze_case_load",
                "module_government:synthesize_audit_dossier"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/government/cases", component="GovCasesPage", title="Case Registry", icon="FolderOpen"),
                    UIRouteSpec(path="/government/citizens", component="GovCitizensPage", title="Citizen Directory", icon="Users"),
                    UIRouteSpec(path="/government/incidents", component="GovIncidentsPage", title="Incident Dispatch", icon="AlertTriangle")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="gov_active_cases", type="metric", title="Active Investigations", icon="FolderOpen", config={"value": "124"}),
                    WidgetSpec(id="gov_avg_resolution", type="metric", title="Avg Resolution Time", icon="Clock", config={"value": "4.2 days"})
                ]
            ),
            permissions=[
                PermissionSpec(department="investigations", role_tier="officer"),
                PermissionSpec(department="finance", role_tier="manager"),
                PermissionSpec(department="audits", role_tier="officer")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_government",
            name="analyze_case_load",
            description="Evaluates case backlogs and staff caseload allocations.",
            handler=self._skill_case_load
        )
        copilot_skill_registry.register_skill(
            module_id="module_government",
            name="synthesize_audit_dossier",
            description="Aggregates asset ownership records and financial matches for target audits.",
            handler=self._skill_audit_dossier
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_government"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "overdue_investigation_case", "risk_weight": 0.6}]

    async def _skill_case_load(self, **kwargs) -> Dict[str, Any]:
        return {
            "total_open_cases": 124,
            "allocated_officers": 15,
            "backlogged_cases": 18,
            "efficiency_rating": "89%"
        }

    async def _skill_audit_dossier(self, taxpayer_id: str = "default", **kwargs) -> Dict[str, Any]:
        return {
            "taxpayer": taxpayer_id,
            "unmatched_assets_value": "₦45,000,000",
            "linked_companies": 3,
            "risk_profile": "HIGH_RISK_AUDIT"
        }
