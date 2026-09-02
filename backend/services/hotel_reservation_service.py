"""
Hotel Reservation Service for InteracAI.
Handles end-to-end ingestion, live room inventory resolution, real-time availability checks,
guest profile linking, Property Management System (PMS) database persistence,
and Front Desk alert dispatching with dynamic currency support.
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

class HotelReservationService:

    @staticmethod
    async def _get_or_create_entity_type(session, org_id: str, code: str, display_name: str) -> str:
        """Helper to resolve or auto-create an EntityType ID."""
        try:
            stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == code)
            res = await session.execute(stmt)
            et = res.scalar_one_or_none()
        except Exception:
            # If table is missing in local dev sqlite, auto-create
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
    async def get_hotel_inventory_context(cls, business_id: str) -> Optional[str]:
        """
        Queries the hotel's registered rooms and active bookings from the PMS,
        and generates a real-time room directory and availability context for the AI prompt.
        """
        from services.db_service import resolve_business_id, get_business_profile
        real_business_id = await resolve_business_id(business_id)

        async with AsyncSessionLocal() as session:
            try:
                # 1. Resolve room entity type
                stmt_et = select(EntityType).where(
                    EntityType.org_id == real_business_id,
                    EntityType.code == "hotel_room"
                )
                et_res = await session.execute(stmt_et)
                room_et = et_res.scalar_one_or_none()
                if not room_et:
                    return None

                # 2. Fetch all rooms
                rooms_stmt = select(EntityV2).where(
                    EntityV2.org_id == real_business_id,
                    EntityV2.entity_type_id == room_et.id
                )
                rooms_res = await session.execute(rooms_stmt)
                rooms = rooms_res.scalars().all()

                if not rooms:
                    return None

                # 3. Check active reservations to determine occupied/reserved rooms
                res_et_stmt = select(EntityType).where(
                    EntityType.org_id == real_business_id,
                    EntityType.code == "hotel_reservation"
                )
                res_et = (await session.execute(res_et_stmt)).scalar_one_or_none()
                booked_rooms = set()

                if res_et:
                    now_str = datetime.utcnow().strftime("%Y-%m-%d")
                    res_stmt = select(EntityV2).where(
                        EntityV2.org_id == real_business_id,
                        EntityV2.entity_type_id == res_et.id
                    )
                    active_res = (await session.execute(res_stmt)).scalars().all()
                    for r in active_res:
                        attrs = r.attributes or {}
                        cout = attrs.get("check_out_date", "")
                        status = attrs.get("status", "")
                        if status in ("RESERVED", "CHECKED_IN") and cout >= now_str:
                            booked_rooms.add(str(attrs.get("room_number", "")).strip().lower())

                # 4. Resolve Currency
                profile = await get_business_profile(real_business_id)
                country = str(profile.get("country", "")).lower()
                profile_currency = str(profile.get("currency", "")).upper()

                # Check if any room has Nigerian rate (> 1000) or profile says Nigeria / NGN
                has_large_rate = any(float((r.attributes or {}).get("nightly_rate") or 0) >= 1000 for r in rooms)
                if "nigeria" in country or profile_currency == "NGN" or has_large_rate:
                    currency_sym = "₦"
                    currency_name = "Naira (NGN)"
                else:
                    currency_sym = "$"
                    currency_name = "USD ($)"

                # 5. Build Room Directory lines
                directory_lines = []
                for room in rooms:
                    attrs = room.attributes or {}
                    r_num = str(room.display_label).strip()
                    r_type = attrs.get("room_type", "Standard Room")
                    rate = float(attrs.get("nightly_rate") or 0)
                    floor = attrs.get("floor", "1")
                    status = str(attrs.get("status", "VACANT")).upper()

                    is_occupied = r_num.lower() in booked_rooms or status in ("OCCUPIED", "MAINTENANCE", "OUT_OF_SERVICE")
                    avail_str = "OCCUPIED" if is_occupied else "VACANT / AVAILABLE"

                    directory_lines.append(
                        f"• Room \"{r_num}\" (Floor {floor}) | Type: {r_type} | Rate: {currency_sym}{rate:,.2f} per night | Status: {avail_str}"
                    )

                directory_text = "\n".join(directory_lines)

                return f"""
*** LIVE HOTEL ROOM DIRECTORY & REAL-TIME AVAILABILITY ***
Currency: {currency_sym} ({currency_name})

ACTIVE HOTEL ROOM INVENTORY:
{directory_text}

