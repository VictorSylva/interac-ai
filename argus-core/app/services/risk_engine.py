import logging
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph import Entity, Relationship, RiskAssessment
from app.models.observation import Observation

logger = logging.getLogger("app.services.risk_engine")

class RiskEngine:
    """Multi-Dimensional Risk Vector and Dynamic Propagation Engine."""

    DEFAULT_VECTOR = {
        "physical": 0.0,
        "operational": 0.0,
        "financial": 0.0,
        "behavioral": 0.0,
        "fraud": 0.0,
        "compliance": 0.0,
        "cyber": 0.0,
        "safety": 0.0
    }

    def get_risk_vector(self, entity: Entity) -> Dict[str, float]:
        """Extracts or initializes the risk vector from the entity metadata."""
        meta = entity.metadata_json or {}
        vector = meta.get("risk_vector", {})
        
        # Ensure all dimensions exist
        return {k: float(vector.get(k, 0.0)) for k in self.DEFAULT_VECTOR}

    def calculate_decay(self, current_vector: Dict[str, float], last_updated: datetime) -> Dict[str, float]:
        """Applies 2% hourly exponential decay to all risk dimensions."""
        now = datetime.now(timezone.utc)
        if last_updated.tzinfo is None:
            last_updated = last_updated.replace(tzinfo=timezone.utc)

        hours_elapsed = max(0.0, (now - last_updated).total_seconds() / 3600.0)
        decay_factor = math.pow(0.98, hours_elapsed)

        return {k: round(v * decay_factor, 2) for k, v in current_vector.items()}

    async def update_entity_risk(
        self, db: AsyncSession, entity: Entity, obs: Observation
    ) -> float:
        """
        Updates an entity's risk vector based on a new observation,
        logs a RiskAssessment, and returns the aggregated score.
        """
        now = datetime.now(timezone.utc)
        
        # 1. Fetch risk vector and apply decay since last observation
        current_vector = self.get_risk_vector(entity)
        decayed_vector = self.calculate_decay(current_vector, entity.last_seen)

        # 2. Determine point additions based on severity and source
        points = 0.0
        if obs.severity == "critical":
            points = 30.0
        elif obs.severity == "high":
            points = 20.0
        elif obs.severity == "medium":
            points = 10.0
        elif obs.severity == "low":
            points = 5.0

        # Map source/observation to risk vector dimensions
        dimension = "operational"
        if obs.source_system == "cameras":
            dimension = "physical"
            if "loitering" in obs.severity or "intrusion" in obs.severity:
                decayed_vector["behavioral"] = min(100.0, decayed_vector["behavioral"] + (points * 0.5))
        elif obs.source_system == "payments":
            dimension = "financial"
            if obs.severity in ["high", "critical"]:
                decayed_vector["fraud"] = min(100.0, decayed_vector["fraud"] + (points * 0.8))
        elif obs.source_system == "workflows":
            dimension = "operational"
        elif "fire" in obs.entity_type or "smoke" in obs.entity_type or "safety" in obs.source_system:
            dimension = "safety"

        # Apply primary points
        decayed_vector[dimension] = min(100.0, decayed_vector[dimension] + points)

        # 3. Calculate aggregate risk score (max component for compatibility)
        aggregate_score = round(max(decayed_vector.values()), 2)

        # 4. Save risk vector in metadata
        entity.metadata_json = {**(entity.metadata_json or {}), "risk_vector": decayed_vector}
        entity.risk_score = aggregate_score

        # Update entity status bounds
        if aggregate_score >= 40.0:
            entity.status = "alert"
        elif aggregate_score >= 15.0:
            entity.status = "flagged"
        else:
            entity.status = "active"

        db.add(entity)

        # 5. Log RiskAssessment record
        factor = f"Observation severity '{obs.severity}' from system '{obs.source_system}'"
        assessment = RiskAssessment(
            entity_id=entity.id,
            score=aggregate_score,
            contributing_factors=[{
                "factor": factor,
                "points": points,
                "vector": decayed_vector,
                "timestamp": now.isoformat()
            }],
            last_updated=now
        )
        db.add(assessment)
        await db.commit()

        logger.info(f"Updated risk vector for {entity.entity_type}:{entity.entity_identifier} -> Aggregate Score: {aggregate_score}")
        
        # 6. Propagate risk to connected entities in the graph (guilt by association)
        await self.propagate_risk(db, entity, points, obs.source_system, depth=1)
        
        return aggregate_score

    async def propagate_risk(
        self, db: AsyncSession, entity: Entity, points: float, source_system: str, depth: int = 1
    ) -> None:
        """
        Propagates 10% of added risk points to adjacent entities in the graph (guilt by association).
        """
        if depth <= 0 or points <= 2.0:
            return

        propagated_points = round(points * 0.1, 2)
        logger.info(f"Propagating {propagated_points} risk points from entity ID {entity.id} (Depth: {depth})")

        # Query adjacent relationships asynchronously to avoid lazy-loading MissingGreenlet errors
        res_out = await db.execute(select(Relationship).filter(Relationship.source_entity_id == entity.id))
        out_rels = res_out.scalars().all()
        res_in = await db.execute(select(Relationship).filter(Relationship.target_entity_id == entity.id))
        in_rels = res_in.scalars().all()

        adjacent_ids = []
        for r in out_rels:
            adjacent_ids.append(r.target_entity_id)
        for r in in_rels:
            adjacent_ids.append(r.source_entity_id)

        adjacent_ids = list(set(adjacent_ids))

        for target_id in adjacent_ids:
            target_entity = await db.get(Entity, target_id)
            if target_entity:
                target_vector = self.get_risk_vector(target_entity)
                # Propagate to operational or physical depending on target type
                dim = "physical" if target_entity.entity_type in ["person", "vehicle", "license_plate"] else "operational"
                
                target_vector[dim] = min(100.0, target_vector[dim] + propagated_points)
                new_aggregate = round(max(target_vector.values()), 2)
                
                target_entity.metadata_json = {**(target_entity.metadata_json or {}), "risk_vector": target_vector}
                target_entity.risk_score = new_aggregate
                db.add(target_entity)

                # Log assessment
                assessment = RiskAssessment(
                    entity_id=target_entity.id,
                    score=new_aggregate,
                    contributing_factors=[{
                        "factor": f"Graph risk propagation from {entity.entity_type}:{entity.entity_identifier}",
                        "points": propagated_points,
                        "vector": target_vector,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }],
                    last_updated=datetime.now(timezone.utc)
                )
                db.add(assessment)
                await db.commit()

                # Recursive propagation to deeper hops
                await self.propagate_risk(db, target_entity, propagated_points, source_system, depth - 1)

risk_engine = RiskEngine()
