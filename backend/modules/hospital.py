"""
InteracAI Hospital & Healthcare Industry Starter Module.
Monitors patient flow, emergency ward bottlenecks, medical equipment tracking, and department utilization.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec
from services.copilot_skill_registry import copilot_skill_registry



class HospitalModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_hospital",
            name="Healthcare & Hospital Operational Intelligence",
            version="1.0.0",
            description="Patient flow optimization, emergency department bottleneck analysis, and medical asset tracking.",
            category="Healthcare",
            icon="Activity",
            entity_types=[
                EntityTypeSpec(code="patient", label="Patient Record", icon="Heart"),
                EntityTypeSpec(code="medical_equipment", label="Medical Asset / Equipment", icon="Crosshair"),
                EntityTypeSpec(code="department_ward", label="Hospital Ward / Department", icon="Building"),
                EntityTypeSpec(code="staff_doctor", label="Medical Staff / Doctor", icon="UserCheck")
            ],
            copilot_skills=["module_hospital:patient_flow_bottlenecks", "module_hospital:predict_staffing_requirements"],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/hospital/patient-flow", component="PatientFlowPage", title="Patient Flow Radar", icon="Activity"),
                    UIRouteSpec(path="/hospital/equipment-tracker", component="EquipmentTrackerPage", title="Equipment Asset Map", icon="Crosshair")
                ]
            )
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_hospital",
            name="patient_flow_bottlenecks",
            description="Identifies waiting room congestion and emergency ward admission bottlenecks in real time.",
            handler=self._skill_patient_flow
        )
        copilot_skill_registry.register_skill(
            module_id="module_hospital",
            name="predict_staffing_requirements",
            description="Forecasts nursing and physician staffing requirements based on ER arrival rates.",
            handler=self._skill_predict_staffing
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_hospital"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "er_triage_wait_time_over_45_mins", "risk_weight": 0.85}]

    async def _skill_patient_flow(self, ward_id: str = "ER") -> Dict[str, Any]:
        return {
            "ward": ward_id,
            "average_triage_wait_minutes": 38,
            "current_occupancy_rate": "92%",
            "bottlenecks_identified": ["Radiology Scanner B queue (4 patients waiting over 50 mins)"],
            "recommendation": "Re-route non-critical X-ray requests to Outpatient Imaging Wing."
        }

    async def _skill_predict_staffing(self, shift: str = "night") -> Dict[str, Any]:
        return {
            "predicted_er_admissions": 28,
            "recommended_nurses": 6,
            "recommended_doctors": 2,
            "status": "OPTIMAL_STAFFING"
        }
