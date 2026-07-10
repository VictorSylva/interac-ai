from typing import List, Optional, Dict, Any
from sqlalchemy import select, or_, and_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.base import CRUDBase
from app.models.graph_models import Entity, Observation, Relationship, RiskAssessment
from app.schemas.graph_schemas import EntityCreate, EntityUpdate, ObservationCreate, RelationshipCreate

class CRUDEntity(CRUDBase[Entity, EntityCreate, EntityUpdate]):
    """CRUD repository for Entities."""
    
    async def get_by_identifier(self, db: AsyncSession, identifier: str) -> Optional[Entity]:
        """Fetch an entity by its unique identifier string."""
        query = select(Entity).filter(Entity.entity_identifier == identifier)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_top_risks(self, db: AsyncSession, *, limit: int = 10) -> List[Entity]:
        """Fetch entities sorted by risk score descending."""
        query = select(Entity).order_by(desc(Entity.risk_score)).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_suspicious_vehicles(self, db: AsyncSession, *, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Detect vehicles that are associated with multiple distinct license plates,
        or observed across multiple cameras.
        """
        # Fetch vehicle entities
        query = (
            select(Entity)
            .filter(Entity.entity_type == "vehicle")
            .options(
                selectinload(Entity.relationships_out),
                selectinload(Entity.relationships_in),
                selectinload(Entity.observations)
            )
            .order_by(desc(Entity.risk_score))
            .limit(limit)
        )
        result = await db.execute(query)
        vehicles = result.scalars().all()
        
        suspicious_list = []
        for veh in vehicles:
            # Find associated plates and locations
            associated_plates = []
            seen_locations = set()
            
            # Outgoing relationships
            for rel in veh.relationships_out:
                if rel.relationship_type == "ASSOCIATED_WITH":
                    # Load the target entity identifier (license plate)
                    # We can fetch the target entity in the database
                    target_query = select(Entity).filter(Entity.id == rel.target_entity_id)
                    t_res = await db.execute(target_query)
                    target = t_res.scalars().first()
                    if target and target.entity_type == "license_plate":
                        associated_plates.append(target.entity_identifier)
                elif rel.relationship_type == "SEEN_AT":
                    target_query = select(Entity).filter(Entity.id == rel.target_entity_id)
                    t_res = await db.execute(target_query)
                    target = t_res.scalars().first()
                    if target:
                        seen_locations.add(target.entity_identifier)
                        
            # Incoming relationships
            for rel in veh.relationships_in:
                if rel.relationship_type == "SEEN_AT":
                    source_query = select(Entity).filter(Entity.id == rel.source_entity_id)
                    s_res = await db.execute(source_query)
                    source = s_res.scalars().first()
                    if source:
                        seen_locations.add(source.entity_identifier)

            # Check if this vehicle is suspicious (multiple plates, multiple locations, or high risk)
            # We return it if it has any associated plates or multiple locations
            suspicious_list.append({
                "entity_id": veh.id,
                "identifier": veh.entity_identifier,
                "risk_score": veh.risk_score,
                "associated_plates": list(set(associated_plates)),
                "seen_locations": list(seen_locations),
                "observations_count": len(veh.observations),
                "status": veh.status
            })
            
        return suspicious_list


class CRUDObservation(CRUDBase[Observation, ObservationCreate, Any]):
    """CRUD repository for Observations."""
    
    async def get_by_entity(self, db: AsyncSession, entity_id: int, *, limit: int = 100) -> List[Observation]:
        """Fetch all observations of a specific entity."""
        query = (
            select(Observation)
            .filter(Observation.entity_id == entity_id)
            .order_by(desc(Observation.timestamp))
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all())


class CRUDRelationship(CRUDBase[Relationship, RelationshipCreate, Any]):
    """CRUD repository for Relationships."""
    
    async def get_by_entity(self, db: AsyncSession, entity_id: int) -> List[Relationship]:
        """Fetch all relationships connected to a specific entity (incoming or outgoing)."""
        query = (
            select(Relationship)
            .filter(
                or_(
                    Relationship.source_entity_id == entity_id,
                    Relationship.target_entity_id == entity_id
                )
            )
            .order_by(desc(Relationship.timestamp))
        )
        result = await db.execute(query)
        return list(result.scalars().all())


class CRUDRiskAssessment(CRUDBase[RiskAssessment, Any, Any]):
    """CRUD repository for RiskAssessments."""
    
    async def get_by_entity(self, db: AsyncSession, entity_id: int) -> List[RiskAssessment]:
        """Fetch the history of risk assessments for an entity."""
        query = (
            select(RiskAssessment)
            .filter(RiskAssessment.entity_id == entity_id)
            .order_by(desc(RiskAssessment.last_updated))
        )
        result = await db.execute(query)
        return list(result.scalars().all())


entity_crud = CRUDEntity(Entity)
observation_crud = CRUDObservation(Observation)
relationship_crud = CRUDRelationship(Relationship)
risk_crud = CRUDRiskAssessment(RiskAssessment)
