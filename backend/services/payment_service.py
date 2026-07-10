import logging
import httpx
import hmac
import hashlib
from config import config

logger = logging.getLogger(__name__)

# --- Configuration & Safety Guards ---
ENV = config.ENV.lower()
# Derived payment mode based on key prefix
is_live_key = config.PAYSTACK_SECRET_KEY.startswith("sk_live_") if config.PAYSTACK_SECRET_KEY else False
PAYMENT_MODE = "live" if is_live_key else "test"

SECRET_KEY = config.PAYSTACK_SECRET_KEY or "sk_test_dummy_key_for_local_dev"

def validate_payment_config():
    """
    Ensures that Test and Live environments are not mixed.
    Raises ValueError if a dangerous configuration is detected.
    """
    logger.info(f"[{ENV.upper()}] Payment Service Initialized | Mode: {PAYMENT_MODE.upper()}")
    
    if ENV == "production":
        if not is_live_key:
            logger.warning("!!! WARNING: Production environment running in TEST payment mode !!!")
    
    if ENV == "staging":
        if is_live_key:
            raise ValueError("SECURITY ERROR: STAGING environment MUST NOT use a LIVE Paystack key.")
        logger.info("[STAGING] Payment Service using TEST keys. Safe for demos.")
        
    if ENV == "development" and is_live_key:
        logger.warning("!!! WARNING: Development environment using a LIVE Paystack key. Be careful! !!!")

# Standard validation on import
try:
    validate_payment_config()
except ValueError as e:
    logger.critical(str(e))
    # In a real startup script we might sys.exit(1), but for now we log loudly

async def initialize_paystack_transaction(email: str, amount: float, reference: str, callback_url: str = None, metadata: dict = None) -> str:
    """
    Initializes a Paystack transaction and returns the authorization URL.
    """
    amount_minor = int(amount * 100)
    
    # 1. Handle DUMMY mode ONLY if explicitly configured
    if PAYMENT_MODE == "test" and SECRET_KEY == "sk_test_dummy_key_for_local_dev":
        logger.info(f"[Payment] SIMULATION: Initializing dummy transaction {reference}")
        if callback_url:
            sep = "&" if "?" in str(callback_url) else "?"
            return f"{callback_url}{sep}reference={reference}"
        return config.FRONTEND_URL + "/sales/success"

    # 2. Real API Call
    url = "https://api.paystack.co/transaction/initialize"
    headers = {
        "Authorization": f"Bearer {SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "email": email,
        "amount": amount_minor,
        "reference": reference,
        "metadata": {**(metadata or {}), "payment_mode": PAYMENT_MODE},
        "channels": ["card"]
    }
    
    if callback_url:
        payload["callback_url"] = callback_url

    async with httpx.AsyncClient() as client:
        try:
            logger.info(f"[Payment] Initializing Paystack: {email} | Ref: {reference} | Amount: {amount}")
            logger.debug(f"[Payment] Payload: {payload}")
            
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            data = response.json()
            
            logger.info(f"[Payment] Paystack Response Status: {response.status_code}")
            
            if not data.get("status"):
                logger.error(f"[Payment] Paystack Error: {data.get('message')}")
                raise Exception(f"Paystack Error: {data.get('message')}")
            
            logger.info(f"[Payment] Success: {data['data']['authorization_url'][:50]}...")
            return data["data"]["authorization_url"]
        except Exception as e:
            logger.error(f"[Payment] Initialization failed for {reference}: {e}")
            raise

def verify_paystack_webhook(payload: bytes, signature: str) -> bool:
    """Verifies HMAC SHA512 signature from Paystack Webhook."""
    if PAYMENT_MODE == "test" and SECRET_KEY == "sk_test_dummy_key_for_local_dev":
        return True
        
    expected_hmac = hmac.new(
        key=SECRET_KEY.encode('utf-8'),
        msg=payload,
        digestmod=hashlib.sha512
    ).hexdigest()
    
    return hmac.compare_digest(expected_hmac, signature)

async def verify_paystack_transaction(reference: str) -> dict:
    """
    Mandatory Backend Verification:
    Calls Paystack API to confirm the status of a transaction reference.
    """
    if PAYMENT_MODE == "test" and SECRET_KEY == "sk_test_dummy_key_for_local_dev":
        return {"status": True, "data": {"status": "success", "amount": 0}}

    url = f"https://api.paystack.co/transaction/verify/{reference}"
    headers = {"Authorization": f"Bearer {SECRET_KEY}"}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=10.0)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"[Payment] Verification failed for {reference}: {e}")
            return None
