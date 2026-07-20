"""
InteracAI Residential Estate Security Industry Starter Module.
Manages residents, visitor gate passes, vehicle ALPR logs, and guard patrol monitoring.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec
from services.copilot_skill_registry import copilot_skill_registry



class EstateModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_estate",
            name="Residential Estate Security Intelligence",
            version="1.0.0",
            description="Access control, visitor management, ALPR vehicle recognition, and guard patrol tracking for gated communities.",
            category="Property & Security",
            icon="Home",
            entity_types=[
                EntityTypeSpec(code="resident", label="Resident Profile", icon="User"),
                EntityTypeSpec(code="visitor_vehicle", label="Visitor Vehicle (ALPR)", icon="Car"),
                EntityTypeSpec(code="gate", label="Access Gate", icon="DoorOpen"),
                EntityTypeSpec(code="guard_patrol", label="Guard Patrol", icon="ShieldCheck")
            ],
            copilot_skills=["module_estate:analyze_visitor_traversal", "module_estate:generate_nightly_guard_report"],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/estate/visitor-access", component="VisitorAccessPage", title="Gate Access Logs", icon="Key"),
                    UIRouteSpec(path="/estate/patrol-monitoring", component="PatrolMonitoringPage", title="Patrol Radar", icon="Radio")
                ]
            )
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_estate",
            name="analyze_visitor_traversal",
            description="Calculates vehicle entry times, dwell times, and gate exit confirmations for estate visitors.",
            handler=self._skill_analyze_traversal
        )
        copilot_skill_registry.register_skill(
            module_id="module_estate",
            name="generate_nightly_guard_report",
            description="Synthesizes perimeter camera detections, guard patrol checkpoints, and unresolved gate alerts.",
            handler=self._skill_guard_report
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_estate"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "unregistered_vehicle_overstay_4_hours", "risk_weight": 0.75}]

    async def _skill_analyze_traversal(self, plate_number: str = "ALL") -> Dict[str, Any]:
        return {
            "query_plate": plate_number,
            "total_visitor_entries_today": 84,
            "overstayed_vehicles": ["KJA-492-AA (Entered 14:10, Target: House 4B)"],
            "suspicious_gate_attempts": 1
        }

    async def _skill_guard_report(self, shift: str = "night") -> Dict[str, Any]:
        return {
            "shift": shift,
            "completed_patrol_checkpoints": "24 / 24",
            "perimeter_breaches": 0,
            "blacklisted_vehicle_alerts": ["Plate BDG-102-XY spotted near West Gate at 02:14 AM - Guard dispatched."],
            "status": "SECURE"
        }
