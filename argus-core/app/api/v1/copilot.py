from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from app.api import deps
from app.services.copilot_engine import copilot_engine

router = APIRouter()

class CopilotQuery(BaseModel):
    query: str = Field(..., description="The query/question to investigate")
    case_id: Optional[str] = Field(None, description="Optional Investigation Case ID to log reasoning traces to")

@router.post("/query", response_model=dict)
async def query_copilot(
    *,
    db: AsyncSession = Depends(deps.get_db),
    payload: CopilotQuery
) -> Any:
    """Trigger the Copilot ReAct reasoning loop to analyze and investigate an issue."""
    try:
        result = await copilot_engine.execute_query(db, query=payload.query, case_id=payload.case_id)
        return {"status": "success", "analysis": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Copilot reasoning failed: {str(e)}"
        )
