import logging
from datetime import datetime, timedelta, time as py_time
from sqlalchemy import select, and_
from database.session import AsyncSessionLocal
from database.models.scheduling import Appointment, AppointmentType, AvailabilityRule
from database.models.crm import Lead
import uuid

logger = logging.getLogger(__name__)

class SchedulingService:
    async def get_available_slots(self, business_id: str, date: datetime.date, appointment_type_id: str):
        """
        Calculates available slots for a specific date and appointment type.
        """
        async with AsyncSessionLocal() as session:
            # 1. Get Appointment Type Info
            apt_type = await session.get(AppointmentType, appointment_type_id)
            if not apt_type or apt_type.business_id != business_id:
                logger.error(f"Appointment type {appointment_type_id} not found for business {business_id}")
                return []
            
            duration = apt_type.duration_minutes
            
            # 2. Get Availability Rules for the day of week
            day_of_week = date.weekday() # 0 = Monday
            rule_stmt = select(AvailabilityRule).where(
                AvailabilityRule.business_id == business_id,
                AvailabilityRule.day_of_week == day_of_week,
                AvailabilityRule.is_active == True
            )
            rule_res = await session.execute(rule_stmt)
            rules = rule_res.scalars().all()
            
            if not rules:
                return [] # No availability defined for this day
            
            # 3. Get existing appointments for the day
            start_of_day = datetime.combine(date, py_time.min)
            end_of_day = datetime.combine(date, py_time.max)
            
            apt_stmt = select(Appointment).where(
                Appointment.business_id == business_id,
                Appointment.start_at >= start_of_day,
                Appointment.start_at <= end_of_day,
                Appointment.status.in_(["scheduled", "confirmed"])
            )
            apt_res = await session.execute(apt_stmt)
            existing_apts = apt_res.scalars().all()
            
            # 4. Generate Slots
            available_slots = []
            for rule in rules:
                current_time = datetime.combine(date, rule.start_time)
                end_time = datetime.combine(date, rule.end_time)
                
                while current_time + timedelta(minutes=duration) <= end_time:
                    slot_start = current_time
                    slot_end = current_time + timedelta(minutes=duration)
                    
                    # Check for overlap
                    overlap = False
                    for apt in existing_apts:
                        if (slot_start < apt.end_at) and (apt.start_at < slot_end):
                            overlap = True
                            break
                    
                    if not overlap:
                        # Don't show past slots for today
                        if slot_start > datetime.utcnow():
                            available_slots.append(slot_start)
                    
                    current_time += timedelta(minutes=duration)
                    
            return available_slots

    async def book_appointment(self, business_id: str, appointment_type_id: str, start_at: datetime, lead_id: int = None, conversation_id: str = None, notes: str = None):
        """
        Records a new appointment.
        """
        logger.info(f"[BookingService] Starting booking: BID={business_id}, Type={appointment_type_id}, Start={start_at}")
        async with AsyncSessionLocal() as session:
            # 1. Get Type
            apt_type = await session.get(AppointmentType, appointment_type_id)
            if not apt_type:
                logger.error(f"[BookingService] Invalid appointment type: {appointment_type_id}")
                return {"success": False, "error": "Invalid appointment type"}
            
            if apt_type.business_id != business_id:
                logger.error(f"[BookingService] Type {appointment_type_id} does not belong to BID {business_id}")
                return {"success": False, "error": "Ownership mismatch"}

            end_at = start_at + timedelta(minutes=apt_type.duration_minutes)
            
            # 2. Resolve Lead ID if missing but conversation_id exists
            if not lead_id and conversation_id:
                from services.db_service import get_lead_by_conversation
                lead_id = await get_lead_by_conversation(business_id, conversation_id)
                if lead_id:
                    logger.info(f"[BookingService] Resolved lead_id {lead_id} from conversation_id {conversation_id}")

            # 2a. Check for duplicates (Idempotency)
            # If an appointment already exists for this lead/convo at this time, return it instead of creating a new one.
            dup_stmt = select(Appointment).where(
                Appointment.business_id == business_id,
                Appointment.start_at == start_at,
                Appointment.status.in_(["scheduled", "confirmed"])
            )
            
            if lead_id:
                dup_stmt = dup_stmt.where(Appointment.lead_id == lead_id)
            elif conversation_id:
                dup_stmt = dup_stmt.where(Appointment.conversation_id == conversation_id)
            
            dup_res = await session.execute(dup_stmt)
            existing_apt = dup_res.scalars().first()
            
            if existing_apt:
                logger.warning(f"[BookingService] Duplicate booking attempt detected for BID {business_id}, Start {start_at}. Returning existing ID {existing_apt.id}.")
                return {"success": True, "appointment_id": existing_apt.id}

            # 3. Create Appointment
            apt = Appointment(
                business_id=business_id,
                lead_id=lead_id,
                conversation_id=conversation_id,
                appointment_type_id=appointment_type_id,
                start_at=start_at,
                end_at=end_at,
                notes=notes,
                status="scheduled"
            )
            session.add(apt)
            await session.flush() # Ensure ID is generated for activity
            
            # 4. Log Activity if Lead exists
            if lead_id:
                from database.models.crm import LeadActivity
                activity = LeadActivity(
                    lead_id=lead_id,
                    business_id=business_id,
                    type="appointment_booked",
                    content={
                        "appointment_id": apt.id,
                        "type": apt_type.name,
                        "start_at": start_at.isoformat()
                    },
                    created_by="system"
                )
                session.add(activity)
            
            try:
                await session.commit()
                logger.info(f"[BookingService] Committed appointment {apt.id} for BID {business_id}")
                return {"success": True, "appointment_id": apt.id}
            except Exception as e:
                logger.error(f"[BookingService] Commit failed: {e}")
                await session.rollback()
                return {"success": False, "error": str(e)}

    async def get_business_appointments(self, business_id: str, start_date: datetime = None, end_date: datetime = None, lead_id: int = None):
        from sqlalchemy.orm import selectinload
        async with AsyncSessionLocal() as session:
            stmt = select(Appointment).options(selectinload(Appointment.appointment_type)).where(Appointment.business_id == business_id)
            if lead_id:
                stmt = stmt.where(Appointment.lead_id == lead_id)
            if start_date:
                stmt = stmt.where(Appointment.start_at >= start_date)
            if end_date:
                stmt = stmt.where(Appointment.start_at <= end_date)
            
            stmt = stmt.order_by(Appointment.start_at.asc())
            res = await session.execute(stmt)
            apts = res.scalars().all()
            return apts
            # Convert to dict with type names
            return [
                {
                    "id": a.id,
                    "business_id": a.business_id,
                    "lead_id": a.lead_id,
                    "appointment_type_id": a.appointment_type_id,
                    "appointment_type_name": a.appointment_type.name if a.appointment_type else "General",
                    "appointment_type_color": a.appointment_type.color_code if a.appointment_type else "#3b82f6",
                    "start_at": a.start_at.isoformat(),
                    "end_at": a.end_at.isoformat(),
                    "status": a.status,
                    "notes": a.notes
                }
                for a in apts
            ]

    async def get_upcoming_available_slots(self, business_id: str, days: int = 3):
        """
        Fetches available slots for the next 'days' days.
        Returns a dictionary mapping dates to lists of available slot times.
        """
        results = {}
        # We start from today, but use UTC now for the threshold
        today = datetime.utcnow().date()
        
        # Need at least one appointment type to know the duration
        async with AsyncSessionLocal() as session:
            type_stmt = select(AppointmentType).where(AppointmentType.business_id == business_id, AppointmentType.is_active == True)
            type_res = await session.execute(type_stmt)
            apt_types = type_res.scalars().all()
            
            if not apt_types:
                return {}
                
            # For simplicity in the prompt, let's just use the first active appointment type
            target_type = apt_types[0]
            
            for i in range(days):
                current_date = today + timedelta(days=i)
                slots = await self.get_available_slots(business_id, current_date, target_type.id)
                if slots:
                    date_str = current_date.strftime("%Y-%m-%d")
                    results[date_str] = [s.strftime("%H:%M") for s in slots]
                    
        return {
            "appointment_type": target_type.name,
            "appointment_type_id": target_type.id,
            "slots": results
        }

scheduling_service = SchedulingService()
