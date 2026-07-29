"""
InteracAI Agriculture & Crop Operations Module.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
from services.copilot_skill_registry import copilot_skill_registry


class AgricultureModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_agriculture",
            name="Agriculture & Farm Operations",
            version="1.0.0",
            description="Farm fields, crop soil parameters, livestock monitoring, and machinery schedules.",
            category="Agriculture & Primary Sector",
            icon="Leaf",
            entity_types=[
                EntityTypeSpec(code="farm_field", label="Farm Field", icon="Grid"),
                EntityTypeSpec(code="livestock_herd", label="Livestock/Herd", icon="TrendingUp"),
                EntityTypeSpec(code="crop_harvest", label="Crop/Harvest Log", icon="CheckCircle"),
                EntityTypeSpec(code="farm_equipment", label="Machinery", icon="Truck")
            ],
            copilot_skills=[
                "module_agriculture:recommend_irrigation_cycle",
                "module_agriculture:predict_harvest_yield"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/agriculture/fields", component="AgFieldsPage", title="Farm Fields", icon="Grid"),
                    UIRouteSpec(path="/agriculture/livestock", component="AgLivestockPage", title="Livestock Index", icon="Heart"),
                    UIRouteSpec(path="/agriculture/harvests", component="AgHarvestsPage", title="Harvest Logs", icon="CheckCircle")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="ag_soil_moisture", type="metric", title="Avg Soil Moisture", icon="Droplet", config={"value": "42%"}),
                    WidgetSpec(id="ag_livestock_count", type="metric", title="Active Herd Count", icon="Heart", config={"value": "210"})
                ]
            ),
            permissions=[
                PermissionSpec(department="operations", role_tier="staff"),
                PermissionSpec(department="logistics", role_tier="staff"),
                PermissionSpec(department="safety", role_tier="officer")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_agriculture",
            name="recommend_irrigation_cycle",
            description="Analyzes weather indices and field moisture sensors to optimize water scheduling.",
            handler=self._skill_irrigation_cycle
        )
        copilot_skill_registry.register_skill(
            module_id="module_agriculture",
            name="predict_harvest_yield",
            description="Projects total ton yields based on soil nitrogen and thermal indices.",
            handler=self._skill_harvest_yield
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_agriculture"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "low_soil_moisture_alert", "risk_weight": 0.7}]

    async def _skill_irrigation_cycle(self, **kwargs) -> Dict[str, Any]:
        return {
            "irrigation_recommended": True,
            "target_fields": ["Field A-1 (Cassava)", "Field B-3 (Maize)"],
            "cycle_duration": "45 minutes",
            "weather_warning": "No rain expected for the next 5 days."
        }

    async def _skill_harvest_yield(self, **kwargs) -> Dict[str, Any]:
        return {
            "estimated_yield_tons": 84.5,
            "ripeness_index": "94%",
            "optimal_harvest_window": "July 24 - July 28"
        }
