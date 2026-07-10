import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.token_service import token_service
from services.subscription_service import check_access, track_conversation
from services.feature_gate import feature_gate
from database.session import AsyncSessionLocal
from database.models.billing import BusinessUsageMetrics, TokenWallet
from sqlalchemy import select

async def test_billing_logic():
    business_id = "0bbd48c4-b066-435a-be3d-c095b55897c6"
    user_id = "test-user"
    
    print("--- Starting Billing Refactor Test ---")

    # 1. Test Conversation Tracking (24h window)
    print("\n[1] Testing Conversation Tracking...")
    # First message
    is_new = await track_conversation(business_id, user_id)
    print(f"First message (new window?): {is_new}")
    
    # Immediate second message (should be False)
    is_new_2 = await track_conversation(business_id, user_id)
    print(f"Immediate second message (new window?): {is_new_2}")

    # 2. Test Token Deduction & Metrics
    print("\n[2] Testing Token Deduction & Metrics...")
    # Get initial metrics
    summary_before = await token_service.get_usage_summary(business_id)
    print(f"Summary Before: {summary_before}")
    
    # Deduct tokens
    success = await token_service.deduct_tokens(business_id, 100, "test_action")
    print(f"Deduction Success: {success}")
    
    # Get updated metrics
    summary_after = await token_service.get_usage_summary(business_id)
    print(f"Summary After: {summary_after}")
    
    if summary_after and summary_before:
        if summary_after['total_tokens_used'] > summary_before['total_tokens_used']:
            print("SUCCESS: total_tokens_used incremented.")
        else:
            print("FAILURE: total_tokens_used did not increment.")

    # 3. Test Feature Gate
    print("\n[3] Testing Feature Gate...")
    has_access = await feature_gate.check_feature(business_id, "any_feature")
    print(f"Access to 'any_feature': {has_access}")
    
    can_create = await feature_gate.check_limit(business_id, "max_workflows", 1000)
    print(f"Can create 1001st workflow: {can_create}")

    print("\n--- Test Finished ---")

if __name__ == "__main__":
    asyncio.run(test_billing_logic())
