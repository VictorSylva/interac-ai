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

async def initialize_paystack_transaction(
    email: str, 
    amount: float, 
    reference: str, 
    callback_url: str = None, 
    metadata: dict = None,
    business_id: str = None
) -> str:
    """
    Initializes a Paystack transaction and returns the authorization URL.
    Supports multi-tenant Paystack subaccounts so customer funds settle
    directly to the merchant's bank account.
    """
    amount_minor = int(amount * 100)
    
    # 1. Handle DUMMY mode ONLY if explicitly configured
    if PAYMENT_MODE == "test" and SECRET_KEY == "sk_test_dummy_key_for_local_dev":
        logger.info(f"[Payment] SIMULATION: Initializing dummy transaction {reference}")
        if callback_url:
            sep = "&" if "?" in str(callback_url) else "?"
            return f"{callback_url}{sep}reference={reference}"
        return config.FRONTEND_URL + "/sales/success"

    # 2. Check for tenant-specific Paystack Subaccount
    subaccount_code = None
    if business_id:
        try:
            from database.session import AsyncSessionLocal
            from database.models.general import BusinessPaymentConfig
            from sqlalchemy.future import select
            from services.db_service import get_all_possible_business_ids

            possible_ids = await get_all_possible_business_ids(business_id)
            async with AsyncSessionLocal() as session:
                stmt = select(BusinessPaymentConfig).where(
                    BusinessPaymentConfig.business_id.in_(possible_ids),
                    BusinessPaymentConfig.is_active == True
                )
                res = await session.execute(stmt)
                p_cfg = res.scalars().first()
                if p_cfg and p_cfg.subaccount_code:
                    subaccount_code = p_cfg.subaccount_code
                    logger.info(f"[Payment] Attaching merchant subaccount {subaccount_code} ({p_cfg.bank_name}) to order {reference}")
        except Exception as sub_err:
            logger.warning(f"[Payment] Could not resolve subaccount for business {business_id}: {sub_err}")

    # 3. Real API Call
    url = "https://api.paystack.co/transaction/initialize"
    headers = {
        "Authorization": f"Bearer {SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "email": email,
        "amount": amount_minor,
        "reference": reference,
        "metadata": {
            **(metadata or {}), 
            "payment_mode": PAYMENT_MODE,
            "business_id": business_id,
            "subaccount_code": subaccount_code
        },
        "channels": ["card"]
    }
    
    if subaccount_code:
        payload["subaccount"] = subaccount_code
        payload["bearer"] = "subaccount" # Merchant receives settlement minus standard Paystack fee
    
    if callback_url:
        payload["callback_url"] = callback_url

    async with httpx.AsyncClient() as client:
        try:
            logger.info(f"[Payment] Initializing Paystack: {email} | Ref: {reference} | Amount: {amount} | Subaccount: {subaccount_code or 'Platform Default'}")
            logger.debug(f"[Payment] Payload: {payload}")
            
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            data = response.json()
            
            logger.info(f"[Payment] Paystack Response Status: {response.status_code}")
            
            if not data.get("status"):
                error_msg = data.get("message", "Payment gateway error")
                logger.error(f"[Payment] Paystack Error: {error_msg}")
                
                # If subaccount is invalid (e.g. test dummy account or pending verification),
                # retry via main account so checkout doesn't fail for the buyer
                if "subaccount" in error_msg.lower() and "subaccount" in payload:
                    logger.warning(f"[Payment] Subaccount {subaccount_code} rejected by Paystack: '{error_msg}'. Retrying with platform default gateway fallback.")
                    del payload["subaccount"]
                    if "bearer" in payload:
                        del payload["bearer"]
                    retry_res = await client.post(url, json=payload, headers=headers, timeout=10.0)
                    retry_data = retry_res.json()
                    if retry_data.get("status"):
                        logger.info(f"[Payment] Fallback checkout successful: {retry_data['data']['authorization_url'][:50]}...")
                        return retry_data["data"]["authorization_url"]

                raise Exception(f"Paystack Error: {error_msg}")
            
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

# ==============================================================================
# SUBACCOUNTS & NIGERIAN BANK RESOLUTION (MULTI-TENANT PAYMENTS)
# ==============================================================================