*** CRITICAL HOTEL RESERVATION & INVENTORY CONSTRAINTS ***
1. REAL INVENTORY ONLY: You MUST ONLY offer, quote, and reserve rooms that exist in the directory above. NEVER invent room numbers, fictitious room types, or make up prices.
2. ACCURATE RATES & CURRENCY: Always state the exact nightly rate from the directory using the hotel's currency ({currency_sym}, NEVER use $ unless the directory explicitly uses $).
3. AVAILABILITY CHECK & ALTERNATIVE RECOMMENDATIONS:
   - When a guest inquires or asks to book a room, check the availability in the directory above.
   - If the guest's desired room type is NOT in the directory or is currently OCCUPIED / UNAVAILABLE, explain politely that this type is unavailable, and immediately recommend the available room types and their rates from the directory above (e.g. "We do not have any Deluxe King rooms available at the moment, but we have our Standard King rooms (Suite 01, Suite 02, Suite 03) available at {currency_sym}15,000 per night. Would you like me to reserve one of these for you?").
4. ROOM ALLOCATION: When confirming a reservation, assign one of the available VACANT rooms from the directory above (e.g. "Suite 01").
5. ACTION TAG EXECUTION: When the guest agrees and gives their name and dates, output the [ACTION: HOTEL_RESERVATION | {{"guest_name": "...", "check_in_date": "YYYY-MM-DD", "check_out_date": "YYYY-MM-DD", "room_type": "...", "room_number": "...", "nights": N, "nightly_rate": RATE, "total_amount": TOTAL, "special_requests": "..."}}] tag with the exact room_number, room_type, nightly_rate, and calculated total_amount (nightly_rate * nights).
"""
            except Exception as e:
                logger.error(f"[HotelReservationService] Error compiling inventory context: {e}")
                return None

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
        Takes structured booking data from AI conversation, matches with actual room directory,
        creates Guest & Reservation entities in the Hotel PMS database, triggers workflow automations,
        and notifies frontdesk.
        """
        from services.db_service import resolve_business_id, get_business_profile
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
            # Default to 1 night stay
            try:
                cin_dt = datetime.strptime(str(check_in).strip()[:10], "%Y-%m-%d")
                check_out = (cin_dt + timedelta(days=1)).strftime("%Y-%m-%d")
            except Exception:
                check_in = today_str
                check_out = tomorrow_str

        room_type = (
            reservation_data.get("room_type") or 
            reservation_data.get("room") or 
            "Standard Room"
        ).strip()

        room_number = str(reservation_data.get("room_number") or "").strip()
        nights = int(reservation_data.get("nights") or 1)
        try:
            cin_dt = datetime.strptime(str(check_in)[:10], "%Y-%m-%d")
            cout_dt = datetime.strptime(str(check_out)[:10], "%Y-%m-%d")
            calculated_nights = max(1, (cout_dt - cin_dt).days)
            nights = calculated_nights
        except Exception:
            pass

        nightly_rate = float(reservation_data.get("nightly_rate") or 15000.0)
        total_amount = float(reservation_data.get("total_amount") or (nightly_rate * nights))
        special_requests = reservation_data.get("special_requests") or reservation_data.get("notes") or ""
        property_id = reservation_data.get("property_id") or None

        logger.info(
            f"[HotelReservationService] Processing AI reservation for {guest_name} "
            f"({check_in} to {check_out}, Requested Room: {room_number or room_type}) in org {real_business_id}"
        )

        async with AsyncSessionLocal() as session:
            try:
                # 1. Resolve or Create Guest Entity
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

                # 2. Resolve Existing Room from Directory (DO NOT CREATE PHANTOM ROOMS)
                room_type_id = await cls._get_or_create_entity_type(session, real_business_id, "hotel_room", "Hotel Room")
                all_rooms_stmt = select(EntityV2).where(
                    EntityV2.org_id == real_business_id,
                    EntityV2.entity_type_id == room_type_id
                )
                all_rooms_res = await session.execute(all_rooms_stmt)
                all_rooms = all_rooms_res.scalars().all()

                room = None

                # A. Try matching exact room number / label
                if room_number and all_rooms:
                    for r in all_rooms:
                        if r.display_label.strip().lower() == room_number.strip().lower():
                            room = r
                            break

                # B. Try matching by room type
                if not room and all_rooms and room_type:
                    for r in all_rooms:
                        r_attrs = r.attributes or {}
                        existing_type = str(r_attrs.get("room_type", "")).lower()
                        target_type = room_type.lower()
                        if existing_type in target_type or target_type in existing_type:
                            room = r
                            break

                # C. Fallback to first available room in the hotel directory
                if not room and all_rooms:
                    # Prefer VACANT room
                    vacant_room = next((r for r in all_rooms if (r.attributes or {}).get("status", "").upper() == "VACANT"), None)
                    room = vacant_room or all_rooms[0]

                # D. If hotel has NO rooms registered at all, create an initial room
                if not room:
                    room_number = room_number or "101"
                    room = EntityV2(
                        id=f"ent_{uuid.uuid4().hex[:16]}",
                        org_id=real_business_id,
                        entity_type_id=room_type_id,
                        display_label=room_number,
                        attributes={
                            "room_type": room_type,
                            "floor": "1",
                            "status": "VACANT",
                            "housekeeping": "Clean",
                            "nightly_rate": nightly_rate,
                            "property_id": property_id
                        }
                    )
                    session.add(room)
                    await session.flush()

                # Adopt real rate and room number from the matched room in the Room Directory
                room_attrs = room.attributes or {}
                room_number = room.display_label
                room_type = room_attrs.get("room_type", room_type)
                real_rate = room_attrs.get("nightly_rate")
                if real_rate is not None and float(real_rate) > 0:
                    nightly_rate = float(real_rate)
                    total_amount = nightly_rate * nights

                # 3. Create Reservation Entity in PMS
                res_type_id = await cls._get_or_create_entity_type(session, real_business_id, "hotel_reservation", "Hotel Reservation")
                reservation_id = f"ent_{uuid.uuid4().hex[:16]}"
                
                reservation = EntityV2(
                    id=reservation_id,
                    org_id=real_business_id,
                    entity_type_id=res_type_id,
                    display_label=f"Res: {guest_name} - Room {room_number}",
                    attributes={
                        "guest_id": guest.id,
                        "guest_name": guest.display_label,
                        "guest_phone": customer_phone or guest.attributes.get("phone", ""),
                        "guest_email": customer_email or guest.attributes.get("email", ""),
                        "room_id": room.id,
                        "room_number": room_number,
                        "room_type": room_type,
                        "check_in_date": str(check_in)[:10],
                        "check_out_date": str(check_out)[:10],
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
                    f"for {guest_name} in Room {room_number} ({check_in} to {check_out}) at {nightly_rate}/night"
                )

                # 4. Trigger Workflow Engine for Automations
                try:
                    await workflow_engine.trigger_workflow(real_business_id, "reservation_booked", {
                        "reservation_id": reservation.id,
                        "guest_name": guest_name,
                        "guest_phone": customer_phone,
                        "guest_email": customer_email,
                        "room_number": room_number,
                        "room_type": room_type,
                        "check_in": check_in,
                        "check_out": check_out,
                        "nights": nights,
                        "nightly_rate": nightly_rate,
                        "total_amount": total_amount,
                        "platform": platform
                    })
                except Exception as wf_err:
                    logger.warning(f"[HotelReservationService] Workflow trigger error: {wf_err}")

                # 5. Dispatch Direct Front Desk Alert via Department Routing
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
                    "room_number": room_number,
                    "room_type": room_type,
                    "check_in_date": str(check_in)[:10],
                    "check_out_date": str(check_out)[:10],
                    "nights": nights,
                    "nightly_rate": nightly_rate,
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
        """Notifies the front desk via their configured WhatsApp or Email channels with accurate currency."""
        from services.routing_service import DepartmentRoutingService
        from services.db_service import get_business_profile

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
        nights = attrs.get("nights", 1)
        nightly_rate = float(attrs.get("nightly_rate", 0))
        total_amt = float(attrs.get("total_amount", 0))
        phone = attrs.get("guest_phone", "N/A")

        # Currency resolution
        profile = await get_business_profile(business_id)
        country = str(profile.get("country", "")).lower()
        profile_currency = str(profile.get("currency", "")).upper()

        if "nigeria" in country or profile_currency == "NGN" or nightly_rate >= 1000:
            currency_sym = "₦"
        else:
            currency_sym = "$"

        alert_message = (
            f"🛎️ *NEW HOTEL RESERVATION CONFIRMED*\n\n"
            f"• *Guest*: {guest_name}\n"
            f"• *Contact*: {phone}\n"
            f"• *Room*: {room_number} ({room_type})\n"
            f"• *Rate*: {currency_sym}{nightly_rate:,.2f} / night\n"
            f"• *Dates*: {check_in} to {check_out} ({nights} night{'s' if nights > 1 else ''})\n"
            f"• *Total*: {currency_sym}{total_amt:,.2f}\n"
            f"• *Booked via*: {platform.capitalize()} AI\n\n"
            f"The reservation is recorded in your Hotel Reservations Dashboard."
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
            <p><strong>Nightly Rate:</strong> {currency_sym}{nightly_rate:,.2f}</p>
            <p><strong>Check-In:</strong> {check_in}</p>
            <p><strong>Check-Out:</strong> {check_out} ({nights} night{'s' if nights > 1 else ''})</p>
            <p><strong>Total Amount:</strong> {currency_sym}{total_amt:,.2f}</p>
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
