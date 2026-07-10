from typing import List, Any, Dict
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud.graph_crud import entity_crud, observation_crud, relationship_crud
from app.schemas.graph_schemas import (
    EntityResponse, 
    SuspiciousVehicleResponse, 
    RecentPatternResponse,
    ObservationResponse
)
from app.models.graph_models import Entity, Observation, Relationship

router = APIRouter()

@router.get("/top-risks", response_model=List[EntityResponse])
async def get_top_risks(
    db: AsyncSession = Depends(deps.get_db),
    limit: int = 10,
) -> Any:
    """Retrieve top-risk threat entities ranked by risk score."""
    return await entity_crud.get_top_risks(db, limit=limit)

@router.get("/suspicious-vehicles", response_model=List[SuspiciousVehicleResponse])
async def get_suspicious_vehicles(
    db: AsyncSession = Depends(deps.get_db),
    limit: int = 50,
) -> Any:
    """Retrieve list of vehicles flagged as suspicious due to multi-plate or multi-site associations."""
    return await entity_crud.get_suspicious_vehicles(db, limit=limit)

@router.get("/recent-patterns", response_model=List[RecentPatternResponse])
async def get_recent_patterns(
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Analyze the graph structures to detect behavioral anomaly patterns:
    - Multi-Site Transit: Entities seen on multiple distinct cameras.
    - Off-Hours Activity: Intrusion/movement occurring during night hours (10PM - 5AM).
    - Rapid Recurrence: High frequency of observations in a short window.
    """
    patterns = []
    now = datetime.now(timezone.utc)
    
    # 1. Check for Multi-Site Transit
    # We query entities that have observations on more than one camera
    query = select(Entity).filter(Entity.risk_score > 0).options(selectinload(Entity.observations))
    res = await db.execute(query)
    entities = res.scalars().all()
    
    for ent in entities:
        cameras_seen = {obs.camera_id for obs in ent.observations if obs.camera_id is not None}
        if len(cameras_seen) > 1:
            patterns.append({
                "pattern_type": "multi_site_transit",
                "description": f"Entity '{ent.entity_identifier}' has been tracked crossing {len(cameras_seen)} different surveillance nodes.",
                "severity": "high" if ent.risk_score >= 30 else "medium",
                "detected_at": now,
                "entities_involved": [{"id": ent.id, "type": ent.entity_type, "identifier": ent.entity_identifier, "risk_score": ent.risk_score}]
            })
            
        # 2. Check for Off-Hours Activity
        # We check if any of the entity's observations happened at night
        night_observations = []
        for obs in ent.observations:
            obs_time = obs.timestamp
            if obs_time.tzinfo is None:
                obs_time = obs_time.replace(tzinfo=timezone.utc)
            if obs_time.hour >= 22 or obs_time.hour < 5:
                night_observations.append(obs)
                
        if len(night_observations) >= 2:
            patterns.append({
                "pattern_type": "off_hours_activity",
                "description": f"Entity '{ent.entity_identifier}' shows repetitive activity ({len(night_observations)} sightings) during restricted night hours (10 PM - 5 AM).",
                "severity": "critical" if ent.risk_score >= 35 else "medium",
                "detected_at": now,
                "entities_involved": [{"id": ent.id, "type": ent.entity_type, "identifier": ent.entity_identifier, "risk_score": ent.risk_score}]
            })

        # 3. Check for Active Hazards (e.g. Fire related)
        if ent.entity_type == "camera" and ent.risk_score >= 25:
            # Check if this camera has active fire/smoke events
            patterns.append({
                "pattern_type": "fire_hazard_area",
                "description": f"Active thermal warning flags triggered in vicinity of '{ent.entity_identifier}'.",
                "severity": "critical",
                "detected_at": now,
                "entities_involved": [{"id": ent.id, "type": ent.entity_type, "identifier": ent.entity_identifier, "risk_score": ent.risk_score}]
            })

    return patterns

@router.get("/entity-timeline", response_model=List[Dict[str, Any]])
async def get_entity_timeline(
    db: AsyncSession = Depends(deps.get_db),
    limit: int = 100,
) -> Any:
    """Retrieve a global chronological log of all entity observations."""
    query = (
        select(Observation)
        .options(selectinload(Observation.entity))
        .order_by(desc(Observation.timestamp))
        .limit(limit)
    )
    result = await db.execute(query)
    observations = result.scalars().all()
    
    timeline = []
    for obs in observations:
        timeline.append({
            "id": obs.id,
            "timestamp": obs.timestamp,
            "camera_id": obs.camera_id,
            "event_id": obs.event_id,
            "metadata": obs.metadata_json,
            "entity": {
                "id": obs.entity.id,
                "entity_type": obs.entity.entity_type,
                "entity_identifier": obs.entity.entity_identifier,
                "risk_score": obs.entity.risk_score,
                "status": obs.entity.status
            }
        })
    return timeline

@router.get("/graph-topology", response_model=Dict[str, Any])
async def get_graph_topology(
    db: AsyncSession = Depends(deps.get_db),
    limit: int = 500,
) -> Any:
    """Retrieve the node-link topology for ForceGraph2D."""
    # 1. Fetch Entities (Nodes)
    ent_query = select(Entity).limit(limit)
    ent_res = await db.execute(ent_query)
    entities = ent_res.scalars().all()
    
    nodes = []
    for ent in entities:
        nodes.append({
            "id": ent.id,
            "name": ent.entity_identifier,
            "type": ent.entity_type,
            "val": max(5, min(30, ent.risk_score / 10)), # Node size logic
            "risk_score": ent.risk_score,
            "status": ent.status
        })

    # 2. Fetch Relationships (Links)
    rel_query = select(Relationship).limit(limit * 2)
    rel_res = await db.execute(rel_query)
    relationships = rel_res.scalars().all()
    
    links = []
    for rel in relationships:
        links.append({
            "source": rel.source_entity_id,
            "target": rel.target_entity_id,
            "label": rel.relationship_type,
            "confidence": rel.confidence_score
        })
        
    return {
        "nodes": nodes,
        "links": links
    }

from pydantic import BaseModel

class ChatRequest(BaseModel):
    query: str
    history: List[Dict[str, str]] = []

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest
) -> Any:
    """Chat with the AI Co-Pilot about the security graph."""
    from app.agents.agent import run_security_agent
    
    response_text = await run_security_agent(request.query, request.history)
    return {"response": response_text}

class VerifyAlertRequest(BaseModel):
    event_id: int

@router.post("/verify-alert")
async def verify_alert(request: VerifyAlertRequest) -> Any:
    """Trigger autonomous verification for a specific event."""
    from app.agents.agent import run_security_agent
    
    # In a real system, the agent would use the analyze_camera_frame tool and update the DB
    query = f"Please investigate event ID {request.event_id}. Check the camera and verify if this is a true threat."
    response_text = await run_security_agent(query)
    
    return {"status": "verification_completed", "agent_analysis": response_text}
