import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph import Entity, Relationship, RiskAssessment
from app.models.observation import Observation

logger = logging.getLogger("app.services.graph_service")

class GraphService:
    """Enterprise Knowledge Graph builder service."""

    async def resolve_entity(
        self, db: AsyncSession, entity_type: str, identifier: str, metadata: Optional[Dict[str, Any]] = None, external_ref_id: Optional[str] = None
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
            if external_ref_id:
                entity.external_ref_id = external_ref_id
            if metadata:
                existing_meta = entity.metadata_json or {}
                # Merge metadata dicts safely
                entity.metadata_json = {**existing_meta, **metadata}
            db.add(entity)
            await db.commit()
            await db.refresh(entity)
            logger.info(f"Resolved existing graph entity: {entity_type}:{identifier} (ID: {entity.id})")
        else:
            # Create new entity
            entity = Entity(
                entity_type=entity_type,
                entity_identifier=identifier,
                first_seen=now,
                last_seen=now,
                metadata_json=metadata or {},
                risk_score=0.0,
                status="active",
                external_ref_id=external_ref_id
            )
            db.add(entity)
            await db.commit()
            await db.refresh(entity)
            logger.info(f"Created new graph entity: {entity_type}:{identifier} (ID: {entity.id})")

        return entity

    async def add_relationship(
        self, db: AsyncSession, source_entity_id: int, target_entity_id: int, relationship_type: str, confidence_score: float = 1.0, metadata: Optional[Dict[str, Any]] = None
    ) -> Relationship:
        """
        Creates or updates a relationship edge between two entities.
        """
        # Prevent self loops
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

    async def process_observation(self, db: AsyncSession, obs: Observation) -> None:
        """
        Enriches the Enterprise Knowledge Graph dynamically based on an incoming observation.
        """
        logger.info(f"Knowledge Graph processing observation {obs.id} ({obs.source_system}:{obs.entity_type})")
        
        # 1. Resolve Primary Entity
        # Maintain original string format if it is already a camera surveillance format, otherwise prefix it
        primary_identifier = f"{obs.entity_type}_{obs.entity_id}"
        if obs.entity_type in ["person", "vehicle", "license_plate", "camera", "zone"]:
            primary_identifier = obs.entity_id
            
        entity = await self.resolve_entity(
            db, 
            entity_type=obs.entity_type, 
            identifier=primary_identifier, 
            metadata=obs.metadata_json,
            external_ref_id=obs.entity_id
        )
        
        # 1.5 Update entity risk vector and assessments
        from app.services.risk_engine import risk_engine
        await risk_engine.update_entity_risk(db, entity, obs)
        
        # 1.6 Evaluate autonomous intelligence alerts & case escalations
        from app.services.autonomous_intel import autonomous_intel
        await autonomous_intel.evaluate_entity_state(db, entity)
        
        # 2. Resolve Location if present, and connect the entity (SEEN_AT / OBSERVED_AT)
        if obs.location:
            loc_id = f"location_{obs.location.lower().replace(' ', '_')}"
            loc_entity = await self.resolve_entity(
                db,
                entity_type="location",
                identifier=loc_id,
                metadata={"name": obs.location}
            )
            rel_type = "SEEN_AT" if obs.entity_type in ["person", "vehicle"] else "OBSERVED_AT"
            await self.add_relationship(db, entity.id, loc_entity.id, rel_type, obs.confidence)

        # 3. Process Relationships defined in observation metadata
        relationships_list = obs.relationships or []
        for rel_info in relationships_list:
            target_type = rel_info.get("target_type")
            target_id = rel_info.get("target_id")
            rel_type = rel_info.get("type")
            conf = rel_info.get("confidence", 1.0)
            meta = rel_info.get("metadata", {})
            
            if target_type and target_id and rel_type:
                target_identifier = f"{target_type}_{target_id}"
                if target_type in ["person", "vehicle", "license_plate", "camera", "zone"]:
                    target_identifier = target_id
                    
                target_entity = await self.resolve_entity(
                    db,
                    entity_type=target_type,
                    identifier=target_identifier,
                    external_ref_id=target_id
                )
                
                # Establish relationship
                await self.add_relationship(
                    db,
                    source_entity_id=entity.id,
                    target_entity_id=target_entity.id,
                    relationship_type=rel_type,
                    confidence_score=conf,
                    metadata=meta
                )

graph_service = GraphService()
