"""
InteracAI Generic Observation Ingestion Service.
Processes digital and physical signals into normalized observations and syncs them with ARGUS OS.
"""

from typing import Dict, Any, Optional
import uuid
import logging
from sqlalchemy.orm import Session

from database.models.observation import ObservationV2
from database.models.dynamic_entity import EntityV2


logger = logging.getLogger(__name__)


class ObservationService:
    @staticmethod
    def record_observation(
        db: Session,
        org_id: str,
        source_channel: str,
        observation_type: str,
        primary_entity_id: Optional[str] = None,
        location_label: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
        severity: str = "INFO",
        confidence: float = 1.0,
        risk_impact: float = 0.0
    ) -> ObservationV2:
        """Records a normalized observation in the database and updates related entity risk scores."""
        obs_id = f"obs_{uuid.uuid4().hex[:16]}"
        observation = ObservationV2(
            id=obs_id,
            org_id=org_id,
            source_channel=source_channel,
            observation_type=observation_type,
            primary_entity_id=primary_entity_id,
            location_label=location_label,
            payload=payload or {},
            severity=severity,
            confidence=confidence,
            risk_score_impact=risk_impact
        )
        db.add(observation)

        # Increment risk score on target entity if applicable
        if primary_entity_id and risk_impact != 0.0:
            entity = db.query(EntityV2).filter(EntityV2.id == primary_entity_id).first()
            if entity:
                entity.risk_score = max(0.0, float(entity.risk_score or 0.0) + risk_impact)

        db.commit()
        db.refresh(observation)
        logger.info(f"Recorded observation '{observation_type}' from '{source_channel}' for Org '{org_id}'")
        return observation


observation_service = ObservationService()
