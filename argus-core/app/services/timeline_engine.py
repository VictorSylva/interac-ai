import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.graph import Entity
from app.models.observation import Observation

logger = logging.getLogger("app.services.timeline_engine")

class TimelineEngine:
    """Reconstructs chronological operational timelines for entities."""

    async def get_entity_timeline(
        self, db: AsyncSession, identifier: str, include_associated: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Gathers observations associated with the target entity, optionally including
        timeline events for adjacent associated entities from the graph.
        """
        logger.info(f"Reconstructing timeline for: '{identifier}' (include_associated={include_associated})")
        
        # 1. Fetch primary entity with preloaded relationships
        stmt = (
            select(Entity)
            .filter(Entity.entity_identifier == identifier)
            .options(
                selectinload(Entity.relationships_out),
                selectinload(Entity.relationships_in)
            )
        )
        res = await db.execute(stmt)
        entity = res.scalars().first()
        
        if not entity:
            logger.warning(f"Entity '{identifier}' not found in Timeline Engine. Compiling raw observations search.")
            # Fallback to direct observations search using raw string match
            direct_stmt = select(Observation).where(
                or_(
                    Observation.entity_id == identifier,
                    Observation.entity_id == identifier.split("_")[-1] if "_" in identifier else False
                )
            ).order_by(desc(Observation.timestamp))
            obs_res = await db.execute(direct_stmt)
            observations = obs_res.scalars().all()
            return [self._format_timeline_item(o, identifier) for o in observations]

        # Gather target identifiers for query
        search_identifiers = [entity.entity_identifier]
        if entity.external_ref_id:
            search_identifiers.append(entity.external_ref_id)

        # 2. Gather associated target identifiers if requested
        if include_associated:
            # Query outgoing and incoming graph relationship nodes
            out_rels = entity.relationships_out
            in_rels = entity.relationships_in
            
            for rel in out_rels:
                target_ent = await db.get(Entity, rel.target_entity_id)
                if target_ent:
                    search_identifiers.append(target_ent.entity_identifier)
                    if target_ent.external_ref_id:
                        search_identifiers.append(target_ent.external_ref_id)
            
            for rel in in_rels:
                source_ent = await db.get(Entity, rel.source_entity_id)
                if source_ent:
                    search_identifiers.append(source_ent.entity_identifier)
                    if source_ent.external_ref_id:
                        search_identifiers.append(source_ent.external_ref_id)

        # Remove duplicate search terms
        search_identifiers = list(set(search_identifiers))

        # 3. Query all matching observations from database
        query = (
            select(Observation)
            .where(Observation.entity_id.in_(search_identifiers))
            .order_by(desc(Observation.timestamp))
            .limit(100)  # Safe cap
        )
        obs_res = await db.execute(query)
        observations = obs_res.scalars().all()

        # 4. Format and sort chronologically
        timeline_items = [self._format_timeline_item(obs, entity.entity_identifier) for obs in observations]
        
        # Sort items chronologically descending (newest first)
        timeline_items.sort(key=lambda x: x["timestamp"], reverse=True)
        return timeline_items

    def _format_timeline_item(self, obs: Observation, primary_identifier: str) -> Dict[str, Any]:
        """Utility to format an observation row into a standardized timeline item."""
        is_primary = (obs.entity_id == primary_identifier or 
                      f"{obs.entity_type}_{obs.entity_id}" == primary_identifier)
                      
        return {
            "timestamp": obs.timestamp.isoformat(),
            "observation_id": obs.id,
            "source_system": obs.source_system,
            "entity_type": obs.entity_type,
            "entity_id": obs.entity_id,
            "relationship_scope": "primary" if is_primary else "associated",
            "location": obs.location or "Unknown / Virtual",
            "severity": obs.severity,
            "confidence": obs.confidence,
            "description": obs.context or f"Telemetry captured for {obs.entity_type}:{obs.entity_id}",
            "metadata": obs.metadata_json or {},
            "evidence": obs.evidence or {}
        }

timeline_engine = TimelineEngine()
