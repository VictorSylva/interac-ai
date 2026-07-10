from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import logging
from services.token_service import token_service
from database.session import AsyncSessionLocal
from database.models.billing import TokenTransaction
from sqlalchemy import select, desc

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/summary")
async def get_usage_summary(business_id: str):
    """
    Returns a summary of token usage, conversation usage, cost, and profit.
    """
    summary = await token_service.get_usage_summary(business_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Usage data not found")
    return summary

@router.get("/conversations")
async def get_conversation_usage(business_id: str, limit: int = 50):
    """
    Returns a list of conversations with their token usage.
    """
    async with AsyncSessionLocal() as session:
        try:
            # Aggregate token usage per conversation from TokenTransaction
            # For now, we'll just return the recent transactions filtered by ai_inference
            # as a proxy for conversation token usage until we have a more explicit mapping.
            stmt = select(TokenTransaction).where(
                TokenTransaction.business_id == business_id,
                TokenTransaction.action_type == "ai_inference"
            ).order_by(desc(TokenTransaction.created_at)).limit(limit)
            
            result = await session.execute(stmt)
            transactions = result.scalars().all()
            
            return [{
                "id": t.id,
                "amount": t.amount,
                "token_pool": t.token_pool,
                "action_type": t.action_type,
                "metadata": t.transaction_metadata,
                "created_at": t.created_at
            } for t in transactions]
        except Exception as e:
            logger.error(f"Error fetching conversation usage: {e}")
            raise HTTPException(status_code=500, detail=str(e))
