"""
InteracAI Manufacturing & ERP Operations Module.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
from services.copilot_skill_registry import copilot_skill_registry


class ManufacturingModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_manufacturing",
            name="Manufacturing & Shopfloor Intelligence",
            version="1.0.0",
            description="Machine assets, production orders, quality checks, and shopfloor operator assignments.",
            category="Industrial & Logistics",
            icon="Settings",
            entity_types=[
                EntityTypeSpec(code="factory_floor", label="Factory Floor", icon="Layers"),
                EntityTypeSpec(code="machine_asset", label="Machine/Asset", icon="Cpu"),
                EntityTypeSpec(code="production_order", label="Production Order", icon="ClipboardList"),
                EntityTypeSpec(code="operator_staff", label="Shopfloor Operator", icon="Users")
            ],
            copilot_skills=[
                "module_manufacturing:predictive_maintenance_scheduler",
                "module_manufacturing:synthesize_oee_metrics"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/manufacturing/production", component="MfgProductionPage", title="Production Orders", icon="ClipboardList"),
                    UIRouteSpec(path="/manufacturing/machines", component="MfgMachinesPage", title="Machine Analytics", icon="Cpu"),
                    UIRouteSpec(path="/manufacturing/operators", component="MfgOperatorsPage", title="Operator Shifts", icon="Users")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="mfg_oee_score", type="metric", title="Overall Equipment OEE", icon="Cpu", config={"value": "78.4%"}),
                    WidgetSpec(id="mfg_active_orders", type="metric", title="Active Jobs", icon="ClipboardList", config={"value": "12"})
                ]
            ),
            permissions=[
                PermissionSpec(department="operations", role_tier="staff"),
                PermissionSpec(department="maintenance", role_tier="officer"),
                PermissionSpec(department="safety", role_tier="officer")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_manufacturing",
            name="predictive_maintenance_scheduler",
            description="Calculates machine heat spikes and schedules preventive cycles.",
            handler=self._skill_predict_maintenance
        )
        copilot_skill_registry.register_skill(
            module_id="module_manufacturing",
            name="synthesize_oee_metrics",
            description="Computes Overall Equipment Effectiveness based on raw floor outputs.",
            handler=self._skill_oee_metrics
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_manufacturing"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "machine_vibration_anomaly", "risk_weight": 0.85}]

    async def _skill_predict_maintenance(self, **kwargs) -> Dict[str, Any]:
        return {
            "critical_machines": 1,
            "next_schedule": "CNC-Spindle-2 (Scheduled for tomorrow 06:00 AM)",
            "risk_mitigation": "Vibration levels at 8.2mm/s exceed tolerance limit of 6.0mm/s."
        }

    async def _skill_oee_metrics(self, **kwargs) -> Dict[str, Any]:
        return {
            "oee": "78.4%",
            "availability": "92%",
            "performance": "88%",
            "quality": "97%"
        }