DEFAULT_NIGERIAN_BANKS = [
    {"name": "Access Bank", "code": "044"},
    {"name": "Citibank Nigeria", "code": "023"},
    {"name": "Ecobank Nigeria", "code": "050"},
    {"name": "Fidelity Bank", "code": "070"},
    {"name": "First Bank of Nigeria", "code": "011"},
    {"name": "First City Monument Bank (FCMB)", "code": "214"},
    {"name": "Guaranty Trust Bank (GTBank)", "code": "058"},
    {"name": "Heritage Bank", "code": "030"},
    {"name": "Jaiz Bank", "code": "301"},
    {"name": "Keystone Bank", "code": "082"},
    {"name": "Kuda Bank", "code": "50211"},
    {"name": "Moniepoint MFB", "code": "50515"},
    {"name": "OPay Digital Services", "code": "999992"},
    {"name": "PalmPay", "code": "999991"},
    {"name": "Polaris Bank", "code": "076"},
    {"name": "Providus Bank", "code": "101"},
    {"name": "Stanbic IBTC Bank", "code": "221"},
    {"name": "Standard Chartered Bank", "code": "068"},
    {"name": "Sterling Bank", "code": "232"},
    {"name": "Suntrust Bank", "code": "100"},
    {"name": "Taj Bank", "code": "302"},
    {"name": "Union Bank of Nigeria", "code": "032"},
    {"name": "United Bank for Africa (UBA)", "code": "033"},
    {"name": "Unity Bank", "code": "215"},
    {"name": "Wema Bank", "code": "035"},
    {"name": "Zenith Bank", "code": "057"}
]

async def list_paystack_banks() -> list:
    """Fetches supported Nigerian banks from Paystack with robust fallback."""
    url = "https://api.paystack.co/bank?country=nigeria"
    headers = {"Authorization": f"Bearer {SECRET_KEY}"}
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, timeout=8.0)
            if res.status_code == 200:
                data = res.json()
                if data.get("status") and data.get("data"):
                    banks = [
                        {"name": b.get("name"), "code": b.get("code")} 
                        for b in data.get("data") if b.get("active", True)
                    ]
                    # Sort alphabetically by bank name
                    return sorted(banks, key=lambda x: x["name"])
    except Exception as e:
        logger.warning(f"[Payment] Failed to query live Paystack banks: {e}. Using fallback bank list.")
        
    return sorted(DEFAULT_NIGERIAN_BANKS, key=lambda x: x["name"])

async def resolve_paystack_account(account_number: str, bank_code: str) -> dict:
    """Verifies a 10-digit NUBAN account number against Paystack NUBAN API."""
    url = f"https://api.paystack.co/bank/resolve?account_number={account_number}&bank_code={bank_code}"
    headers = {"Authorization": f"Bearer {SECRET_KEY}"}
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, timeout=10.0)
            data = res.json()
            if data.get("status") and data.get("data"):
                return {
                    "status": True,
                    "account_name": data["data"].get("account_name"),
                    "account_number": account_number,
                    "bank_code": bank_code
                }
            return {
                "status": False,
                "message": data.get("message", "Could not verify account details with bank")
            }
    except Exception as e:
        logger.error(f"[Payment] Account resolution error: {e}")
        # In test mode simulation:
        if PAYMENT_MODE == "test":
            return {
                "status": True,
                "account_name": "TEST VERIFIED MERCHANT",
                "account_number": account_number,
                "bank_code": bank_code
            }
        return {"status": False, "message": f"Bank resolution service error: {str(e)}"}

