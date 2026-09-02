"""
Hotel Reservation Service for InteracAI.
Handles end-to-end ingestion, room directory synchronization, guest profile linking,
Property Management System (PMS) database persistence, availability checks, and Front Desk alerts.
"""

import uuid
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy import select

from database.session import AsyncSessionLocal
from database.models.dynamic_entity import EntityType, EntityV2
from services.workflow_engine import workflow_engine

logger = logging.getLogger(__name__)

# Known dummy/mock room labels that should be filtered out from real hotel operations
DUMMY_ROOM_LABELS = {"room 101", "room 102", "room 201"}

class HotelReservationService:

    @staticmethod
    async def _get_or_create_entity_type(session, org_id: str, code: str, display_name: str) -> str:
        """Helper to resolve or auto-create an EntityType ID."""
        try:
            stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == code)
            res = await session.execute(stmt)
            et = res.scalar_one_or_none()
        except Exception:
            from database.base import Base
            from database.session import engine
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == code)
            res = await session.execute(stmt)
            et = res.scalar_one_or_none()
        if not et:
            et = EntityType(
                id=f"et_{uuid.uuid4().hex[:12]}",
                org_id=org_id,
                module_id="module_hotels",
                code=code,
                display_name=display_name,
                schema_definition={}
            )
            session.add(et)
            await session.flush()
        return et.id

    @classmethod
    async def get_available_rooms_inventory(
        cls,
        business_id: str,
        check_in: Optional[str] = None,
        check_out: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetches all genuine rooms registered by the hotel management in the rooms directory,
        excluding dummy data, and calculates date-specific availability.
        """
        from services.db_service import resolve_business_id
        real_business_id = await resolve_business_id(business_id)

        cin_str = str(check_in)[:10] if check_in else None
        cout_str = str(check_out)[:10] if check_out else None

        async with AsyncSessionLocal() as session:
            try:
                # 1. Resolve room entity type
                stmt_et = select(EntityType).where(
                    EntityType.org_id == real_business_id,
                    EntityType.code == "hotel_room"
                )
                res_et = await session.execute(stmt_et)
                et = res_et.scalar_one_or_none()
                if not et:
                    return []

                # 2. Fetch all rooms
                stmt_rooms = select(EntityV2).where(
                    EntityV2.org_id == real_business_id,
                    EntityV2.entity_type_id == et.id
                )
                res_rooms = await session.execute(stmt_rooms)
                rooms = res_rooms.scalars().all()

                # 3. Fetch active reservations to verify calendar clashes
                stmt_res_et = select(EntityType).where(
                    EntityType.org_id == real_business_id,
                    EntityType.code == "hotel_reservation"
                )
                res_res_et = await session.execute(stmt_res_et)
                res_et_obj = res_res_et.scalar_one_or_none()

                booked_room_ids = set()
                if res_et_obj and cin_str and cout_str:
                    stmt_reservations = select(EntityV2).where(
                        EntityV2.org_id == real_business_id,
                        EntityV2.entity_type_id == res_et_obj.id
                    )
                    res_reservations = await session.execute(stmt_reservations)
                    all_reservations = res_reservations.scalars().all()

                    for r in all_reservations:
                        attrs = r.attributes or {}
                        status = attrs.get("status", "RESERVED").upper()
                        if status in ("CANCELLED", "CHECKED_OUT"):
                            continue

                        r_cin = str(attrs.get("check_in_date") or "")[:10]
                        r_cout = str(attrs.get("check_out_date") or "")[:10]
                        r_room_id = attrs.get("room_id")

                        # Overlap: (r_cin < cout_str and r_cout > cin_str)
                        if r_room_id and r_cin and r_cout:
                            if r_cin < cout_str and r_cout > cin_str:
                                booked_room_ids.add(r_room_id)

                results = []
                for room in rooms:
                    label = (room.display_label or "").strip()
                    # Filter out dummy/mock seed data
                    if label.lower() in DUMMY_ROOM_LABELS:
                        continue

                    attrs = room.attributes or {}
                    status = attrs.get("status", "VACANT").upper()
                    if status == "OUT_OF_SERVICE":
                        continue

                    is_booked = room.id in booked_room_ids
                    is_available = (status == "VACANT" and not is_booked)

                    results.append({
                        "id": room.id,
                        "room_number": label,
                        "room_type": attrs.get("room_type", "Standard Room"),
                        "floor": attrs.get("floor", "1"),
                        "status": "OCCUPIED" if is_booked else status,
                        "housekeeping": attrs.get("housekeeping", "Clean"),
                        "nightly_rate": float(attrs.get("nightly_rate") or 0.0),
                        "is_available": is_available
                    })

                # Sort by floor and room label
                results.sort(key=lambda x: (x.get("floor", "1"), x.get("room_number", "")))
                return results

            except Exception as e:
                logger.error(f"[HotelReservationService] Error querying rooms inventory: {e}", exc_info=True)
                return []

    @classmethod
    async def get_rooms_context_for_ai(cls, business_id: str) -> str:
        """
        Builds a structured real-time directory of available rooms for injection into the AI prompt.
        Ensures the AI only offers rooms that actually exist in the hotel directory.
        """
        rooms = await cls.get_available_rooms_inventory(business_id)
        if not rooms:
            return ""

        lines = [
            "*** LIVE HOTEL ROOMS DIRECTORY & REAL-TIME AVAILABILITY ***",
            "The following are the ONLY official rooms registered in this hotel's Directory. You MUST strictly adhere to this list:",
        ]

        available_count = 0
        for r in rooms:
            avail_str = "AVAILABLE / VACANT" if r["is_available"] else f"UNAVAILABLE ({r['status']})"
            if r["is_available"]:
                available_count += 1
            rate_formatted = f"₦{r['nightly_rate']:,.2f}" if r["nightly_rate"] > 500 else f"${r['nightly_rate']:,.2f}"
            lines.append(
                f"• Room '{r['room_number']}' | Category: {r['room_type']} | Floor: {r['floor']} | Rate: {rate_formatted}/night | Status: {avail_str}"
            )

        lines.extend([
            "",
            "CRITICAL HOTEL BOOKING & AVAILABILITY RULES (STRICT):",
            "1. ONLY REAL ROOMS: You MUST ONLY offer, suggest, or book rooms that appear in the official directory above.",
            "2. NEVER INVENT ROOMS: NEVER make up room numbers (such as Room 101, 102, 201, or any unlisted room). If a room is not listed above, IT DOES NOT EXIST.",
            "3. VACANCY REQUIREMENT: Only offer rooms whose status is 'AVAILABLE / VACANT'. Do NOT book rooms that are 'UNAVAILABLE' or 'OCCUPIED'.",
            "4. NO DUMMY DATA: If a guest asks for a room type or room number that is not listed or not available, politely inform them: 'I apologize, that room is currently unavailable. The following rooms are currently available in our hotel directory:' and list the available options with their rates.",
            "5. IN YOUR [ACTION: HOTEL_RESERVATION | {...}] TAG:",
            "   - 'room_number': MUST EXACTLY match the room label from the directory above (e.g. 'Suite 01').",
            "   - 'room_type': MUST EXACTLY match the category from the directory above.",
            "   - 'nightly_rate': MUST match the actual rate specified in the directory.",
            "************************************************************"
        ])

        return "\n".join(lines)

    @classmethod
    async def create_reservation_from_ai(
        cls,
        business_id: str,
        reservation_data: Dict[str, Any],
        customer_phone: Optional[str] = None,
        customer_email: Optional[str] = None,
        platform: str = "whatsapp"
    ) -> Optional[Dict[str, Any]]:
        """
        Takes structured booking data from AI conversation, verifies against genuine rooms in the
        hotel directory (never creating dummy rooms), persists the reservation, triggers workflows,
        and notifies the frontdesk.
        """
        from services.db_service import resolve_business_id
        real_business_id = await resolve_business_id(business_id)

        guest_name = (
            reservation_data.get("guest_name") or 
            reservation_data.get("name") or 
            reservation_data.get("customer_name") or 
            "Guest"
        ).strip()

        # Date normalization
        check_in = reservation_data.get("check_in_date") or reservation_data.get("check_in") or reservation_data.get("start_date")
        check_out = reservation_data.get("check_out_date") or reservation_data.get("check_out") or reservation_data.get("end_date")

        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        tomorrow_str = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

        if not check_in:
            check_in = today_str
        if not check_out or str(check_out) <= str(check_in):
            try:
                cin_dt = datetime.strptime(str(check_in).strip()[:10], "%Y-%m-%d")
                check_out = (cin_dt + timedelta(days=1)).strftime("%Y-%m-%d")
            except Exception:
                check_in = today_str
                check_out = tomorrow_str

        cin_str = str(check_in)[:10]
        cout_str = str(check_out)[:10]

        nights = int(reservation_data.get("nights") or 1)
        try:
            cin_dt = datetime.strptime(cin_str, "%Y-%m-%d")
            cout_dt = datetime.strptime(cout_str, "%Y-%m-%d")
            nights = max(1, (cout_dt - cin_dt).days)
        except Exception:
            pass

        requested_room_type = (
            reservation_data.get("room_type") or 
            reservation_data.get("room") or 
            ""
        ).strip()

        requested_room_number = str(reservation_data.get("room_number") or "").strip()
        special_requests = reservation_data.get("special_requests") or reservation_data.get("notes") or ""
        property_id = reservation_data.get("property_id") or None

        logger.info(
            f"[HotelReservationService] Processing reservation for {guest_name} "
            f"({cin_str} to {cout_str}, Room: '{requested_room_number}' / '{requested_room_type}') in org {real_business_id}"
        )

        async with AsyncSessionLocal() as session:
            try:
                # 1. Fetch genuine rooms from the hotel directory
                room_type_id = await cls._get_or_create_entity_type(session, real_business_id, "hotel_room", "Hotel Room")
                all_rooms_stmt = select(EntityV2).where(
                    EntityV2.org_id == real_business_id,
                    EntityV2.entity_type_id == room_type_id
                )
                all_rooms_res = await session.execute(all_rooms_stmt)
                raw_rooms = all_rooms_res.scalars().all()

                # Filter out dummy/mock seed data
                genuine_rooms = [
                    r for r in raw_rooms 
                    if (r.display_label or "").strip().lower() not in DUMMY_ROOM_LABELS
                ]

                if not genuine_rooms:
                    logger.error(
                        f"[HotelReservationService] REJECTED: Business {real_business_id} has no registered "
                        f"rooms in the hotel directory. Cannot assign a fake room."
                    )
                    return None

                # 2. Check existing active reservations for date overlaps
                res_type_id = await cls._get_or_create_entity_type(session, real_business_id, "hotel_reservation", "Hotel Reservation")
                stmt_existing_res = select(EntityV2).where(
                    EntityV2.org_id == real_business_id,
                    EntityV2.entity_type_id == res_type_id
                )
                existing_res_res = await session.execute(stmt_existing_res)
                active_reservations = existing_res_res.scalars().all()

                booked_room_ids = set()
                for r in active_reservations:
                    attrs = r.attributes or {}
                    status = attrs.get("status", "RESERVED").upper()
                    if status in ("CANCELLED", "CHECKED_OUT"):
                        continue
                    r_cin = str(attrs.get("check_in_date") or "")[:10]
                    r_cout = str(attrs.get("check_out_date") or "")[:10]
                    r_room_id = attrs.get("room_id")
                    if r_room_id and r_cin and r_cout:
                        if r_cin < cout_str and r_cout > cin_str:
                            booked_room_ids.add(r_room_id)

                # 3. Resolve genuine room that is available
                matched_room = None

                # (a) Match by exact room label/number if provided
                if requested_room_number:
                    for r in genuine_rooms:
                        if r.display_label.strip().lower() == requested_room_number.lower():
                            if r.id not in booked_room_ids and (r.attributes or {}).get("status", "VACANT") == "VACANT":
                                matched_room = r
                                break

                # (b) Match by room type among available rooms
                if not matched_room and requested_room_type:
                    for r in genuine_rooms:
                        if r.id in booked_room_ids:
                            continue
                        attrs = r.attributes or {}
                        if attrs.get("status", "VACANT") != "VACANT":
                            continue
                        r_type = (attrs.get("room_type") or "").lower()
                        if r_type and (r_type in requested_room_type.lower() or requested_room_type.lower() in r_type):
                            matched_room = r
                            break

                # (c) Fallback to ANY vacant and available room in the hotel directory
                if not matched_room:
                    for r in genuine_rooms:
                        if r.id not in booked_room_ids and (r.attributes or {}).get("status", "VACANT") == "VACANT":
                            matched_room = r
                            break

                if not matched_room:
                    logger.warning(
                        f"[HotelReservationService] REJECTED: All registered rooms in {real_business_id} "
                        f"are fully booked or unavailable for dates {cin_str} to {cout_str}. Will not create dummy room."
                    )
                    return None

                room_attrs = matched_room.attributes or {}
                actual_room_number = matched_room.display_label
                actual_room_type = room_attrs.get("room_type", requested_room_type or "Standard Room")
                nightly_rate = float(room_attrs.get("nightly_rate") or reservation_data.get("nightly_rate") or 150.0)
                total_amount = float(reservation_data.get("total_amount") or (nightly_rate * nights))

                # 4. Resolve or Create Guest Entity
                guest_type_id = await cls._get_or_create_entity_type(session, real_business_id, "hotel_guest", "Hotel Guest")
                guest_stmt = select(EntityV2).where(
                    EntityV2.org_id == real_business_id,
                    EntityV2.entity_type_id == guest_type_id,
                    EntityV2.display_label.ilike(f"%{guest_name}%")
                )
                guest_res = await session.execute(guest_stmt)
                guest = guest_res.scalars().first()

                if not guest:
                    guest = EntityV2(
                        id=f"ent_{uuid.uuid4().hex[:16]}",
                        org_id=real_business_id,
                        entity_type_id=guest_type_id,
                        display_label=guest_name,
                        attributes={
                            "vip_status": reservation_data.get("vip_status", "Regular"),
                            "phone": customer_phone or reservation_data.get("phone", ""),
                            "email": customer_email or reservation_data.get("email", ""),
                            "preferences": special_requests,
                            "property_id": property_id
                        }
                    )
                    session.add(guest)
                    await session.flush()
                else:
                    attrs = dict(guest.attributes or {})
                    if customer_phone and not attrs.get("phone"):
                        attrs["phone"] = customer_phone
                    if customer_email and not attrs.get("email"):
                        attrs["email"] = customer_email
                    guest.attributes = attrs
                    session.add(guest)

                # 5. Create Reservation Entity in PMS linked to the REAL room
                reservation_id = f"ent_{uuid.uuid4().hex[:16]}"
                reservation = EntityV2(
                    id=reservation_id,
                    org_id=real_business_id,
                    entity_type_id=res_type_id,
                    display_label=f"Res: {guest_name} - {actual_room_number}",
                    attributes={
                        "guest_id": guest.id,
                        "guest_name": guest.display_label,
                        "guest_phone": customer_phone or guest.attributes.get("phone", ""),
                        "guest_email": customer_email or guest.attributes.get("email", ""),
                        "room_id": matched_room.id,
                        "room_number": actual_room_number,
                        "room_type": actual_room_type,
                        "check_in_date": cin_str,
                        "check_out_date": cout_str,
                        "nights": nights,
                        "status": "RESERVED",
                        "checked_in": False,
                        "checked_out": False,
                        "nightly_rate": nightly_rate,
                        "total_amount": total_amount,
                        "booking_source": f"{platform.capitalize()} AI",
                        "special_requests": special_requests,
                        "property_id": property_id
                    }
                )
                session.add(reservation)
                await session.commit()
                await session.refresh(reservation)

                logger.info(
                    f"[HotelReservationService] Successfully created reservation {reservation_id} "
                    f"for {guest_name} in REAL Room '{actual_room_number}' ({cin_str} to {cout_str})"
                )

                # 6. Trigger Workflow Engine for Automations
                try:
                    await workflow_engine.trigger_workflow(real_business_id, "reservation_booked", {
                        "reservation_id": reservation.id,
                        "guest_name": guest_name,
                        "guest_phone": customer_phone,
                        "guest_email": customer_email,
                        "room_number": actual_room_number,
                        "room_type": actual_room_type,
                        "check_in": cin_str,
                        "check_out": cout_str,
                        "nights": nights,
                        "total_amount": total_amount,
                        "platform": platform
                    })
                except Exception as wf_err:
                    logger.warning(f"[HotelReservationService] Workflow trigger error: {wf_err}")

                # 7. Dispatch Direct Front Desk Alert via Department Routing
                try:
                    await cls._dispatch_frontdesk_alert(
                        business_id=real_business_id,
                        reservation=reservation,
                        property_id=property_id,
                        platform=platform
                    )
                except Exception as alert_err:
                    logger.warning(f"[HotelReservationService] Front desk alert error: {alert_err}")

                return {
                    "id": reservation.id,
                    "guest_name": guest_name,
                    "room_number": actual_room_number,
                    "room_type": actual_room_type,
                    "check_in_date": cin_str,
                    "check_out_date": cout_str,
                    "nights": nights,
                    "status": "RESERVED",
                    "total_amount": total_amount
                }

            except Exception as e:
                await session.rollback()
                logger.error(f"[HotelReservationService] Failed to create hotel reservation: {e}", exc_info=True)
                return None

    @classmethod
    async def _dispatch_frontdesk_alert(
        cls,
        business_id: str,
        reservation: EntityV2,
        property_id: Optional[str] = None,
        platform: str = "whatsapp"
    ):
        """Notifies the front desk via their configured WhatsApp or Email channels."""
        from services.routing_service import DepartmentRoutingService
        resolved = await DepartmentRoutingService.resolve_recipient(
            business_id=business_id,
            department="frontdesk",
            property_id=property_id
        )

        target_phone = resolved.get("phone")
        target_email = resolved.get("email")
        attrs = reservation.attributes or {}

        guest_name = attrs.get("guest_name", "Valued Guest")
        room_number = attrs.get("room_number", "TBD")
        room_type = attrs.get("room_type", "Standard Room")
        check_in = attrs.get("check_in_date")
        check_out = attrs.get("check_out_date")
        total_amt = attrs.get("total_amount", 0)
        phone = attrs.get("guest_phone", "N/A")

        currency_symbol = "₦" if total_amt > 500 else "$"
        alert_message = (
            f"🛎️ *NEW HOTEL RESERVATION CONFIRMED*\n\n"
            f"• *Guest*: {guest_name}\n"
            f"• *Contact*: {phone}\n"
            f"• *Room*: {room_number} ({room_type})\n"
            f"• *Dates*: {check_in} to {check_out}\n"
            f"• *Total*: {currency_symbol}{total_amt:,.2f}\n"
            f"• *Booked via*: {platform.capitalize()} AI\n\n"
            f"The reservation is synchronized with your Hotel Reservations Dashboard."
        )

        if target_phone:
            from services.whatsapp_service import send_whatsapp_message
            logger.info(f"[HotelReservationService] Sending frontdesk WhatsApp alert to {target_phone}")
            await send_whatsapp_message(target_phone, alert_message, business_id=business_id)

        if target_email:
            from services.email_service import email_service
            logger.info(f"[HotelReservationService] Sending frontdesk Email alert to {target_email}")
            html_body = f"""
            <h2>🛎️ New Hotel Reservation Confirmed</h2>
            <p><strong>Guest:</strong> {guest_name}</p>
            <p><strong>Contact:</strong> {phone}</p>
            <p><strong>Room:</strong> {room_number} ({room_type})</p>
            <p><strong>Check-In:</strong> {check_in}</p>
            <p><strong>Check-Out:</strong> {check_out}</p>
            <p><strong>Total Amount:</strong> {currency_symbol}{total_amt:,.2f}</p>
            <p><strong>Channel:</strong> {platform.capitalize()} AI</p>
            <br/>
            <p>This reservation has been synchronized to your Hotel Reservations Dashboard.</p>
            """
            await email_service.send_email(
                to=target_email,
                subject=f"New Reservation: {guest_name} (Room {room_number})",
                html_content=html_body,
                business_id=business_id
            )

hotel_reservation_service = HotelReservationService()
