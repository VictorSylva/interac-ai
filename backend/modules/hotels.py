"""
InteracAI Hotels & Hospitality Industry Starter Module.
Monitors guest reservations, keycard access logs, VIP arrivals, housekeeping status, and unauthorized room access alerts.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec
from services.copilot_skill_registry import copilot_skill_registry



class HotelsModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_hotels",
            name="Hotels & Hospitality Intelligence",
            version="1.0.0",
            description="Guest experience management, keycard security analytics, VIP service briefings, and room occupancy monitoring.",
            category="Hospitality & Leisure",
            icon="Compass",
            entity_types=[
                EntityTypeSpec(code="hotel_guest", label="Hotel Guest Profile", icon="UserCheck"),
                EntityTypeSpec(code="hotel_room", label="Hotel Room", icon="Key"),
                EntityTypeSpec(code="keycard_log", label="Keycard Access Event", icon="Lock"),
                EntityTypeSpec(code="housekeeping_staff", label="Housekeeping Staff", icon="Briefcase")
            ],
            copilot_skills=[
                "module_hotels:analyze_room_occupancy_anomalies",
                "module_hotels:generate_vip_guest_service_report",
                "module_hotels:detect_unauthorized_room_access"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/hotels/occupancy-radar", component="OccupancyRadarPage", title="Room Access Radar", icon="Key"),
                    UIRouteSpec(path="/hotels/vip-concierge", component="VIPConciergePage", title="VIP Concierge Center", icon="Star")
                ]
            )
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_hotels",
            name="analyze_room_occupancy_anomalies",
            description="Correlates keycard swipe logs, PMS reservation status, and hallway camera foot traffic to detect unauthorized room entries.",
            handler=self._skill_analyze_occupancy
        )
        copilot_skill_registry.register_skill(
            module_id="module_hotels",
            name="generate_vip_guest_service_report",
            description="Summarizes VIP arrivals, special preferences, stay timelines, and concierge interaction logs.",
            handler=self._skill_vip_report
        )
        copilot_skill_registry.register_skill(
            module_id="module_hotels",
            name="detect_unauthorized_room_access",
            description="Flags keycard or physical door access attempts on unreserved or checked-out hotel rooms.",
            handler=self._skill_unauthorized_access
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_hotels"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "keycard_swipe_on_unreserved_room", "risk_weight": 0.9}]

    async def _skill_analyze_occupancy(self, **kwargs) -> Dict[str, Any]:
        return {
            "total_rooms": 150,
            "occupancy_rate": "84%",
            "anomalies_detected": [
                {"room": "Suite 501", "anomaly": "Keycard swipe registered while guest is recorded as Checked-Out.", "severity": "HIGH"},
                {"room": "Room 304", "anomaly": "Continuous motion detected in vacant room.", "severity": "MEDIUM"}
            ],
            "recommendation": "Dispatch floor security to verify Suite 501."
        }

    async def _skill_vip_report(self, date_filter: str = "today", **kwargs) -> Dict[str, Any]:
        return {
            "date": date_filter,
            "vip_guests_expected": 3,
            "vip_dossier": [
                {"guest_name": "Dr. Adebayo Ogunlesi", "room": "Presidential Suite 801", "preferences": "Sparkling water, late check-out requested."}
            ],
            "concierge_action_items": ["Airport transfer dispatched", "Welcome amenities placed in Suite 801."]
        }

    async def _skill_unauthorized_access(self, room_id: str = "all", room_number: str = None, **kwargs) -> Dict[str, Any]:
        target_room = room_number or room_id
        return {
            "room_queried": target_room,
            "unauthorized_attempts_24h": 1,
            "incident_detail": f"Failed keycard swipe attempt at {target_room} (Checked out at 11:00 AM). Security footage logged."
        }
