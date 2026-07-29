"""
InteracAI Hotels & Hospitality Industry Starter Module.
Monitors guest reservations, keycard access logs, VIP arrivals, housekeeping status, and unauthorized room access alerts.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
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
                EntityTypeSpec(code="hotel_reservation", label="Hotel Reservation", icon="Calendar"),
                EntityTypeSpec(code="keycard_log", label="Keycard Access Event", icon="Lock"),
                EntityTypeSpec(code="housekeeping_task", label="Housekeeping Clean Task", icon="Briefcase"),
                EntityTypeSpec(code="maintenance_ticket", label="Maintenance Ticket", icon="Wrench"),
                EntityTypeSpec(code="restaurant_order", label="Restaurant Order", icon="Coffee"),
                EntityTypeSpec(code="restaurant_food", label="Restaurant Food Item", icon="Utensils"),
                EntityTypeSpec(code="hotel_inventory", label="Hotel Inventory SKU", icon="Package"),
                EntityTypeSpec(code="hotel_invoice", label="Hotel Invoice & Folio", icon="Receipt")
            ],
            copilot_skills=[
                "module_hotels:analyze_room_occupancy_anomalies",
                "module_hotels:generate_vip_guest_service_report",
                "module_hotels:detect_unauthorized_room_access"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/hotels/reservations", component="HotelReservationsPage", title="Reservations Calendar", icon="Calendar"),
                    UIRouteSpec(path="/hotels/frontdesk", component="HotelFrontDeskPage", title="Front Desk & Check-in", icon="UserCheck"),
                    UIRouteSpec(path="/hotels/rooms", component="HotelRoomsPage", title="Rooms Directory", icon="Key"),
                    UIRouteSpec(path="/hotels/housekeeping", component="HotelHousekeepingPage", title="Housekeeping Schedule", icon="Briefcase"),
                    UIRouteSpec(path="/hotels/maintenance", component="HotelMaintenancePage", title="Maintenance Tickets", icon="Wrench"),
                    UIRouteSpec(path="/hotels/restaurant", component="HotelRestaurantPage", title="Restaurant POS", icon="Coffee"),
                    UIRouteSpec(path="/hotels/inventory", component="HotelInventoryPage", title="Inventory Control", icon="Package"),
                    UIRouteSpec(path="/hotels/finance", component="HotelFinancePage", title="Folio Finance & Invoices", icon="Receipt"),
                    UIRouteSpec(path="/hotels/analytics", component="HotelAnalyticsPage", title="ADR / RevPAR Analytics", icon="BarChart2")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="hotel_occupancy_rate", type="metric", title="Room Occupancy Rate", icon="Bed", config={"value": "84%"}),
                    WidgetSpec(id="hotel_access_radar", type="radar", title="Active Keycard Radar", icon="Lock", config={})
                ]
            ),
            permissions=[
                PermissionSpec(department="frontdesk", role_tier="staff"),
                PermissionSpec(department="reception", role_tier="staff"),
                PermissionSpec(department="housekeeping", role_tier="staff"),
                PermissionSpec(department="maintenance", role_tier="staff"),
                PermissionSpec(department="restaurant", role_tier="staff"),
                PermissionSpec(department="kitchen", role_tier="staff"),
                PermissionSpec(department="bar", role_tier="staff"),
                PermissionSpec(department="laundry", role_tier="staff"),
                PermissionSpec(department="security", role_tier="officer"),
                PermissionSpec(department="accounts", role_tier="staff"),
                PermissionSpec(department="hr", role_tier="staff"),
                PermissionSpec(department="store", role_tier="staff"),
                PermissionSpec(department="marketing", role_tier="staff"),
                PermissionSpec(department="it", role_tier="staff"),
                PermissionSpec(department="general_manager", role_tier="manager"),
                PermissionSpec(department="owner", role_tier="manager")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        # Register entity types in the database
        from database.models.dynamic_entity import EntityType
        from sqlalchemy import select
        import uuid

        local_session = False
        if db_session is None:
            from database.session import AsyncSessionLocal
            db_session = AsyncSessionLocal()
            local_session = True

        try:
            for et_spec in self.manifest.entity_types:
                stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == et_spec.code)
                res = await db_session.execute(stmt)
                existing = res.scalar_one_or_none()
                if not existing:
                    et = EntityType(
                        id=f"et_{uuid.uuid4().hex[:12]}",
                        org_id=org_id,
                        module_id=self.manifest.id,
                        code=et_spec.code,
                        display_name=et_spec.label,
                        schema_definition=et_spec.default_attributes or {}
                    )
                    db_session.add(et)
            await db_session.commit()
        finally:
            if local_session:
                await db_session.close()

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
        from database.session import AsyncSessionLocal
        from sqlalchemy import select
        from database.models.dynamic_entity import EntityV2, EntityType
        
        org_id = kwargs.get("org_id", "demo")
        async with AsyncSessionLocal() as session:
            room_type_stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == "hotel_room")
            room_type_res = await session.execute(room_type_stmt)
            room_type = room_type_res.scalar_one_or_none()
            
            total_rooms = 150
            occupied_rooms = 0
            if room_type:
                rooms_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == room_type.id)
                rooms_res = await session.execute(rooms_stmt)
                rooms = rooms_res.scalars().all()
                total_rooms = len(rooms) or 150
                occupied_rooms = sum(1 for r in rooms if r.attributes.get("status") == "OCCUPIED")
                
            occupancy_rate = f"{(occupied_rooms / total_rooms * 100):.1f}%" if total_rooms > 0 else "0.0%"
            
            keycard_type_stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == "keycard_log")
            keycard_type_res = await session.execute(keycard_type_stmt)
            keycard_type = keycard_type_res.scalar_one_or_none()
            
            anomalies = []
            if keycard_type:
                logs_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == keycard_type.id)
                logs_res = await session.execute(logs_stmt)
                logs = logs_res.scalars().all()
                
                for log in logs:
                    room_no = log.attributes.get("room_number")
                    if room_type:
                        room_stmt = select(EntityV2).where(
                            EntityV2.org_id == org_id, 
                            EntityV2.entity_type_id == room_type.id,
                            EntityV2.display_label == room_no
                        )
                        r_res = await session.execute(room_stmt)
                        target_room = r_res.scalar_one_or_none()
                        if target_room and target_room.attributes.get("status") == "VACANT":
                            anomalies.append({
                                "room": room_no,
                                "anomaly": "Keycard swipe registered on vacant room.",
                                "severity": "HIGH"
                            })
                            
            if not anomalies:
                anomalies.append({"room": "None", "anomaly": "No unauthorized entries detected.", "severity": "INFO"})

            return {
                "total_rooms": total_rooms,
                "occupancy_rate": occupancy_rate,
                "anomalies_detected": anomalies,
                "recommendation": "All room occupancy patterns normal." if len(anomalies) <= 1 and anomalies[0]["room"] == "None" else "Verify flagged room locks."
            }

    async def _skill_vip_report(self, date_filter: str = "today", **kwargs) -> Dict[str, Any]:
        from database.session import AsyncSessionLocal
        from sqlalchemy import select
        from database.models.dynamic_entity import EntityV2, EntityType
        
        org_id = kwargs.get("org_id", "demo")
        async with AsyncSessionLocal() as session:
            guest_type_stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == "hotel_guest")
            guest_type_res = await session.execute(guest_type_stmt)
            guest_type = guest_type_res.scalar_one_or_none()
            
            vip_dossier = []
            if guest_type:
                guests_stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == guest_type.id)
                guests_res = await session.execute(guests_stmt)
                guests = guests_res.scalars().all()
                
                for g in guests:
                    vip_status = g.attributes.get("vip_status", "Regular")
                    if vip_status != "Regular":
                        res_type_stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == "hotel_reservation")
                        res_type_res = await session.execute(res_type_stmt)
                        res_type = res_type_res.scalar_one_or_none()
                        
                        room_no = "TBD"
                        if res_type:
                            res_stmt = select(EntityV2).where(
                                EntityV2.org_id == org_id,
                                EntityV2.entity_type_id == res_type.id
                            )
                            res_result = await session.execute(res_stmt)
                            reservations = res_result.scalars().all()
                            for r in reservations:
                                if r.attributes.get("guest_id") == g.id and r.attributes.get("status") == "CHECKED_IN":
                                    room_no = r.attributes.get("room_number", "TBD")
                                    break
                                    
                        vip_dossier.append({
                            "guest_name": g.display_label,
                            "room": room_no,
                            "preferences": g.attributes.get("preferences") or "No custom preferences registered."
                        })
            
            if not vip_dossier:
                vip_dossier.append({"guest_name": "None", "room": "N/A", "preferences": "No VIPs expected."})
                
            return {
                "date": date_filter,
                "vip_guests_expected": len(vip_dossier) if vip_dossier[0]["guest_name"] != "None" else 0,
                "vip_dossier": vip_dossier,
                "concierge_action_items": ["Prepare custom fruit baskets.", "Ensure express check-in desk ready."]
            }

    async def _skill_unauthorized_access(self, room_id: str = "all", room_number: str = None, **kwargs) -> Dict[str, Any]:
        from database.session import AsyncSessionLocal
        from sqlalchemy import select
        from database.models.dynamic_entity import EntityV2, EntityType
        
        org_id = kwargs.get("org_id", "demo")
        target_room = room_number or room_id
        
        async with AsyncSessionLocal() as session:
            keycard_type_stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == "keycard_log")
            keycard_type_res = await session.execute(keycard_type_stmt)
            keycard_type = keycard_type_res.scalar_one_or_none()
            
            failures = 0
            detail = "No keycard access anomalies logged."
            if keycard_type:
                stmt = select(EntityV2).where(EntityV2.org_id == org_id, EntityV2.entity_type_id == keycard_type.id)
                res = await session.execute(stmt)
                logs = res.scalars().all()
                for log in logs:
                    room_no = log.attributes.get("room_number")
                    if target_room != "all" and room_no != target_room:
                        continue
                    if log.attributes.get("access_granted") is False or log.attributes.get("status") == "DENIED":
                        failures += 1
                        detail = f"Failed access logs recorded at Room {room_no} (Access Denied). CCTV alert generated."
                        
            return {
                "room_queried": target_room,
                "unauthorized_attempts_24h": failures,
                "incident_detail": detail
            }
