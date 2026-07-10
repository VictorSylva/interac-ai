from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
import logging
from services.token_service import token_service
from services.payment_service import initialize_paystack_transaction
import os
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

class BuyTokensRequest(BaseModel):
    business_id: str
    email: str
    amount_tokens: int # Number of tokens to buy (e.g., 5000)

@router.get("/balance")
async def get_balance(business_id: str):
    wallet = await token_service.get_wallet(business_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    # Mapping: 1 conversation = 500 tokens
    TOKENS_PER_CONVERSATION = 500
    
    # Get usage summary for current usage data
    usage = await token_service.get_usage_summary(business_id)
    
    total_balance = (wallet.sub_balance or 0) + (wallet.payg_balance or 0)
    
    return {
        "business_id": business_id,
        "subscription_balance": wallet.sub_balance,
        "payg_balance": wallet.payg_balance,
        "total_balance": total_balance,
        "conversations_remaining": total_balance // TOKENS_PER_CONVERSATION,
        "status": wallet.status,
        "usage": usage # Includes total_conversations, estimated_cost, estimated_profit
    }

@router.get("/history")
async def get_history(business_id: str, limit: int = 50):
    history = await token_service.get_transaction_history(business_id, limit=limit)
    return history

@router.post("/buy-tokens")
async def buy_tokens(req: BuyTokensRequest, request: Request):
    """Initializes a PAYG token purchase via Paystack."""
    
    # ₦5 per token (Example Pricing: ₦5,000 for 1,000 tokens)
    TOKEN_PRICE_NGN = 5 # 5 NGN per token
    total_price = req.amount_tokens * TOKEN_PRICE_NGN
    
    # Generate unique reference
    reference = f"PAYG_{req.amount_tokens}_{req.business_id[:8]}_{int(datetime.utcnow().timestamp())}"
    
    metadata = {
        "type": "payg_token_purchase",
        "business_id": req.business_id,
        "amount_tokens": req.amount_tokens,
        "payment_mode": "live" if os.getenv("PAYMENT_MODE") == "live" else "test"
    }

    from config import config
    origin = request.headers.get("origin")
    base_url = origin if origin else config.FRONTEND_URL
    callback_url = f"{base_url}/dashboard/subscription?status=success&type=token&ref={reference}"
    
    try:
        auth_url = await initialize_paystack_transaction(
            email=req.email,
            amount=total_price,
            reference=reference,
            callback_url=callback_url,
            metadata=metadata
        )
        
        if not auth_url:
            raise HTTPException(status_code=500, detail="Failed to initialize Paystack transaction")
            
        return {"status": "success", "authorization_url": auth_url, "reference": reference}
    except Exception as e:
        logger.error(f"Error initializing token purchase: {e}")
        raise HTTPException(status_code=500, detail=str(e))
