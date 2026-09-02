"""
Hotel Reservation Service for InteracAI.
Handles end-to-end ingestion, room resolution, guest profile linking,
Property Management System (PMS) database persistence, and Front Desk alert dispatching.
"""

import uuid
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
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
    async def create_reservation_from_ai(
        cls,
        business_id: str,
        reservation_data: Dict[str, Any],
        customer_phone: Optional[str] = None,
        customer_email: Optional[str] = None,
        platform: str = "whatsapp"
    ) -> Optional[Dict[str, Any]]:
        """
        Takes structured booking data from AI conversation, creates Guest & Reservation
        entities in the Hotel PMS database, triggers workflow automations, and notifies frontdesk.
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
            "Deluxe King Room"
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

        nightly_rate = float(reservation_data.get("nightly_rate") or 150.0)
        total_amount = float(reservation_data.get("total_amount") or (nightly_rate * nights))
        special_requests = reservation_data.get("special_requests") or reservation_data.get("notes") or ""
        property_id = reservation_data.get("property_id") or None

        logger.info(
            f"[HotelReservationService] Processing AI reservation for {guest_name} "
            f"({check_in} to {check_out}, Room: {room_type}) in org {real_business_id}"
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
                    # Update phone/email if guest already existed but was missing contact
                    attrs = dict(guest.attributes or {})
                    if customer_phone and not attrs.get("phone"):
                        attrs["phone"] = customer_phone
                    if customer_email and not attrs.get("email"):
                        attrs["email"] = customer_email
                    guest.attributes = attrs
                    session.add(guest)

                # 2. Resolve or Create Room Entity
                room_type_id = await cls._get_or_create_entity_type(session, real_business_id, "hotel_room", "Hotel Room")
                room = None

                if room_number:
                    # Lookup by exact room number
                    room_stmt = select(EntityV2).where(
                        EntityV2.org_id == real_business_id,
                        EntityV2.entity_type_id == room_type_id,
                        EntityV2.display_label == room_number
                    )
                    room_res = await session.execute(room_stmt)
                    room = room_res.scalar_one_or_none()

                all_rooms_stmt = select(EntityV2).where(
                    EntityV2.org_id == real_business_id,
                    EntityV2.entity_type_id == room_type_id
                )
                all_rooms_res = await session.execute(all_rooms_stmt)
                all_rooms = all_rooms_res.scalars().all()

                if not room:
                    # Find any room matching room_type
                    for r in all_rooms:
                        attrs = r.attributes or {}
                        if attrs.get("room_type", "").lower() in room_type.lower() or room_type.lower() in attrs.get("room_type", "").lower():
                            room = r
                            room_number = r.display_label
                            break

                if not room:
                    # Default room number if none resolved
                    if not room_number:
                        room_number = f"10{len(all_rooms) + 1}"

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
                        "room_type": room.attributes.get("room_type", room_type),
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
                    f"for {guest_name} in Room {room_number} ({check_in} to {check_out})"
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

        alert_message = (
            f"🛎️ *NEW HOTEL RESERVATION CONFIRMED*\n\n"
            f"• *Guest*: {guest_name}\n"
            f"• *Contact*: {phone}\n"
            f"• *Room*: {room_number} ({room_type})\n"
            f"• *Dates*: {check_in} to {check_out}\n"
            f"• *Total*: ${total_amt:.2f}\n"
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
            <p><strong>Check-In:</strong> {check_in}</p>
            <p><strong>Check-Out:</strong> {check_out}</p>
            <p><strong>Total Amount:</strong> ${total_amt:.2f}</p>
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
