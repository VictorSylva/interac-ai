from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.context_engine import context_engine

router = APIRouter()

@router.get("/{entity_identifier}", response_model=dict)
async def get_entity_context(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_identifier: str
) -> Any:
    """Retrieves compiled narrative context, timelines, relationships, and actions for a specific entity."""
    context = await context_engine.build_entity_context(db, identifier=entity_identifier)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity '{entity_identifier}' not found."
        )
    return context

@router.get("/{entity_identifier}/markdown", response_model=dict)
async def get_entity_markdown_context(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_identifier: str
) -> Any:
    """Retrieves compiled operational context, formatted as optimized Markdown for LLM consumption."""
    context = await context_engine.build_entity_context(db, identifier=entity_identifier)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity '{entity_identifier}' not found."
        )
    
    from app.services.timeline_engine import timeline_engine
    from app.services.ai_context_builder import ai_context_builder
    
    timeline = await timeline_engine.get_entity_timeline(db, identifier=entity_identifier, include_associated=True)
    markdown_doc = ai_context_builder.build_markdown_context(context, timeline)
    
    return {"entity_identifier": entity_identifier, "markdown": markdown_doc}
