"""
InteracAI Retail Industry Starter Module.
Configures retail entities (POS, Product, Supplier, CCTV) and loss prevention skills.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
from services.copilot_skill_registry import copilot_skill_registry



class RetailModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_retail",
            name="Retail & Loss Prevention Intelligence",
            version="1.0.0",
            description="Supermarket & retail intelligence for POS transactions, inventory monitoring, and loss prevention.",
            category="Retail & E-commerce",
            icon="ShoppingBag",
            entity_types=[
                EntityTypeSpec(code="product", label="Product Inventory", icon="Package"),
                EntityTypeSpec(code="supplier", label="Supplier", icon="Truck"),
                EntityTypeSpec(code="pos_terminal", label="POS Terminal", icon="CreditCard"),
                EntityTypeSpec(code="shelf", label="Store Shelf", icon="Layers")
            ],
            copilot_skills=["module_retail:detect_loss_prevention_anomalies", "module_retail:generate_shrinkage_report"],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/retail/loss-prevention", component="LossPreventionPage", title="Loss Prevention Center", icon="ShieldAlert"),
                    UIRouteSpec(path="/retail/pos-analytics", component="POSAnalyticsPage", title="POS Transactions", icon="Receipt")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="retail_shrinkage", type="chart", title="Shrinkage Rate Trend", icon="TrendingDown", config={}),
                    WidgetSpec(id="retail_pos_alerts", type="table", title="Active Register Feeds", icon="AlertCircle", config={})
                ]
            ),
            permissions=[
                PermissionSpec(department="inventory", role_tier="staff"),
                PermissionSpec(department="cashier", role_tier="staff"),
                PermissionSpec(department="security", role_tier="officer")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        # Register copilot skills
        copilot_skill_registry.register_skill(
            module_id="module_retail",
            name="detect_loss_prevention_anomalies",
            description="Identifies inventory shrinkages linked to recurring camera or POS observations.",
            handler=self._skill_detect_anomalies
        )
        copilot_skill_registry.register_skill(
            module_id="module_retail",
            name="generate_shrinkage_report",
            description="Summarizes store inventory anomalies and suspicious employee/customer timelines.",
            handler=self._skill_shrinkage_report
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_retail"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "high_loitering_near_high_value_shelf", "risk_weight": 0.8}]

    async def _skill_detect_anomalies(self, store_id: str = "default") -> Dict[str, Any]:
        return {
            "store_id": store_id,
            "anomalies_found": 3,
            "high_risk_aisles": ["Aisle 4 (Electronics)", "Aisle 9 (Cosmetics)"],
            "suspicious_patterns": "Dwell time exceeding 8 mins near restricted display case without cashier interaction."
        }

    async def _skill_shrinkage_report(self, date_range: str = "today") -> Dict[str, Any]:
        return {
            "period": date_range,
            "total_shrinkage_estimated": "$1,450",
            "top_affected_categories": ["Premium Spirits", "Memory Cards"],
            "recommended_action": "Increase security patrol near Aisle 4 during peak hours (17:00 - 19:00)."
        }
