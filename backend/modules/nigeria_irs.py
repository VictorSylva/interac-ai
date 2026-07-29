"""
InteracAI Internal Revenue Service of Nigeria (IRS / Tax & Revenue Intelligence) Industry Starter Module.
Processes taxpayer compliance dossiers (TIN), assessment filings, POS terminal transactions, land use charges, and tax evasion detection.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
from services.copilot_skill_registry import copilot_skill_registry



class NigeriaIRSModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_nigeria_irs",
            name="Internal Revenue Service of Nigeria (IRS Tax Intelligence)",
            version="1.0.0",
            description="Taxpayer compliance analysis (TIN), audit dossier synthesis, POS settlement matching, land registry tracking, and tax evasion detection.",
            category="Government & Revenue Authority",
            icon="Landmark",
            entity_types=[
                EntityTypeSpec(code="taxpayer_tin", label="Taxpayer (TIN)", icon="FileText"),
                EntityTypeSpec(code="tax_assessment", label="Tax Assessment / Filing", icon="Receipt"),
                EntityTypeSpec(code="pos_settlement", label="POS Merchant Terminal", icon="CreditCard"),
                EntityTypeSpec(code="property_c_of_o", label="Land Registry Property (C of O)", icon="Building")
            ],
            copilot_skills=[
                "module_nigeria_irs:detect_tax_evasion_anomalies",
                "module_nigeria_irs:summarize_taxpayer_compliance_dossier",
                "module_nigeria_irs:predict_lga_tax_yield"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/irs/taxpayer-dossier", component="TaxpayerDossierPage", title="Taxpayer Compliance Dossier", icon="FileCheck"),
                    UIRouteSpec(path="/irs/evasion-radar", component="TaxEvasionRadarPage", title="Evasion Anomaly Radar", icon="AlertTriangle"),
                    UIRouteSpec(path="/irs/lga-yield", component="LGAYieldPage", title="LGA Revenue Trajectory", icon="TrendingUp")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="irs_total_yield", type="metric", title="LGA Revenue Collection", icon="DollarSign", config={"value": "₦1.8B"}),
                    WidgetSpec(id="irs_compliance_rate", type="chart", title="Taxpayer Compliance Index", icon="TrendingUp", config={})
                ]
            ),
            permissions=[
                PermissionSpec(department="audit", role_tier="officer"),
                PermissionSpec(department="finance", role_tier="officer")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_nigeria_irs",
            name="detect_tax_evasion_anomalies",
            description="Cross-references declared income in TIN filings against physical business premises foot traffic, POS terminal logs, and land registry records.",
            handler=self._skill_detect_evasion
        )
        copilot_skill_registry.register_skill(
            module_id="module_nigeria_irs",
            name="summarize_taxpayer_compliance_dossier",
            description="Synthesizes corporate/individual TIN filing history, WHT deductions, bank directives, and field inspector reports.",
            handler=self._skill_compliance_dossier
        )
        copilot_skill_registry.register_skill(
            module_id="module_nigeria_irs",
            name="predict_lga_tax_yield",
            description="Forecasts monthly/quarterly tax collection trajectories across Local Government Areas (LGAs) and economic sectors.",
            handler=self._skill_lga_yield
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_nigeria_irs"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "high_commercial_premises_traffic_zero_vat_filing", "risk_weight": 0.95}]

    async def _skill_detect_evasion(self, lga: str = "Ikeja", tin: str = None, **kwargs) -> Dict[str, Any]:
        return {
            "queried_lga": lga,
            "queried_tin": tin,
            "high_risk_businesses_identified": 4,
            "evasion_anomalies": [
                {
                    "business_name": "Lagos Grand Supermarket Ltd",
                    "tin": tin or "TIN-904820192-A",
                    "premises_location": "Allen Avenue, Ikeja",
                    "anomaly_detail": "Physical CCTV customer count (~1,200 visits/day) & POS settlements ($45,000/mo) contradict declared zero VAT filing for Q2."
                }
            ],
            "recommended_audit_action": "Issue formal Tax Audit Notice & demand 12-month POS settlement statements."
        }

    async def _skill_compliance_dossier(self, tin: str = "TIN-904820192-A", **kwargs) -> Dict[str, Any]:
        return {
            "taxpayer_tin": tin,
            "compliance_status": "HIGH_AUDIT_RISK",
            "tax_type_breakdown": {
                "Companies_Income_Tax": "UNDER_DECLARED",
                "Withholding_Tax_WHT": "REMITTED",
                "Value_Added_Tax_VAT": "UNREMITTED"
            },
            "outstanding_assessment_balance": "₦18,450,000.00",
            "linked_properties": ["Block 4, Plot 12, Commercial Layout, Ikeja (C of O #90482)"]
        }

    async def _skill_lga_yield(self, state: str = "Lagos", **kwargs) -> Dict[str, Any]:
        return {
            "state": state,
            "top_yielding_lgas": [
                {"lga": "Ikeja", "q2_collection": "₦14.2 Billion", "target_achievement": "104%"},
                {"lga": "Lekki / Eti-Osa", "q2_collection": "₦22.8 Billion", "target_achievement": "112%"},
                {"lga": "Surulere", "q2_collection": "₦6.1 Billion", "target_achievement": "88%"}
            ],
            "projected_q3_revenue": "₦48.5 Billion"
        }

