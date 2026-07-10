from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud.graph_crud import entity_crud, observation_crud, relationship_crud, risk_crud
from app.schemas.graph_schemas import (
    EntityResponse, 
    ObservationResponse, 
    RelationshipDetailResponse, 
    RiskAssessmentResponse,
    EntityProfileResponse
)
from app.models.graph_models import Entity, Relationship

router = APIRouter()

@router.get("/", response_model=List[EntityResponse])
async def list_entities(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve all resolved security entities."""
    return await entity_crud.get_multi(db, skip=skip, limit=limit)

@router.get("/{entity_id}", response_model=EntityResponse)
async def read_entity(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_id: int,
) -> Any:
    """Get details of a single entity by ID."""
    entity = await entity_crud.get(db, id=entity_id)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found",
        )
    return entity

@router.get("/{entity_id}/profile", response_model=EntityProfileResponse)
async def read_entity_profile(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_id: int,
) -> Any:
    """Get the full intelligence profile of an entity including observations, relationships, and risk history."""
    entity = await entity_crud.get(db, id=entity_id)
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found")
        
    obs = await observation_crud.get_by_entity(db, entity_id=entity_id)
    raw_rels = await relationship_crud.get_by_entity(db, entity_id=entity_id)
    risk_hist = await risk_crud.get_by_entity(db, entity_id=entity_id)
    
    # Map raw relationships to detailed adjacency items
    detailed_rels = []
    for r in raw_rels:
        is_source = r.source_entity_id == entity_id
        target_id = r.target_entity_id if is_source else r.source_entity_id
        
        # Load details of target
        target_entity = await entity_crud.get(db, id=target_id)
        if not target_entity:
            continue
            
        detailed_rels.append({
            "id": r.id,
            "relationship_type": r.relationship_type,
            "confidence_score": r.confidence_score,
            "timestamp": r.timestamp,
            "metadata": r.metadata_json,
            "target_id": target_entity.id,
            "target_type": target_entity.entity_type,
            "target_identifier": target_entity.entity_identifier
        })
        
    return {
        "entity": entity,
        "observations": obs,
        "relationships": detailed_rels,
        "risk_history": risk_hist
    }

@router.get("/{entity_id}/observations", response_model=List[ObservationResponse])
async def read_entity_observations(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_id: int,
    limit: int = 100,
) -> Any:
    """Retrieve all observations/sightings of a specific entity."""
    return await observation_crud.get_by_entity(db, entity_id=entity_id, limit=limit)

@router.get("/{entity_id}/relationships", response_model=List[RelationshipDetailResponse])
async def read_entity_relationships(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_id: int,
) -> Any:
    """Retrieve all relationship links (edges) connected to this entity."""
    raw_rels = await relationship_crud.get_by_entity(db, entity_id=entity_id)
    detailed_rels = []
    for r in raw_rels:
        is_source = r.source_entity_id == entity_id
        target_id = r.target_entity_id if is_source else r.source_entity_id
        
        target_entity = await entity_crud.get(db, id=target_id)
        if not target_entity:
            continue
            
        detailed_rels.append({
            "id": r.id,
            "relationship_type": r.relationship_type,
            "confidence_score": r.confidence_score,
            "timestamp": r.timestamp,
            "metadata": r.metadata_json,
            "target_id": target_entity.id,
            "target_type": target_entity.entity_type,
            "target_identifier": target_entity.entity_identifier
        })
    return detailed_rels

@router.get("/{entity_id}/risk", response_model=List[RiskAssessmentResponse])
async def read_entity_risk(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_id: int,
) -> Any:
    """Retrieve the risk score history and assessments of this entity."""
    return await risk_crud.get_by_entity(db, entity_id=entity_id)
