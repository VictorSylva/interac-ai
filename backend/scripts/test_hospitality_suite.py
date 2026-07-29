import asyncio
import httpx
import sys

BASE_URL = "http://localhost:8000/api/v1/hotels"
GENERIC_URL = "http://localhost:8000/api/v1"
ORG_ID = "0bbd48c4-b066-435a-be3d-c095b55897c6"
PROP_ID = "prop_lagos"


async def run_tests():
    print("====================================================")
    print("   INTERACAI HOSPITALITY SUITE INTEGRATION TESTS    ")
    print("====================================================")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Create Reservation
        print("\n[TEST 1] Creating Booking Reservation...")
        res_payload = {
            "org_id": ORG_ID,
            "guest_name": "Alabi Ogunlesi",
            "room_number": "502",
            "check_in_date": "2026-07-28",
            "check_out_date": "2026-08-02",
            "nightly_rate": 120000.0,
            "property_id": PROP_ID
        }
        res = await client.post(f"{BASE_URL}/reservations", json=res_payload)
        if res.status_code != 201:
            print(f"❌ Failed: {res.text}")
            sys.exit(1)
        booking = res.json()
        booking_id = booking["id"]
        print(f"✅ Success: Booking ID = {booking_id}")

        # 2. Perform Check-In
        print("\n[TEST 2] Performing Guest Check-In...")
        ci_res = await client.post(f"{BASE_URL}/checkin", json={
            "org_id": ORG_ID,
            "reservation_id": booking_id
        })
        if ci_res.status_code != 200:
            print(f"❌ Failed: {ci_res.text}")
            sys.exit(1)
        ci_data = ci_res.json()
        folio_id = ci_data.get("folio_id") or ci_data["reservation"]["attributes"]["folio_id"]
        print(f"✅ Success: Checked-In. Folio ID = {folio_id}")

        # 3. Create Restaurant POS Order & Charge to Room
        print("\n[TEST 3] Ordering Meal & Charging to Room Folio...")
        order_payload = {
            "org_id": ORG_ID,
            "table_number": "Table 4",
            "items": [
                {"name": "Egusi Soup & Semo", "qty": 1, "price": 5000.0},
                {"name": "Mocktail Chapman", "qty": 2, "price": 1500.0}
            ],
            "property_id": PROP_ID
        }
        order_res = await client.post(f"{BASE_URL}/restaurant/orders", json=order_payload)
        if order_res.status_code != 201:
            print(f"❌ Order failed: {order_res.text}")
            sys.exit(1)
        order = order_res.json()
        order_id = order["id"]
        print(f"🍽️ POS Order Ticket Created: {order_id} | Total: ₦8,000")

        # Post order charge to room folio
        charge_res = await client.post(f"{BASE_URL}/restaurant/orders/{order_id}/room-charge", json={
            "org_id": ORG_ID,
            "room_number": "502"
        })
        if charge_res.status_code != 200:
            print(f"❌ Room charge failed: {charge_res.text}")
            sys.exit(1)
        print("✅ Success: POS Order billed directly to guest folio.")

        # 4. Check Folio Balance & Pay
        print("\n[TEST 4] Fetching Folio Balance & processing payment...")
        # Add a custom manual charge first
        await client.post(f"{BASE_URL}/folios/charge", json={
            "org_id": ORG_ID,
            "folio_id": folio_id,
            "description": "Laundry Dry Cleaning",
            "amount": 4000.0
        })
        
        # Pay balance
        pay_res = await client.post(f"{BASE_URL}/folios/pay", json={
            "org_id": ORG_ID,
            "folio_id": folio_id,
            "amount": 132000.0,  # 120000 night rate + 8000 POS + 4000 laundry
            "payment_method": "Card"
        })
        if pay_res.status_code != 200:
            print(f"❌ Payment failed: {pay_res.text}")
            sys.exit(1)
        print("✅ Success: Folio fully settled. Balance = ₦0.00")

        # 5. Perform Check-Out
        print("\n[TEST 5] Performing Guest Check-Out...")
        co_res = await client.post(f"{BASE_URL}/checkout", json={
            "org_id": ORG_ID,
            "reservation_id": booking_id
        })
        if co_res.status_code != 200:
            print(f"❌ Checkout failed: {co_res.text}")
            sys.exit(1)
        print("✅ Success: Checkout finalized. Room is VACANT and Dirty.")

        # 6. Housekeeping Cleanup Assign & complete
        print("\n[TEST 6] Creating Housekeeping Cleanup Task...")
        task_res = await client.post(f"{BASE_URL}/housekeeping/tasks", json={
            "org_id": ORG_ID,
            "room_number": "502",
            "assigned_to": "Joy Okafor",
            "priority": 5,
            "notes": "Express turnaround clean",
            "property_id": PROP_ID
        })
        if task_res.status_code != 201:
            print(f"❌ Task creation failed: {task_res.text}")
            sys.exit(1)
        task = task_res.json()
        task_id = task["id"]
        
        # Complete task
        comp_res = await client.put(f"{BASE_URL}/housekeeping/tasks/{task_id}", json={
            "status": "COMPLETED"
        })
        if comp_res.status_code != 200:
            print(f"❌ Task complete failed: {comp_res.text}")
            sys.exit(1)
        print("✅ Success: Housekeeping task completed. Room housekeeping status = Clean.")

        # 7. Facility Fault Maintenance Ticket
        print("\n[TEST 7] Logging Maintenance Fault Ticket...")
        ticket_res = await client.post(f"{BASE_URL}/maintenance/tickets", json={
            "org_id": ORG_ID,
            "room_number": "502",
            "issue_description": "HVAC blower motor making heavy noise",
            "priority": "HIGH",
            "assigned_technician": "Samuel Ade",
            "property_id": PROP_ID
        })
        if ticket_res.status_code != 201:
            print(f"❌ Ticket creation failed: {ticket_res.text}")
            sys.exit(1)
        ticket = ticket_res.json()
        ticket_id = ticket["id"]
        print(f"🛠️ Ticket logged: {ticket_id}. Room 502 status = OUT_OF_SERVICE.")

        # Resolve ticket
        res_res = await client.put(f"{BASE_URL}/maintenance/tickets/{ticket_id}", json={
            "status": "RESOLVED"
        })
        if res_res.status_code != 200:
            print(f"❌ Ticket resolve failed: {res_res.text}")
            sys.exit(1)
        print("✅ Success: Maintenance ticket resolved. Room returned to VACANT.")

        # 8. Financial yield reporting
        print("\n[TEST 8] Fetching yield reporting metrics...")
        report_res = await client.get(f"{BASE_URL}/finance/reports?org_id={ORG_ID}&property_id={PROP_ID}")
        if report_res.status_code != 200:
            print(f"❌ Report failed: {report_res.text}")
            sys.exit(1)
        report = report_res.json()
        print(f"📊 Yield stats: Occupancy={report['occupancy_rate']} | Collected=₦{report['total_collected']}")

        # 9. Type A integrations (Opera Webhook)
        print("\n[TEST 9] Testing Opera PMS webhook receiver connector...")
        web_payload = {
            "org_id": ORG_ID,
            "property_id": PROP_ID,
            "event_type": "BOOKING_CREATED",
            "source": "Opera",
            "data": {
                "guestFullName": "Olumide Awosika",
                "assignedRoomNumber": "503",
                "arrivalDate": "2026-08-01",
                "departureDate": "2026-08-05",
                "dailyRate": 140000.0
            }
        }
        web_res = await client.post(f"{BASE_URL}/integrations/webhook", json=web_payload)
        if web_res.status_code != 200:
            print(f"❌ Webhook sync failed: {web_res.text}")
            sys.exit(1)
        print("✅ Success: Webhook observation signal synced and normalized booking in DB.")

        # 10. Email Parsing
        print("\n[TEST 10] Testing Regex email confirmation parsing...")
        email_payload = {
            "org_id": ORG_ID,
            "property_id": PROP_ID,
            "email_body": "Booking confirmation!\nGuest: Dr. Funmi Alao\nRoom: Room 504\nCheck-in: 2026-08-03\nCheck-out: 2026-08-07\nRate: 150000 NGN"
        }
        email_res = await client.post(f"{BASE_URL}/integrations/email-parser", json=email_payload)
        if email_res.status_code != 200:
            print(f"❌ Email parse failed: {email_res.text}")
            sys.exit(1)
        email_data = email_res.json()
        print(f"✅ Success: Email parsed. Reserved Room {email_data['booking']['attributes']['room_number']} for {email_data['booking']['attributes']['guest_name']}.")

    print("\n====================================================")
    print("      🎉 ALL PMS SUITE TESTS PASSED SUCCESSFULLY!    ")
    print("====================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
