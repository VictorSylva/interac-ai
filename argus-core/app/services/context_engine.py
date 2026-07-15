import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph import Entity, Relationship, RiskAssessment
from app.models.observation import Observation
from app.services.world_model import world_model

logger = logging.getLogger("app.services.context_engine")

class ContextEngine:
    """Compiles sparse graph records into high-density context packages for AI reasoning."""

    async def build_entity_context(self, db: AsyncSession, identifier: str) -> Optional[Dict[str, Any]]:
        """
        Gathers graph data, World Model caches, and historical observations 
        to compile a unified context profile for a specific entity.
        """
        # 1. Fetch Entity with Relationships
        query = (
            select(Entity)
            .filter(Entity.entity_identifier == identifier)
            .options(
                selectinload(Entity.relationships_out),
                selectinload(Entity.relationships_in),
                selectinload(Entity.risk_assessments)
            )
        )
        result = await db.execute(query)
        entity = result.scalars().first()

        if not entity:
            logger.warning(f"Entity '{identifier}' not found in Context Engine.")
            return None

        # 2. Query World Model for real-time location
        current_location = await world_model.get_entity_location(entity.entity_type, entity.external_ref_id or entity.entity_identifier)

        # 3. Retrieve recent database observations
        obs_stmt = (
            select(Observation)
            .where(
                or_(
                    Observation.entity_id == entity.external_ref_id,
                    Observation.entity_id == entity.entity_identifier
                )
            )
            .order_by(desc(Observation.timestamp))
            .limit(10)
        )
        obs_res = await db.execute(obs_stmt)
        observations = obs_res.scalars().all()

        # 4. Map relationships to readable adjacent entities
        relationships = []
        associated_entities = []
        
        # Outgoing edges
        for rel in entity.relationships_out:
            target_ent = await db.get(Entity, rel.target_entity_id)
            if target_ent:
                relationships.append({
                    "relationship": rel.relationship_type,
                    "target_identifier": target_ent.entity_identifier,
                    "target_type": target_ent.entity_type,
                    "confidence": rel.confidence_score
                })
                associated_entities.append(f"{target_ent.entity_type}:{target_ent.entity_identifier}")

        # Incoming edges
        for rel in entity.relationships_in:
            source_ent = await db.get(Entity, rel.source_entity_id)
            if source_ent:
                relationships.append({
                    "relationship": f"INVERSE_{rel.relationship_type}",
                    "source_identifier": source_ent.entity_identifier,
                    "source_type": source_ent.entity_type,
                    "confidence": rel.confidence_score
                })
                associated_entities.append(f"{source_ent.entity_type}:{source_ent.entity_identifier}")

        # Remove duplicate associations
        associated_entities = list(set(associated_entities))

        # 5. Compile timeline history summary
        timeline_summary = []
        evidence_media = []
        for obs in observations:
            time_str = obs.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            loc_str = f" at {obs.location}" if obs.location else ""
            timeline_summary.append(
                f"[{time_str}] Observed in '{obs.source_system}'{loc_str} (Confidence: {obs.confidence:.2f}, Severity: {obs.severity})"
            )
            if obs.evidence:
                evidence_media.append(obs.evidence)

        # 6. Fetch dynamic risk assessments logs
        risk_history = []
        for assessment in sorted(entity.risk_assessments, key=lambda x: x.last_updated, reverse=True)[:5]:
            vector = {}
            if assessment.contributing_factors and len(assessment.contributing_factors) > 0:
                vector = assessment.contributing_factors[0].get("vector", {})
            risk_history.append({
                "score": assessment.score,
                "timestamp": assessment.last_updated.isoformat(),
                "factors": assessment.contributing_factors or [],
                "vector": vector
            })

        # 7. Deduce recommended actions based on risk status
        recommended_actions = []
        if entity.risk_score >= 40.0:
            recommended_actions = [
                "Restrict physical access credentials immediately",
                "Dispatch autonomous drone or security officer for visual patrol",
                "Escalate incident to supervisor and open a formal investigation case"
            ]
        elif entity.risk_score >= 15.0:
            recommended_actions = [
                "Flag entity for close observation",
                "Increase monitoring logging levels on adjacent sensors",
                "Cross-reference recent billing or digital session login footprints"
            ]
        else:
            recommended_actions = [
                "Monitor normal operations",
                "Maintain baseline entity observations cache"
            ]

        # 8. Return structured context block
        return {
            "entity_identifier": entity.entity_identifier,
            "entity_type": entity.entity_type,
            "risk_score": entity.risk_score,
            "status": entity.status,
            "current_location": current_location or "Unknown / Off-site",
            "known_relationships": relationships,
            "associated_entities": associated_entities,
            "recent_activity_log": timeline_summary,
            "evidence": evidence_media,
            "risk_history": risk_history,
            "recommended_actions": recommended_actions
        }

context_engine = ContextEngine()
