"""
InteracAI Generic Observation Ingestion Service.
Processes digital and physical signals into normalized observations and syncs them with ARGUS OS.
"""

from typing import Dict, Any, Optional, List
import uuid
import logging
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.models.observation import ObservationV2
from database.models.dynamic_entity import EntityV2, EntityType


logger = logging.getLogger(__name__)


class ObservationService:
    @staticmethod
    def form_argus_relationships(db: Session, org_id: str, primary_entity_id: str) -> List[Dict[str, Any]]:
        """Forms standardized graph relationship edges for ARGUS OS."""
        if not primary_entity_id:
            return []
        
        relationships = []
        try:
            entity = db.query(EntityV2).filter(EntityV2.id == primary_entity_id, EntityV2.org_id == org_id).first()
            if not entity:
                return []
                
            # Fetch entity type code
            et_stmt = db.query(EntityType).filter(EntityType.id == entity.entity_type_id).first()
            if not et_stmt:
                return []
            entity_code = et_stmt.code
            
            # Case A: GUEST -> RESERVATION -> ROOM
            if entity_code == "hotel_guest":
                # Find reservations for this guest
                reservations = db.query(EntityV2).filter(
                    EntityV2.org_id == org_id,
                    EntityV2.attributes["guest_id"].as_string() == primary_entity_id
                ).all()
                for res in reservations:
                    relationships.append({"source": primary_entity_id, "target": res.id, "type": "HAS_RESERVATION"})
                    room_number = res.attributes.get("room_number")
                    if room_number:
                        room = db.query(EntityV2).filter(
                            EntityV2.org_id == org_id,
                            EntityV2.display_label == room_number
                        ).first()
                        if room:
                            relationships.append({"source": res.id, "target": room.id, "type": "ASSIGNED_ROOM"})
                            
            elif entity_code == "hotel_reservation":
                guest_id = entity.attributes.get("guest_id")
                if guest_id:
                    relationships.append({"source": guest_id, "target": primary_entity_id, "type": "HAS_RESERVATION"})
                room_number = entity.attributes.get("room_number")
                if room_number:
                    room = db.query(EntityV2).filter(
                        EntityV2.org_id == org_id,
                        EntityV2.display_label == room_number
                    ).first()
                    if room:
                        relationships.append({"source": primary_entity_id, "target": room.id, "type": "ASSIGNED_ROOM"})
                        
            # Case B: KEYCARD_LOG -> hotel_room -> hotel_reservation
            elif entity_code == "keycard_log":
                room_number = entity.attributes.get("room_number")
                if room_number:
                    room = db.query(EntityV2).filter(
                        EntityV2.org_id == org_id,
                        EntityV2.display_label == room_number
                    ).first()
                    if room:
                        relationships.append({"source": primary_entity_id, "target": room.id, "type": "ACCESS_EVENT_AT"})
                        
            # Case C: restaurant_order -> hotel_invoice -> hotel_reservation
            elif entity_code == "restaurant_order":
                folio_id = entity.attributes.get("folio_id")
                if folio_id:
                    relationships.append({"source": primary_entity_id, "target": folio_id, "type": "CHARGED_TO_FOLIO"})
                    
        except Exception as ex:
            logger.warning(f"Error compiling ARGUS relationships: {ex}")
            
        return relationships

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
            if hasattr(db, "query"):
                try:
                    entity = db.query(EntityV2).filter(EntityV2.id == primary_entity_id).first()
                    if entity:
                        entity.risk_score = max(0.0, float(entity.risk_score or 0.0) + risk_impact)
                except Exception as entity_err:
                    logger.debug(f"Risk score update skipped on async session: {entity_err}")

        # Synchronous commit if sync Session, otherwise handled by caller's await db.commit()
        if hasattr(db, "commit") and not hasattr(db, "sync_session"):
            try:
                db.commit()
                db.refresh(observation)
            except Exception:
                pass
        logger.info(f"Recorded observation '{observation_type}' from '{source_channel}' for Org '{org_id}'")
        
        # Async emit observation to central ARGUS Core
        try:
            relationships = ObservationService.form_argus_relationships(db, org_id, primary_entity_id)
            from services.argus_core_client import emit_observation
            
            loop = None
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                pass
                
            if loop and loop.is_running():
                loop.create_task(emit_observation(
                    source_system=source_channel,
                    entity_type=observation_type,
                    entity_id=obs_id,
                    location=location_label,
                    confidence=confidence,
                    metadata=payload,
                    relationships=relationships,
                    severity=severity.lower()
                ))
        except Exception as e:
            logger.warning(f"Failed to schedule ARGUS OS background emission: {e}")
            
        return observation


observation_service = ObservationService()
