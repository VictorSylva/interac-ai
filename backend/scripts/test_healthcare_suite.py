import json
import unittest
import urllib.request
import urllib.parse
import os
import sys
import asyncio
import jwt
from datetime import datetime, timedelta

# Add backend to path to allow importing modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env variables before importing session/auth
from dotenv import load_dotenv
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(backend_dir, ".env"))

from database.session import AsyncSessionLocal
from database.models.general import User
from sqlalchemy import select

API_BASE = "http://localhost:8000/api/v1"

async def resolve_test_auth():
    async with AsyncSessionLocal() as session:
        # Get the first user in the DB to construct a token
        stmt = select(User).limit(1)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            from services.auth_service import register_business
            reg = await register_business(session, "test-user-hosp@interac.ai", "password123", "Test Hospital")
            stmt = select(User).where(User.id == reg["user_id"])
            res = await session.execute(stmt)
            user = res.scalar_one()

        JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-in-prod-1234567890")
        JWT_ALGORITHM = "HS256"
        payload = {
            "user_id": user.id,
            "business_id": user.business_id,
            "email": user.email,
            "role": "owner",
            "department": "general",
            "exp": datetime.utcnow() + timedelta(days=1)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return token, user.business_id

class TestHealthcareSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.token, cls.org_id = asyncio.run(resolve_test_auth())
        print(f"Test Class initialized. Auth Token resolved. Representing org: {cls.org_id}")

    def post_json(self, path, payload):
        url = f"{API_BASE}{path}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, 
            data=data, 
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token}"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"POST {path} HTTPError {e.code}: {e.read().decode('utf-8')}")
            raise e

    def get_json(self, path):
        url = f"{API_BASE}{path}"
        req = urllib.request.Request(
            url, 
            headers={"Authorization": f"Bearer {self.token}"},
            method="GET"
        )
        try:
            with urllib.request.urlopen(req) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"GET {path} HTTPError {e.code}: {e.read().decode('utf-8')}")
            raise e

    def put_json(self, path, payload):
        url = f"{API_BASE}{path}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, 
            data=data, 
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token}"
            },
            method="PUT"
        )
        try:
            with urllib.request.urlopen(req) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"PUT {path} HTTPError {e.code}: {e.read().decode('utf-8')}")
            raise e

    def test_01_patient_flow(self):
        print("\n--- Running Patient Flow Integration Tests ---")
        
        # 1. Register Patient
        patient_payload = {
            "org_id": self.org_id,
            "name": "Jane Doe Test",
            "national_id": "NIN-8890-TEST",
            "insurance_provider": "AXA Mansard Test",
            "insurance_policy": "POL-99120-TEST",
            "emergency_contact": "+2348000000000",
            "medical_history": "History of mild seasonal asthma.",
            "allergies": ["Aspirin", "Penicillin"]
        }
        patient_res = self.post_json("/hospital/patients", patient_payload)
        self.assertIn("id", patient_res)
        self.assertEqual(patient_res["display_label"], "Jane Doe Test")
        patient_id = patient_res["attributes"]["patient_id"]
        print(f"Registered patient successfully with ID: {patient_id}")

        # 2. Verify Patient list
        patients_list = self.get_json(f"/hospital/patients?org_id={self.org_id}")
        self.assertTrue(len(patients_list) > 0)

        # 3. Book Appointment
        appt_payload = {
            "org_id": self.org_id,
            "patient_id": patient_id,
            "patient_name": "Jane Doe Test",
            "doctor_name": "Dr. Amina Yusuf",
            "scheduled_time": "2026-08-01T10:00:00Z",
            "department": "General Outpatient",
            "visit_type": "Scheduled"
        }
        appt_res = self.post_json("/hospital/appointments", appt_payload)
        self.assertIn("id", appt_res)
        self.assertEqual(appt_res["attributes"]["status"], "BOOKED")
        print("Appointment scheduled successfully.")

        # 4. Trigger Reminder
        reminder_payload = {
            "phone": "+2348000000000",
            "patient_name": "Jane Doe Test"
        }
        reminder_res = self.post_json("/hospital/appointments/reminders", reminder_payload)
        self.assertEqual(reminder_res.get("status"), "SUCCESS")
        print("Sms/WhatsApp appointment reminder simulated successfully.")

        # 5. Create EMR Notes & Orders
        emr_payload = {
            "org_id": self.org_id,
            "patient_id": patient_id,
            "patient_name": "Jane Doe Test",
            "diagnoses": "Acute Malaria Symptomatic",
            "notes": "Patient reports high fever and headaches.",
            "vitals": {"systolic": 115, "diastolic": 75, "heart_rate": 82, "temperature": 38.5, "spo2": 97},
            "prescriptions": [{"drug": "Artemether-Lumefantrine 80/480mg", "dosage": "1 tab 2x daily x 3 days"}],
            "lab_requests": ["Urinalysis", "Blood Culture"],
            "radiology_requests": ["Chest X-Ray"]
        }
        emr_res = self.post_json("/hospital/emr", emr_payload)
        self.assertIn("id", emr_res)
        print("Clinical EMR note and quick-orders registered.")

        # 6. Retrieve EMR list
        emr_list = self.get_json(f"/hospital/emr?org_id={self.org_id}&patient_id={patient_id}")
        self.assertTrue(len(emr_list) > 0)
        self.assertEqual(emr_list[0]["attributes"]["diagnoses"], "Acute Malaria Symptomatic")
        print("EMR history retrieved and validated.")

    def test_02_clinical_departments(self):
        print("\n--- Running Department Operations Tests ---")
        
        # 1. Pharmacy Inventory Check
        inv = self.get_json(f"/hospital/pharmacy/inventory?org_id={self.org_id}")
        self.assertTrue(len(inv) > 0)
        first_drug = inv[0]
        initial_qty = first_drug["attributes"]["qty"]
        print(f"Initial Pharmacy stock for {first_drug['display_label']}: {initial_qty} units")

        # 2. Dispense
        disp_payload = {
            "org_id": self.org_id,
            "patient_id": "PAT-TEST-101",
            "patient_name": "Test Patient",
            "drug_name": first_drug["display_label"],
            "qty": 2,
            "prescription_id": "PR-9092-TEST"
        }
        disp_res = self.post_json("/hospital/pharmacy/dispense", disp_payload)
        self.assertEqual(disp_res["status"], "SUCCESS")
        
        # Check stock reduction
        inv_after = self.get_json(f"/hospital/pharmacy/inventory?org_id={self.org_id}")
        after_qty = next(item["attributes"]["qty"] for item in inv_after if item["id"] == first_drug["id"])
        self.assertEqual(initial_qty - 2, after_qty)
        print(f"Dispensed successfully. Stock updated to: {after_qty} units")

        # 3. Lab Test Queue and Entry
        lab_queue = self.get_json(f"/hospital/laboratory/tests?org_id={self.org_id}")
        
        # If queue is empty, trigger test request first
        if not lab_queue:
            req_payload = {
                "org_id": self.org_id,
                "patient_id": "PAT-TEST-101",
                "patient_name": "Test Patient",
                "test_type": "Blood Culture"
            }
            self.post_json("/hospital/laboratory/tests", req_payload)
            lab_queue = self.get_json(f"/hospital/laboratory/tests?org_id={self.org_id}")

        self.assertTrue(len(lab_queue) > 0)
        pending_test = lab_queue[0]
        
        lab_update = {
            "org_id": self.org_id,
            "status": "COMPLETED",
            "results": "Malaria parasites identified (+2)",
            "is_critical": True
        }
        lab_res = self.put_json(f"/hospital/laboratory/tests/{pending_test['id']}", lab_update)
        self.assertEqual(lab_res["attributes"]["status"], "COMPLETED")
        self.assertEqual(lab_res["attributes"]["results"], "Malaria parasites identified (+2)")
        print("Laboratory findings submitted successfully.")

        # 4. Radiology Image Entry
        rad_queue = self.get_json(f"/hospital/radiology/scans?org_id={self.org_id}")
        if not rad_queue:
            req_payload = {
                "org_id": self.org_id,
                "patient_id": "PAT-TEST-101",
                "patient_name": "Test Patient",
                "imaging_type": "Chest X-Ray"
            }
            self.post_json("/hospital/radiology/scans", req_payload)
            rad_queue = self.get_json(f"/hospital/radiology/scans?org_id={self.org_id}")

        self.assertTrue(len(rad_queue) > 0)
        pending_scan = rad_queue[0]
        
        rad_update = {
            "org_id": self.org_id,
            "status": "COMPLETED",
            "report_details": "No active pulmonary infiltration seen on Chest X-Ray.",
            "image_pacs_url": "https://pacs.test-hosp.org/dicom/study-88901.png"
        }
        rad_res = self.put_json(f"/hospital/radiology/scans/{pending_scan['id']}", rad_update)
        self.assertEqual(rad_res["attributes"]["status"], "COMPLETED")
        print("Radiologist PACS diagnostic findings registered.")

    def test_03_financials_logistics(self):
        print("\n--- Running Financials and Logistics Tests ---")
        
        # 1. Create Invoice
        invoice_payload = {
            "org_id": self.org_id,
            "patient_id": "PAT-TEST-101",
            "patient_name": "Test Patient",
            "items": [{"desc": "Consultation Fee", "price": 5000.0}]
        }
        created_invoice = self.post_json("/hospital/billing/invoices", invoice_payload)
        self.assertIn("id", created_invoice)
        print("Invoice created successfully.")

        # 2. Billing invoices list
        invoices = self.get_json(f"/hospital/billing/invoices?org_id={self.org_id}")
        self.assertTrue(len(invoices) > 0)
        
        # Pay invoice
        pay_payload = {
            "org_id": self.org_id,
            "invoice_id": created_invoice["id"],
            "amount": 5000.0,
            "payment_method": "POS Card",
            "insurance_provider": "AXA Mansard Test"
        }
        pay_res = self.post_json("/hospital/billing/pay", pay_payload)
        self.assertEqual(pay_res["attributes"]["status"], "PAID")
        self.assertEqual(pay_res["attributes"]["balance"], 0.0)
        print("Cashier POS billing invoice paid and settled.")

        # 3. Ward Beds list and allocation
        beds = self.get_json(f"/hospital/wards/beds?org_id={self.org_id}")
        self.assertTrue(len(beds) > 0)
        vacant_bed = next(b for b in beds if b["attributes"]["status"] == "VACANT")
        
        alloc_payload = {
            "org_id": self.org_id,
            "bed_id": vacant_bed["id"],
            "patient_id": "PAT-TEST-101",
            "patient_name": "Test Patient Ward Admission"
        }
        alloc_res = self.post_json("/hospital/wards/beds", alloc_payload)
        self.assertEqual(alloc_res["attributes"]["status"], "OCCUPIED")
        print(f"Allocated bed {vacant_bed['attributes']['bed_number']} in {vacant_bed['attributes']['ward']}.")

        # 4. Emergency congestion check
        congestion = self.get_json(f"/hospital/emergency/congestion?org_id={self.org_id}")
        self.assertIn("er_occupancy", congestion)
        print("ER congestion index metrics parsed.")

        # 5. ICU Central Telemetry
        icu_monitor = self.get_json(f"/hospital/icu/monitoring?org_id={self.org_id}")
        self.assertTrue(len(icu_monitor) > 0)
        print(f"ICU Patient Vitals Feed check: {icu_monitor[0]['patient_name']} HR={icu_monitor[0]['heart_rate']}")

    def test_04_integrations(self):
        print("\n--- Running Interoperability Sync Tests (FHIR & HL7) ---")
        
        # 1. FHIR Sync Trigger
        fhir_payload = {
            "org_id": self.org_id,
            "resourceType": "Patient",
            "id": "FHIR-TEST-1120",
            "name": [{"given": ["John"], "family": "Doe"}],
            "telecom": [{"value": "+2348000000000"}]
        }
        fhir_res = self.post_json(f"/hospital/sync/fhir", fhir_payload)
        self.assertEqual(fhir_res["status"], "SUCCESS")
        print("FHIR Patient resource synced successfully.")

        # 2. HL7 Message Parse
        hl7_payload = {
            "org_id": self.org_id,
            "hl7": (
                "MSH|^~\\&|EPIC|ROSE_HOSPITAL|INTERAC_AI|LAGOOS|20260731||ADT^A08|MSG00001|P|2.5\n"
                "PID|1||PAT990141||Doe^John||19850615|M|||123 Main St^^Lagos\n"
                "PV1|1|O|Outpatient Unit||||DR_AMINAYUSUF"
            )
        }
        hl7_res = self.post_json("/hospital/sync/hl7", hl7_payload)
        self.assertEqual(hl7_res["status"], "SUCCESS")
        print("HL7 message segment parsed successfully and patient registered.")

if __name__ == "__main__":
    unittest.main()
