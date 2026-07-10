from fastapi import APIRouter
from config import config
from services.payment_service import PAYMENT_MODE

router = APIRouter()

@router.get("/api/public/config")
async def get_public_config():
    """
    Returns non-sensitive public configuration for the frontend.
    This replaces the need for hardcoded public keys.
    """
    return {
        "paystack_public_key": config.PAYSTACK_PUBLIC_KEY or "pk_test_dummy",
        "payment_mode": PAYMENT_MODE,
        "env": config.ENV
    }
