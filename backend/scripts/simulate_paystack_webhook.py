import os
import sys
import hmac
import hashlib
import json
import httpx
import asyncio

# Resolve backend path for configuration loading
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import config

async def run_simulation():
    backend_url = os.getenv("BACKEND_URL")
    if not backend_url:
        if config.ENV == "staging":
            backend_url = "https://interacai-backend-staging.onrender.com"
        elif config.ENV == "production":
            backend_url = "https://api.interacai.com"
        else:
            backend_url = f"http://localhost:{os.getenv('PORT', '8000')}"
            
    print(f"============================================================")
    print(f"  INTERACAI PAYSTACK BILLING WEBHOOK SIMULATION TOOL        ")
    print(f"============================================================")
    print(f"Targeting Backend URL: {backend_url}")
    print(f"Active Environment:   {config.ENV.upper()}")
    
    secret_key = config.PAYSTACK_SECRET_KEY or "sk_test_dummy_key_for_local_dev"
    print(f"Using Secret Key:     {secret_key[:10]}...{secret_key[-4:] if len(secret_key) > 4 else ''}")

    # Use a dummy or real business email
    email = "mbasitisylva@gmail.com"
    business_id = "default"  # Will resolve inside backend to default business UUID
    plan_id = "starter"

    # Step 1: Initialize transaction via backend endpoint
    init_url = f"{backend_url}/api/subscriptions/initialize"
    print(f"\n[Step 1] Initializing subscription for plan '{plan_id}'...")
    
    init_payload = {
        "plan_id": plan_id,
        "business_id": business_id,
        "email": email
    }
    
    async with httpx.AsyncClient() as client:
        try:
            init_res = await client.post(init_url, json=init_payload)
        except Exception as e:
            print(f"❌ Error connecting to backend: {e}")
            print(f"💡 Ensure you have started the backend server (e.g. run uvicorn main:app in backend directory).")
            return
            
        if init_res.status_code != 200:
            print(f"❌ Initialization failed with status {init_res.status_code}: {init_res.text}")
            return
            
        init_data = init_res.json()
        reference = init_data.get("reference")
        auth_url = init_data.get("authorization_url")
        print(f"✅ Success! Reference generated: {reference}")
        print(f"Authorization URL (Redirect): {auth_url}")

        # Step 2: Construct Paystack Webhook payload
        print(f"\n[Step 2] Constructing charge.success webhook payload...")
        webhook_payload = {
            "event": "charge.success",
            "data": {
                "id": 123456789,
                "domain": "test",
                "status": "success",
                "reference": reference,
                "amount": 6000000,  # 60,000 NGN in kobo
                "gateway_response": "Successful",
                "paid_at": "2026-07-10T12:00:00.000Z",
                "created_at": "2026-07-10T11:59:00.000Z",
                "channel": "card",
                "currency": "NGN",
                "ip_address": "127.0.0.1",
                "metadata": {
                    "type": "platform_subscription",
                    "business_id": business_id,
                    "plan_id": plan_id,
                    "duration_days": 30
                },
                "customer": {
                    "id": 99999,
                    "first_name": "Test",
                    "last_name": "Customer",
                    "email": email,
                    "customer_code": "CUST_xxxxxx",
                    "phone": "08012345678",
                    "metadata": None,
                    "risk_action": "default"
                }
            }
        }
        
        payload_bytes = json.dumps(webhook_payload, separators=(',', ':')).encode('utf-8')

        # Step 3: Compute signature
        print(f"[Step 3] Computing HMAC SHA512 signature...")
        signature = hmac.new(
            key=secret_key.encode('utf-8'),
            msg=payload_bytes,
            digestmod=hashlib.sha512
        ).hexdigest()
        print(f"Generated Signature: {signature}")

        # Step 4: Dispatch simulated webhook
        webhook_url = f"{backend_url}/api/subscriptions/webhook"
        print(f"\n[Step 4] Dispatching simulated webhook to {webhook_url}...")
        
        headers = {
            "x-paystack-signature": signature,
            "Content-Type": "application/json"
        }
        
        webhook_res = await client.post(webhook_url, content=payload_bytes, headers=headers)
        
        if webhook_res.status_code == 200:
            print(f"✅ Success! Webhook processed. Response: {webhook_res.json()}")
            print(f"\n[Verification] Checking database state upgrade for business...")
            
            # Diagnose the business state upgrade
            check_url = f"{backend_url}/api/debug/business-id?business_id={business_id}"
            check_res = await client.get(check_url)
            if check_res.status_code == 200:
                diagnostics = check_res.json()
                print(f"  - Business Name: {diagnostics.get('business_name')}")
                print(f"  - Active Plan:   {diagnostics.get('plan')}")
                print(f"  - Status:        {diagnostics.get('status')}")
                if diagnostics.get("plan") == plan_id and diagnostics.get("status") == "active":
                    print(f"🎉 SUCCESS: Subsystem fulfilled correctly! Tokens refilled and plan active.")
                else:
                    print(f"⚠️ Warning: Webhook reported success but DB verification did not show plan/status upgrade. Double check celery queue or DB session logs.")
            else:
                print(f"Could not fetch diagnostics: {check_res.text}")
        else:
            print(f"❌ Webhook failed with status {webhook_res.status_code}: {webhook_res.text}")

if __name__ == "__main__":
    asyncio.run(run_simulation())
