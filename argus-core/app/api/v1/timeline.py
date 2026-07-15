from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.timeline_engine import timeline_engine

router = APIRouter()

@router.get("/{entity_identifier}", response_model=List[dict])
async def get_entity_timeline(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_identifier: str,
    include_associated: bool = Query(True, description="Whether to include timelines of adjacent graph entities")
) -> Any:
    """Retrieves unified chronological history logs of events, locations, and actions for an entity."""
    try:
        return await timeline_engine.get_entity_timeline(
            db, identifier=entity_identifier, include_associated=include_associated
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile timeline: {str(e)}"
        )
