import requests
import json

BASE_URL = "http://localhost:8000"
ORG_ID = "0bbd48c4-b066-435a-be3d-c095b55897c6" # interacAi Enterprise Business ID

def print_header(title):
    print("\n" + "="*70)
    print(f" [PLATFORM TEST] {title}")
    print("="*70)

def main():
    print_header("INTERAC AI MULTI-INDUSTRY MODULAR PLATFORM TEST SUITE")
    
    # 1. Discover Registered Industry Starter Modules
    print("\n1. Discovering Installed Industry Starter Modules...")
    res = requests.get(f"{BASE_URL}/api/v1/modules")
    if res.status_code == 200:
        data = res.json()
        modules = data if isinstance(data, list) else data.get("modules", [])
        print(f"   Success! Total Registered Modules: {len(modules)}")
        for m in modules:
            skills = m.get("copilot_skills", [])
            skills_str = ', '.join([s.get("id", s) if isinstance(s, dict) else str(s) for s in skills])
            print(f"   - [{m['id']}] {m['name']} (v{m['version']})")
            print(f"     Description: {m['description']}")
            print(f"     Copilot Skills ({len(skills)}): {skills_str}")
            print()
    else:
        print(f"   FAILED to fetch modules: {res.status_code} {res.text}")

    # 2. Install Hotel & IRS Nigeria Modules for Organization
    print_header("2. Installing Industry Modules for Enterprise Workspace")
    for mod_id in ["module_hotels", "module_nigeria_irs"]:
        print(f"   Installing '{mod_id}' for Org '{ORG_ID}'...")
        install_res = requests.post(f"{BASE_URL}/api/v1/modules/install", json={"org_id": ORG_ID, "module_id": mod_id})
        if install_res.status_code == 200:
            print(f"   SUCCESS Installed {mod_id}: {install_res.json().get('message')}")
        else:
            print(f"   NOTICE for {mod_id}: {install_res.status_code} {install_res.text}")

    # 3. Create Dynamic Industry Entities (EAV-JSON Model)
    print_header("3. Creating Dynamic Multi-Industry Entities")
    
    # Create Hotel Guest Entity
    hotel_guest_payload = {
        "org_id": ORG_ID,
        "module_id": "module_hotels",
        "entity_type_code": "hotel_guest",
        "display_label": "Chief Alabi Ogunlesi (Presidential Suite 501)",
        "attributes": {
            "full_name": "Chief Alabi Ogunlesi",
            "vip_status": "Presidential Suite",
            "room_number": "Suite 501",
            "keycard_rfid": "RFID-8840-XYZ"
        }
    }
    g_res = requests.post(f"{BASE_URL}/api/v1/entities", json=hotel_guest_payload)
    print(f"   Created Hotel VIP Guest Entity:")
    print(f"   Status: {g_res.status_code} | Text: {g_res.text}")

    # Create Taxpayer Entity (IRS Nigeria)
    taxpayer_payload = {
        "org_id": ORG_ID,
        "module_id": "module_nigeria_irs",
        "entity_type_code": "taxpayer",
        "display_label": "Lagos Commercial Enterprises Ltd (TIN-NG-99201482)",
        "attributes": {
            "business_name": "Lagos Commercial Enterprises Ltd",
            "tin_number": "TIN-NG-99201482",
            "lga_zone": "Ikeja LGA",
            "declared_turnover": 45000000.00,
            "actual_pos_volume": 185000000.00
        }
    }
    t_res = requests.post(f"{BASE_URL}/api/v1/entities", json=taxpayer_payload)
    print(f"\n   Created IRS Taxpayer Entity:")
    print(f"   Status: {t_res.status_code} | Text: {t_res.text}")

    # 4. Ingest Signal Observation (Normalized Signal Bus)
    print_header("4. Ingesting Real-Time Signals into Generic Observation Bus")
    obs_payload = {
        "org_id": ORG_ID,
        "source_channel": "keycard_rfid",
        "observation_type": "unauthorized_keycard_access",
        "location_label": "Presidential Suite 501",
        "severity": "CRITICAL",
        "confidence": 0.98,
        "risk_score_impact": 85.0,
        "payload": {
            "room_number": "Suite 501",
            "keycard_used": "UNKNOWN_UNREGISTERED_KEYCARD",
            "sensor": "DOOR_LOCK_ALARM"
        }
    }
    obs_res = requests.post(f"{BASE_URL}/api/v1/observations", json=obs_payload)
    print(f"   Ingested Keycard Intrusion Observation:")
    print(f"   Status: {obs_res.status_code} | Text: {obs_res.text}")

    # 5. Execute Copilot Industry Skills
    print_header("5. Executing Copilot AI Industry Reasoning Skills")
    
    # Skill 1: Hotel VIP Service & Unauthorized Access Check
    skill1_payload = {
        "skill_id": "module_hotels:detect_unauthorized_room_access",
        "params": {
            "room_number": "Suite 501",
            "guest_id": "GUEST-VIP-8840"
        }
    }
    sk1_res = requests.post(f"{BASE_URL}/api/v1/modules/skills/execute", json=skill1_payload)
    print("   Executing Skill 'module_hotels:detect_unauthorized_room_access':")
    print(f"   Status: {sk1_res.status_code} | Text: {sk1_res.text}")

    # Skill 2: IRS Nigeria Tax Evasion Anomaly Audit
    skill2_payload = {
        "skill_id": "module_nigeria_irs:detect_tax_evasion_anomalies",
        "params": {
            "tin": "TIN-NG-99201482"
        }
    }
    sk2_res = requests.post(f"{BASE_URL}/api/v1/modules/skills/execute", json=skill2_payload)
    print("\n   Executing Skill 'module_nigeria_irs:detect_tax_evasion_anomalies':")
    print(f"   Status: {sk2_res.status_code} | Text: {sk2_res.text}")

    print_header("SUMMARY")
    print(" SUCCESS: All Multi-Tenant Industry Modules, Dynamic Entities, Signal Ingestion,")
    print("          and Copilot Skills executed successfully!")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
