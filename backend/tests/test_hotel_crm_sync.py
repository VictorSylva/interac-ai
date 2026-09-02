import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal
from database.models.dynamic_entity import EntityV2, EntityType
from database.models.crm import Lead
from services.hotel_reservation_service import hotel_reservation_service
from services.db_service import resolve_business_id
from sqlalchemy import select, delete

async def run_test():
    test_org_id = "89b093e8-ffd0-46e8-82c3-7e933937c080" # Grand Azure Hotel
    guest_name = "Chief Emeka Okafor"
    phone = "+2348039991122"
    email = "emeka.okafor@example.com"
    
    print(f"--- 1. Testing AI Hotel Reservation Booking & CRM Sync for {guest_name} ---")
    
    res = await hotel_reservation_service.create_reservation_from_ai(
        business_id=test_org_id,
        reservation_data={
            "guest_name": guest_name,
            "check_in_date": "2026-10-15",
            "check_out_date": "2026-10-18",
            "room_type": "Standard King",
            "room_number": "Suite 01",
            "nights": 3,
            "nightly_rate": 15000.0,
            "total_amount": 45000.0,
            "special_requests": "Late checkout requested"
        },
        customer_phone=phone,
        customer_email=email,
        platform="whatsapp"
    )
    
    assert res is not None, "Reservation creation failed!"
    print(f"Created Reservation: ID={res['id']}, Room={res['room_number']}, Guest={res['guest_name']}")
    assert res["guest_name"] == guest_name
    assert res["room_number"] == "Suite 01"
    
    print("--- 2. Verifying CRM Lead Persistence ---")
    async with AsyncSessionLocal() as session:
        lead_stmt = select(Lead).where(
            Lead.business_id == test_org_id,
            Lead.name == guest_name
        )
        lead_res = await session.execute(lead_stmt)
        lead = lead_res.scalars().first()
        
        assert lead is not None, "CRM Lead was NOT created!"
        print(f"CRM Lead Found: ID={lead.id}, Name={lead.name}, Phone={lead.phone}, Status={lead.status}, Value={lead.value}")
        assert lead.phone == phone
        assert lead.email == email
        assert lead.status == "won"
        assert lead.value == 45000
        assert "Suite 01" in lead.notes
        
    print("--- 3. Verifying Hotel Routes List Reservations Endpoint ---")
    from httpx import AsyncClient, ASGITransport
    from main import app
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Test A: Fetch by business UUID without auth header
        resp1 = await ac.get(f"/api/v1/hotels/reservations?org_id={test_org_id}")
        assert resp1.status_code == 200, f"Fetch by UUID failed: {resp1.status_code} {resp1.text}"
        data1 = resp1.json()
        print(f"Reservations returned for UUID (no auth header): {len(data1)}")
        found = any(r["display_label"] == f"Res: {guest_name} - Suite 01" for r in data1)
        assert found, "Created reservation not found in list_reservations response!"
        
        # Test B: Fetch by email without auth header
        owner_email = "hynagapiabasadeimbo@gmail.com"
        resp2 = await ac.get(f"/api/v1/hotels/reservations?org_id={owner_email}")
        assert resp2.status_code == 200, f"Fetch by email failed: {resp2.status_code} {resp2.text}"
        data2 = resp2.json()
        print(f"Reservations returned for Owner Email: {len(data2)}")
        found2 = any(r["display_label"] == f"Res: {guest_name} - Suite 01" for r in data2)
        assert found2, "Created reservation not found when queried by owner email!"

    print("--- 4. Cleaning up Test Artifacts ---")
    async with AsyncSessionLocal() as session:
        # Delete reservation and guest entity
        await session.execute(
            delete(EntityV2).where(
                EntityV2.org_id == test_org_id,
                EntityV2.display_label.in_([f"Res: {guest_name} - Suite 01", guest_name])
            )
        )
        # Delete CRM lead
        await session.execute(
            delete(Lead).where(
                Lead.business_id == test_org_id,
                Lead.name == guest_name
            )
        )
        await session.commit()
    print("Test data cleaned up successfully.")
    print("ALL TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    asyncio.run(run_test())
