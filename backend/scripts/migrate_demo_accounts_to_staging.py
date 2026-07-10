import requests
import json
import time

STAGING_BASE_URL = "https://interacai-backend-staging.onrender.com"

DEMO_ACCOUNTS = [
    {
        "email": "vsylvanus54@gmail.com",
        "password": "Setecs@55",
        "business_name": "BrightSmile Dental Clinic",
        "profile": {
            "industry": "Dental",
            "tone": "Professional & Calm",
            "description": "BrightSmile Dental Clinic provides top-tier dental care, from routine checkups to urgent oral surgery. We prioritize patient comfort and rapid pain relief."
        }
    },
    {
        "email": "trudydavi@gmail.com",
        "password": "Setecs@55",
        "business_name": "Grand Luxe Hotel",
        "profile": {
            "industry": "Hotel",
            "tone": "Luxurious & Welcoming",
            "description": "Grand Luxe Hotel is a 5-star destination offering premium rooms, world-class dining, and exceptional guest services. Experience elegance in every stay."
        }
    },
    {
        "email": "intelligenceshalf@gmail.com",
        "password": "Setecs@55",
        "business_name": "PrimeNest Realty",
        "profile": {
            "industry": "Real Estate",
            "tone": "Ambitious & Informative",
            "description": "PrimeNest Realty specializes in luxury residential and commercial properties. We help high-budget investors and families find their dream locations."
        }
    }
]

def migrate():
    print(f"Starting migration to staging: {STAGING_BASE_URL}")
    
    for acc in DEMO_ACCOUNTS:
        print(f"\n--- Processing {acc['email']} ---")
        
        # 1. Register
        reg_url = f"{STAGING_BASE_URL}/api/auth/register"
        reg_payload = {
            "email": acc["email"],
            "password": acc["password"],
            "business_name": acc["business_name"],
            "industry": acc["profile"]["industry"],
            "demo_type": "standard"
        }
        
        business_id = None
        try:
            res = requests.post(reg_url, json=reg_payload, timeout=30)
            if res.status_code == 200:
                print(f"SUCCESS: Registered: {acc['email']}")
                data = res.json().get("data", {})
                business_id = data.get("business_id")
            else:
                print(f"INFO: Registration status {res.status_code}, attempting login...")
                login_url = f"{STAGING_BASE_URL}/api/auth/login"
                login_res = requests.post(login_url, json={"email": acc["email"], "password": acc["password"]}, timeout=30)
                if login_res.status_code == 200:
                    business_id = login_res.json()["user"]["business_id"]
                    print(f"SUCCESS: Logged in: {acc['email']} (ID: {business_id})")
                else:
                    print(f"ERROR: Could not resolve business for {acc['email']}: {login_res.text}")
                    continue
        except Exception as e:
            print(f"ERROR: Exception during auth for {acc['email']}: {e}")
            continue

        if not business_id:
            continue

        # 2. Update Profile
        profile_url = f"{STAGING_BASE_URL}/api/business-profile"
        profile_payload = acc["profile"].copy()
        profile_payload["business_id"] = business_id
        
        try:
            res = requests.post(profile_url, json=profile_payload, timeout=30)
            if res.status_code == 200:
                print(f"SUCCESS: Profile updated for {business_id}")
            else:
                print(f"WARNING: Profile update failed for {business_id}: {res.text}")
        except Exception as e:
            print(f"ERROR: Exception updating profile for {business_id}: {e}")

        print(f"INFO: Knowledge Base injection skipped for {acc['email']} (requires manual upload on staging).")

    print("\nDONE: Migration process completed.")

if __name__ == "__main__":
    migrate()