async def create_or_update_paystack_subaccount(
    business_id: str,
    business_name: str,
    bank_code: str,
    account_number: str,
    bank_name: str = None,
    account_name: str = None,
    percentage_charge: float = 0.0
) -> dict:
    """
    Creates or updates a Paystack Subaccount for a business, then persists it in database.
    Paystack auto-settles all payments tagged with this subaccount into this bank account.
    """
    import uuid
    from datetime import datetime
    from database.session import AsyncSessionLocal
    from database.models.general import BusinessPaymentConfig
    from sqlalchemy.future import select
    from services.db_service import resolve_business_id

    real_bid = await resolve_business_id(business_id)

    async with AsyncSessionLocal() as session:
        # Check existing config
        stmt = select(BusinessPaymentConfig).where(BusinessPaymentConfig.business_id == real_bid)
        res = await session.execute(stmt)
        config_obj = res.scalars().first()
        existing_subaccount = config_obj.subaccount_code if config_obj else None

    # Call Paystack API
    headers = {
        "Authorization": f"Bearer {SECRET_KEY}",
        "Content-Type": "application/json"
    }

    subaccount_code = existing_subaccount
    paystack_res_data = None

    try:
        async with httpx.AsyncClient() as client:
            if existing_subaccount:
                # Update existing subaccount on Paystack
                upd_url = f"https://api.paystack.co/subaccount/{existing_subaccount}"
                upd_payload = {
                    "settlement_bank": bank_code,
                    "account_number": account_number
                }
                upd_res = await client.put(upd_url, json=upd_payload, headers=headers, timeout=10.0)
                data = upd_res.json()
                if data.get("status"):
                    paystack_res_data = data.get("data")
                    subaccount_code = paystack_res_data.get("subaccount_code") or existing_subaccount
                else:
                    logger.warning(f"[Payment] Update subaccount returned: {data.get('message')}")
            else:
                # Create new subaccount on Paystack
                create_url = "https://api.paystack.co/subaccount"
                create_payload = {
                    "business_name": business_name,
                    "settlement_bank": bank_code,
                    "account_number": account_number,
                    "percentage_charge": float(percentage_charge),
                    "description": f"Subaccount for {business_name}"
                }
                c_res = await client.post(create_url, json=create_payload, headers=headers, timeout=10.0)
                data = c_res.json()
                if data.get("status") and data.get("data"):
                    paystack_res_data = data.get("data")
                    subaccount_code = paystack_res_data.get("subaccount_code")
                else:
                    error_msg = data.get("message", "Subaccount creation failed")
                    logger.warning(f"[Payment] Paystack subaccount creation warning: {error_msg}")
                    # If test key is used or Paystack test mode rejects the account:
                    if PAYMENT_MODE == "test":
                        subaccount_code = f"ACCT_TEST_{uuid.uuid4().hex[:10].upper()}"
                    else:
                        raise Exception(error_msg)
    except Exception as e:
        logger.error(f"[Payment] Subaccount API call exception: {e}")
        if PAYMENT_MODE == "test":
            subaccount_code = existing_subaccount or f"ACCT_TEST_{uuid.uuid4().hex[:10].upper()}"
        else:
            raise

    # Persist in database
    async with AsyncSessionLocal() as session:
        stmt = select(BusinessPaymentConfig).where(BusinessPaymentConfig.business_id == real_bid)
        res = await session.execute(stmt)
        config_obj = res.scalars().first()

        if not config_obj:
            config_obj = BusinessPaymentConfig(
                business_id=real_bid,
                provider="paystack",
                subaccount_code=subaccount_code,
                bank_name=bank_name,
                bank_code=bank_code,
                account_number=account_number,
                account_name=account_name,
                percentage_charge=float(percentage_charge),
                settlement_schedule="auto",
                is_active=True
            )
            session.add(config_obj)
        else:
            config_obj.subaccount_code = subaccount_code
            config_obj.bank_name = bank_name or config_obj.bank_name
            config_obj.bank_code = bank_code
            config_obj.account_number = account_number
            config_obj.account_name = account_name or config_obj.account_name
            config_obj.percentage_charge = float(percentage_charge)
            config_obj.is_active = True
            config_obj.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(config_obj)

        return {
            "status": "success",
            "business_id": real_bid,
            "subaccount_code": config_obj.subaccount_code,
            "bank_name": config_obj.bank_name,
            "bank_code": config_obj.bank_code,
            "account_number": config_obj.account_number,
            "account_name": config_obj.account_name,
            "percentage_charge": config_obj.percentage_charge,
            "is_active": config_obj.is_active
        }

async def get_business_payment_config(business_id: str) -> dict:
    """Retrieves the active payment / subaccount configuration for a business."""
    from database.session import AsyncSessionLocal
    from database.models.general import BusinessPaymentConfig
    from sqlalchemy.future import select
    from services.db_service import get_all_possible_business_ids

    possible_ids = await get_all_possible_business_ids(business_id)

    async with AsyncSessionLocal() as session:
        stmt = select(BusinessPaymentConfig).where(
            BusinessPaymentConfig.business_id.in_(possible_ids)
        )
        res = await session.execute(stmt)
        cfg = res.scalars().first()

        if not cfg:
            return {"configured": False, "is_active": False}

        return {
            "configured": bool(cfg.subaccount_code),
            "is_active": cfg.is_active,
            "provider": cfg.provider,
            "subaccount_code": cfg.subaccount_code,
            "bank_name": cfg.bank_name,
            "bank_code": cfg.bank_code,
            "account_number": cfg.account_number,
            "account_name": cfg.account_name,
            "percentage_charge": cfg.percentage_charge,
            "settlement_schedule": cfg.settlement_schedule
        }
