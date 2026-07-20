"""
InteracAI Observation REST API Router.
Exposes endpoints for querying and ingesting observations across channels.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import logging

from database.session import get_db
from database.models.observation import ObservationV2
from services.observation_service import observation_service


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/observations", tags=["Observations Ingestion"])


@router.get("")
def list_observations(
    org_id: str = Query(..., description="Organization/Business ID"),
    source_channel: Optional[str] = Query(None, description="Filter by source channel e.g. 'whatsapp', 'cctv_yolo'"),
    observation_type: Optional[str] = Query(None, description="Filter by observation type"),
    severity: Optional[str] = Query(None, description="Filter by severity e.g. 'CRITICAL'"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """List observations recorded for an organization."""
    query = db.query(ObservationV2).filter(ObservationV2.org_id == org_id)

    if source_channel:
        query = query.filter(ObservationV2.source_channel == source_channel)
    if observation_type:
        query = query.filter(ObservationV2.observation_type == observation_type)
    if severity:
        query = query.filter(ObservationV2.severity == severity)

    total = query.count()
    items = query.order_by(ObservationV2.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("", status_code=status.HTTP_201_CREATED)
def record_observation(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Ingest a new observation payload."""
    org_id = payload.get("org_id")
    source_channel = payload.get("source_channel")
    observation_type = payload.get("observation_type")

    if not org_id or not source_channel or not observation_type:
        raise HTTPException(status_code=400, detail="Missing required parameters: 'org_id', 'source_channel', 'observation_type'")

    obs = observation_service.record_observation(
        db=db,
        org_id=org_id,
        source_channel=source_channel,
        observation_type=observation_type,
        primary_entity_id=payload.get("primary_entity_id"),
        location_label=payload.get("location_label"),
        payload=payload.get("payload", {}),
        severity=payload.get("severity", "INFO"),
        confidence=float(payload.get("confidence", 1.0)),
        risk_impact=float(payload.get("risk_score_impact", 0.0))
    )
    return obs
