import asyncio
import os
import sys
import json
import urllib.request

# Resolve backend paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal as SessionLocal
from database.models.general import Business
from sqlalchemy import select

ARGUS_CORE_API = "http://argus_core:8003/api/v1"

async def seed_business():
    print("-> Connecting to database to seed default business...")
    async with SessionLocal() as session:
        # Check if default business exists
        stmt = select(Business).where(Business.id == "default")
        res = await session.execute(stmt)
        business = res.scalars().first()

        if not business:
            print("-> Default business 'default' not found. Seeding now...")
            business = Business(
                id="default",
                name="Victor's Enterprise Solutions",
                is_deleted=False
            )
            session.add(business)
            await session.commit()
            print("✅ Default business successfully seeded.")
        else:
            print("-> Default business 'default' already exists in DB.")

def post_observation(obs_data):
    url = f"{ARGUS_CORE_API}/observations/"
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(
        url, 
        data=json.dumps(obs_data).encode("utf-8"), 
        headers=headers, 
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode("utf-8"))
            print(f"✅ Ingested {obs_data['entity_type']}:{obs_data['entity_id']} - ID: {res.get('id')}")
            return res
    except Exception as e:
        print(f"❌ Failed to ingest observation: {e}")
        return None

def seed_graph_entities():
    print("\n-> Emitting observations to build graph entities...")
    
    customers = [
        {
            "id": "obs_cust_001",
            "source_system": "whatsapp",
            "entity_type": "customer",
            "entity_id": "customer_234803501111",
            "location": "Lagos HQ",
            "confidence": 1.0,
            "metadata": {"plan_interest": "starter", "status": "prospect"},
            "context": "Prospective customer Victor registered interest via chat config.",
            "severity": "info"
        },
        {
            "id": "obs_cust_002",
            "source_system": "whatsapp",
            "entity_type": "customer",
            "entity_id": "customer_234812342222",
            "location": "Abuja Branch",
            "confidence": 1.0,
            "metadata": {"plan_interest": "premium", "status": "prospect"},
            "context": "Prospective customer John requested subscription quotation.",
            "severity": "info"
        },
        {
            "id": "obs_cust_003",
            "source_system": "web",
            "entity_type": "customer",
            "entity_id": "customer_234855553333",
            "location": "Virtual Portal",
            "confidence": 1.0,
            "metadata": {"plan_interest": "payg", "status": "prospect"},
            "context": "Prospective customer Alice signed up for trial account.",
            "severity": "info"
        },
        {
            "id": "obs_lead_001",
            "source_system": "web",
            "entity_type": "lead",
            "entity_id": "lead_9876545555",
            "location": "Landing Page",
            "confidence": 0.95,
            "metadata": {"traffic_source": "google_ads", "converted": False},
            "context": "New prospective lead from web inquiry form submission.",
            "severity": "info"
        }
    ]

    for c in customers:
        post_observation(c)

async def main():
    await seed_business()
    seed_graph_entities()
    print("\n=============================================")
    print("        DEMO SEEDING COMPLETED               ")
    print("=============================================")

if __name__ == "__main__":
    asyncio.run(main())
