from typing import List, Any
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.crud.observation_crud import observation_crud
from app.schemas.observation_schemas import ObservationCreate, ObservationResponse
from app.core.redis import redis_client
from app.services.graph_service import graph_service

logger = logging.getLogger("app.api.v1.observations")
router = APIRouter()

@router.post("/", response_model=ObservationResponse, status_code=status.HTTP_201_CREATED)
async def create_observation(
    *,
    db: AsyncSession = Depends(deps.get_db),
    observation_in: ObservationCreate
) -> Any:
    """Submit a new standardized enterprise observation. Stores it in the database and broadcasts it via Redis PubSub."""
    try:
        # 1. Save observation in database
        obj_data = observation_in.model_dump()
        observation = await observation_crud.create(db, obj_in=obj_data)
        
        # 1.5 Process observation in Knowledge Graph
        await graph_service.process_observation(db, observation)
        
        # 1.6 Update World Model cached state
        from app.services.world_model import world_model
        await world_model.update_state(observation)
        
        # 1.7 Correlate and fuse observations in the Fusion Engine
        from app.services.fusion_engine import fusion_engine
        await fusion_engine.correlate(db, observation)
        
        # 2. Map response dictionary for redis broadcast
        serialized_data = {
            "id": observation.id,
            "timestamp": observation.timestamp.isoformat(),
            "source_system": observation.source_system,
            "entity_type": observation.entity_type,
            "entity_id": observation.entity_id,
            "location": observation.location,
            "confidence": observation.confidence,
            "metadata": observation.metadata_json or {},
            "evidence": observation.evidence or {},
            "relationships": observation.relationships or [],
            "context": observation.context,
            "severity": observation.severity
        }
        
        # 3. Publish to Redis Event Bus
        redis_payload = json.dumps({
            "event_type": "observation_created",
            "observation": serialized_data
        })
        
        await redis_client.publish("observation_bus", redis_payload)
        logger.info(f"Observation {observation.id} saved and published to event bus.")
        
        # Return DB object mapped by pydantic
        return observation
        
    except Exception as e:
        logger.error(f"Failed to ingest observation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Observation ingestion failed: {str(e)}"
        )

@router.get("/", response_model=List[ObservationResponse])
async def list_observations(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Retrieve the chronological log of all ingested observations."""
    return await observation_crud.get_multi(db, skip=skip, limit=limit)

@router.get("/{observation_id}", response_model=ObservationResponse)
async def read_observation(
    *,
    db: AsyncSession = Depends(deps.get_db),
    observation_id: str
) -> Any:
    """Fetch details of a single observation by ID."""
    observation = await observation_crud.get(db, id=observation_id)
    if not observation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation not found"
        )
    return observation

@router.get("/entity/{entity_type}/{entity_id}", response_model=List[ObservationResponse])
async def read_entity_observations(
    *,
    db: AsyncSession = Depends(deps.get_db),
    entity_type: str,
    entity_id: str,
    limit: int = 50
) -> Any:
    """Retrieve all observations/sightings matching a specific entity profile."""
    return await observation_crud.get_by_entity(db, entity_type=entity_type, entity_id=entity_id, limit=limit)
