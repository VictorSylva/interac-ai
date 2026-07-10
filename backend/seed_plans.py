import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import SubscriptionPlan

async def seed_plans():
    plans = [
        {
            "id": "starter",
            "name": "Starter",
            "price": 60000.0,
            "token_allocation": 250000, # 500 * 500
            "conversation_limit": 500,
            "is_public": True,
            "requires_contact": False,
            "feature_flags": {f: True for f in ["whatsapp_bot", "web_chat", "advanced_workflows", "crm", "email", "analytics_basic", "analytics_full", "scheduling", "api_access"]},
            "limits": {
                "max_workflows": -1
            }
        },
        {
            "id": "growth",
            "name": "Growth",
            "price": 120000.0,
            "token_allocation": 1000000, # 2000 * 500
            "conversation_limit": 2000,
            "is_public": True,
            "requires_contact": False,
            "feature_flags": {f: True for f in ["whatsapp_bot", "web_chat", "advanced_workflows", "crm", "email", "analytics_basic", "analytics_full", "scheduling", "api_access"]},
            "limits": {
                "max_workflows": -1
            }
        },
        {
            "id": "pro",
            "name": "Pro",
            "price": 250000.0,
            "token_allocation": 5000000, # 10000 * 500
            "conversation_limit": 10000,
            "is_public": True,
            "requires_contact": False,
            "feature_flags": {f: True for f in ["whatsapp_bot", "web_chat", "advanced_workflows", "crm", "email", "analytics_basic", "analytics_full", "scheduling", "api_access"]},
            "limits": {
                "max_workflows": -1
            }
        },
        {
            "id": "enterprise",
            "name": "Enterprise",
            "price": None,
            "token_allocation": 100000000,
            "conversation_limit": -1,
            "is_public": False,
            "requires_contact": True,
            "feature_flags": {f: True for f in ["whatsapp_bot", "web_chat", "advanced_workflows", "crm", "email", "analytics_basic", "analytics_full", "scheduling", "api_access"]},
            "limits": {
                "max_workflows": -1,
                "max_ai_messages": -1
            }
        }
    ]

    async with AsyncSessionLocal() as session:
        for plan_data in plans:
            plan = await session.get(SubscriptionPlan, plan_data["id"])
            if not plan:
                plan = SubscriptionPlan(**plan_data)
                session.add(plan)
            else:
                for k, v in plan_data.items():
                    setattr(plan, k, v)
        
        await session.commit()
    print("Seed: Subscription plans initialized.")

if __name__ == "__main__":
    asyncio.run(seed_plans())
