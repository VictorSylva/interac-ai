import asyncio
import logging
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
from sqlalchemy import select, or_, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.camera import Camera
from app.models.graph_models import Entity, Observation, Relationship, RiskAssessment

logger = logging.getLogger("app.services.graph_service")

class GraphService:
    """Security Graph and Risk Intelligence Engine."""

    async def resolve_entity(
        self, db: AsyncSession, entity_type: str, identifier: str, metadata: Optional[Dict[str, Any]] = None
    ) -> Entity:
        """
        Resolves an entity: finds it by unique identifier, or creates it if not found.
        Updates last_seen timestamp and merges metadata.
        """
        now = datetime.now(timezone.utc)
        
        # Check if entity exists
        query = select(Entity).filter(Entity.entity_identifier == identifier)
        result = await db.execute(query)
        entity = result.scalars().first()

        if entity:
            entity.last_seen = now
            if metadata:
                existing_meta = entity.metadata_json or {}
                # Merge metadata dictionaries
                entity.metadata_json = {**existing_meta, **metadata}
            db.add(entity)
            await db.commit()
            await db.refresh(entity)
            logger.info(f"Resolved existing entity: {entity_type}:{identifier} (ID: {entity.id})")
        else:
            # Create new entity
            entity = Entity(
                entity_type=entity_type,
                entity_identifier=identifier,
                first_seen=now,
                last_seen=now,
                metadata_json=metadata or {},
                risk_score=0.0,
                status="active"
            )
            db.add(entity)
            await db.commit()
            await db.refresh(entity)
            logger.info(f"Created new entity: {entity_type}:{identifier} (ID: {entity.id})")

        return entity

    async def add_observation(
        self, db: AsyncSession, entity_id: int, camera_id: Optional[int], event_id: Optional[int], metadata: Optional[Dict[str, Any]] = None
    ) -> Observation:
        """Stores a historical sighting/observation of an entity."""
        observation = Observation(
            entity_id=entity_id,
            camera_id=camera_id,
            event_id=event_id,
            metadata_json=metadata or {}
        )
        db.add(observation)
        await db.commit()
        await db.refresh(observation)
        return observation

    async def add_relationship(
        self, db: AsyncSession, source_entity_id: int, target_entity_id: int, relationship_type: str, confidence_score: float = 1.0, metadata: Optional[Dict[str, Any]] = None
    ) -> Relationship:
        """
        Creates or updates a relationship edge between two entities.
        """
        # Avoid self-loops
        if source_entity_id == target_entity_id:
            return None

        # Check if relationship already exists
        query = select(Relationship).filter(
            and_(
                Relationship.source_entity_id == source_entity_id,
                Relationship.target_entity_id == target_entity_id,
                Relationship.relationship_type == relationship_type
            )
        )
        result = await db.execute(query)
        rel = result.scalars().first()

        if rel:
            rel.confidence_score = max(rel.confidence_score, confidence_score)
            rel.timestamp = datetime.now(timezone.utc)
            if metadata:
                rel.metadata_json = {**(rel.metadata_json or {}), **metadata}
            db.add(rel)
            await db.commit()
            await db.refresh(rel)
        else:
            rel = Relationship(
                source_entity_id=source_entity_id,
                target_entity_id=target_entity_id,
                relationship_type=relationship_type,
                confidence_score=confidence_score,
                metadata_json=metadata or {}
            )
            db.add(rel)
            await db.commit()
            await db.refresh(rel)
            
        return rel

    def calculate_decayed_score(self, current_score: float, last_updated: datetime) -> float:
        """
        Applies exponential decay of 2% per hour on the risk score.
        Formula: decayed_score = score * (0.98 ** hours_elapsed)
        """
        now = datetime.now(timezone.utc)
        # Ensure timezone info
        if last_updated.tzinfo is None:
            last_updated = last_updated.replace(tzinfo=timezone.utc)
            
        elapsed_seconds = (now - last_updated).total_seconds()
        elapsed_hours = max(0.0, elapsed_seconds / 3600.0)
        
        decayed = current_score * math.pow(0.98, elapsed_hours)
        return round(decayed, 2)

    async def update_risk_score(
        self, db: AsyncSession, entity: Entity, added_points: float, factor: str
    ) -> float:
        """
        Decays the previous risk score and adds new points.
        Logs a new RiskAssessment record.
        """
        now = datetime.now(timezone.utc)
        
        # Get latest risk assessment
        query = (
            select(RiskAssessment)
            .filter(RiskAssessment.entity_id == entity.id)
            .order_by(desc(RiskAssessment.last_updated))
        )
        result = await db.execute(query)
        last_assessment = result.scalars().first()

        prev_score = 0.0
        factors = []
        last_updated = entity.first_seen

        if last_assessment:
            prev_score = last_assessment.score
            last_updated = last_assessment.last_updated
            factors = last_assessment.contributing_factors or []

        # 1. Decay the previous score
        decayed_score = self.calculate_decayed_score(prev_score, last_updated)
        
        # 2. Add the new score points
        new_score = round(decayed_score + added_points, 2)
        
        # 3. Add to contributing factors list
        factors.append({
            "factor": factor,
            "points": added_points,
            "timestamp": now.isoformat()
        })
        
        # Prune factors to keep last 20
        if len(factors) > 20:
            factors = factors[-20:]

        # Update entity properties
        entity.risk_score = new_score
        if new_score >= 40:
            entity.status = "alert"
        elif new_score >= 15:
            entity.status = "flagged"
        else:
            entity.status = "active"
            
        db.add(entity)

        # Create RiskAssessment record
        assessment = RiskAssessment(
            entity_id=entity.id,
            score=new_score,
            contributing_factors=factors,
            last_updated=now
        )
        db.add(assessment)
        await db.commit()
        await db.refresh(entity)
        
        logger.info(f"Updated risk score for {entity.entity_type}:{entity.entity_identifier} -> {new_score} (Factor: {factor})")
        return new_score

    async def process_event(self, db: AsyncSession, event: Event) -> None:
        """
        Processes an incoming surveillance event and constructs/updates the Security Graph.
        Called directly in the events POST endpoint.
        """
        logger.info(f"Security Graph processing event: ID {event.id}, Type: {event.event_type}")
        now = datetime.now(timezone.utc)
        
        # Fetch camera information
        camera_query = select(Camera).filter(Camera.id == event.camera_id)
        cam_res = await db.execute(camera_query)
        camera_obj = cam_res.scalars().first()
        camera_name = camera_obj.name if camera_obj else f"Camera #{event.camera_id}"
        camera_loc = camera_obj.location if camera_obj else "Unknown"

        # 1. Resolve Camera Entity
        camera_entity = await self.resolve_entity(
            db, 
            entity_type="camera", 
            identifier=f"camera_{event.camera_id}", 
            metadata={"name": camera_name, "location": camera_loc}
        )
        await self.add_observation(db, camera_entity.id, event.camera_id, event.id, {"status": "event_source"})

        # 2. Resolve Location Entity (if location is specified)
        location_entity = None
        if camera_loc and camera_loc != "Unknown":
            location_entity = await self.resolve_entity(
                db, 
                entity_type="location", 
                identifier=f"location_{camera_loc.lower().replace(' ', '_')}", 
                metadata={"name": camera_loc}
            )
            # Establish relation: Camera SEEN_AT Location
            await self.add_relationship(db, camera_entity.id, location_entity.id, "SEEN_AT", 1.0)

        # 3. Resolve Zone Entity (if this is an intrusion or loitering event)
        zone_entity = None
        if event.event_type in ["zone_intrusion_detected", "loitering_detected"]:
            zone_entity = await self.resolve_entity(
                db,
                entity_type="zone",
                identifier=f"zone_{event.camera_id}",
                metadata={"name": f"Restricted Zone - {camera_name}"}
            )
            # Link Zone and Camera
            await self.add_relationship(db, zone_entity.id, camera_entity.id, "LOCATED_ON", 1.0)
            if location_entity:
                await self.add_relationship(db, zone_entity.id, location_entity.id, "SEEN_AT", 1.0)

        # 4. Parse Detections and AI Metadata to resolve targets (Person, Vehicle, Plates)
        meta = event.ai_metadata or {}
        
        # Determine risk contribution points and description from event properties
        base_points = 10.0
        factor_desc = f"Observed in event {event.event_type}"
        
        if event.event_type == "zone_intrusion_detected":
            base_points = 20.0
            factor_desc = "Restricted zone intrusion"
        elif event.event_type == "loitering_detected":
            base_points = 15.0
            factor_desc = "Loitering behavior"
        elif event.event_type == "fire_detected" or "fire" in event.event_type:
            base_points = 25.0
            factor_desc = "Fire threat area presence"
        elif event.event_type == "speed_alert" or "speed" in event.event_type:
            base_points = 12.0
            factor_desc = "Excessive velocity"

        # Check Night-Time factor (+5 points)
        is_night = False
        event_time = event.timestamp
        if event_time:
            # Set timezone to UTC if native
            if event_time.tzinfo is None:
                event_time = event_time.replace(tzinfo=timezone.utc)
            # Using UTC hour for simple detection, or assume server time
            if event_time.hour >= 22 or event_time.hour < 5:
                is_night = True
                
        # Resolve License Plate first if present
        plate_entity = None
        plate_text = meta.get("plate_text")
        if plate_text:
            plate_entity = await self.resolve_entity(
                db,
                entity_type="license_plate",
                identifier=plate_text,
                metadata={"plate": plate_text}
            )
            await self.add_observation(db, plate_entity.id, event.camera_id, event.id, {"confidence": meta.get("plate_confidence", 1.0)})
            await self.add_relationship(db, plate_entity.id, camera_entity.id, "OBSERVED_BY", 1.0)
            if location_entity:
                await self.add_relationship(db, plate_entity.id, location_entity.id, "SEEN_AT", 1.0)
            
            # Apply risk update for license plate
            pts = base_points
            desc = factor_desc
            if is_night:
                pts += 5.0
                desc += " (Night-time)"
            await self.update_risk_score(db, plate_entity, pts, desc)

        # Resolve general intruders list
        intruders = meta.get("intruders", [])
        
        # If no explicit intruders list but event type points to a person/vehicle, simulate single target
        if not intruders and event.event_type in ["zone_intrusion_detected", "loitering_detected"]:
            # Fallback for mock events or simple alerts
            intruders = [{"class": "person", "track_id": 1, "confidence": 0.95}]

        for intruder in intruders:
            raw_class = intruder.get("class", "person")
            track_id = intruder.get("track_id", 1)
            conf = intruder.get("confidence", 1.0)
            box = intruder.get("box")

            # Standardize type to person or vehicle
            entity_type = "person"
            if raw_class in ["vehicle", "car", "truck", "bus", "motorcycle"]:
                entity_type = "vehicle"

            # Create unique tracking ID per camera stream
            identifier = f"{entity_type}_cam{event.camera_id}_t{track_id}"
            
            # Resolve target entity
            target_entity = await self.resolve_entity(
                db,
                entity_type=entity_type,
                identifier=identifier,
                metadata={"track_id": track_id, "camera_id": event.camera_id, "class": raw_class}
            )
            
            # Record observation
            await self.add_observation(db, target_entity.id, event.camera_id, event.id, {"box": box, "confidence": conf})

            # Create relationships
            await self.add_relationship(db, target_entity.id, camera_entity.id, "OBSERVED_BY", conf)
            if location_entity:
                await self.add_relationship(db, target_entity.id, location_entity.id, "SEEN_AT", conf)

            if zone_entity and event.event_type in ["zone_intrusion_detected", "loitering_detected"]:
                await self.add_relationship(db, target_entity.id, zone_entity.id, "INTRUDED", conf)

            # Link Vehicle to License Plate if both found
            if entity_type == "vehicle" and plate_entity:
                await self.add_relationship(db, target_entity.id, plate_entity.id, "ASSOCIATED_WITH", 1.0)

            # Calculate risk
            pts = base_points
            desc_str = factor_desc
            
            # Apply night bonus
            if is_night:
                pts += 5.0
                desc_str += " (Night-time)"
                
            # Apply multi-site bonus
            # Query number of unique cameras where this entity was observed
            obs_query = select(Observation.camera_id).filter(Observation.entity_id == target_entity.id).distinct()
            obs_res = await db.execute(obs_query)
            cameras_seen = obs_res.scalars().all()
            if len(cameras_seen) > 1:
                pts += 15.0
                desc_str += " (Multi-site presence)"

            # Update risk score
            await self.update_risk_score(db, target_entity, pts, desc_str)

        logger.info(f"Processed event {event.id} in Security Graph Engine.")

graph_service = GraphService()
