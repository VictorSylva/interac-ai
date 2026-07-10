import json
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import SessionLocal
from app.models.graph_models import Entity, Relationship, Observation

async def get_top_risk_entities(limit: int = 5) -> str:
    """Get the current top high-risk entities in the security graph."""
    async with SessionLocal() as db:
        query = select(Entity).order_by(Entity.risk_score.desc()).limit(limit)
        result = await db.execute(query)
        entities = result.scalars().all()
        
        if not entities:
            return "No risk entities found."
            
        data = []
        for e in entities:
            data.append({
                "identifier": e.entity_identifier,
                "type": e.entity_type,
                "risk_score": e.risk_score,
                "status": e.status,
                "metadata": e.metadata_json
            })
        return json.dumps(data, indent=2)

async def get_entity_details(identifier: str) -> str:
    """Get the full profile and relationships of a specific entity by its identifier."""
    async with SessionLocal() as db:
        query = (
            select(Entity)
            .filter(Entity.entity_identifier == identifier)
            .options(
                selectinload(Entity.relationships_out),
                selectinload(Entity.relationships_in)
            )
        )
        result = await db.execute(query)
        entity = result.scalars().first()
        
        if not entity:
            return f"Entity '{identifier}' not found."
            
        # Compile relationships
        relationships = []
        for rel in entity.relationships_out:
            relationships.append(f"- {rel.relationship_type} -> Target ID: {rel.target_entity_id} (Confidence: {rel.confidence_score})")
        for rel in entity.relationships_in:
            relationships.append(f"- Source ID: {rel.source_entity_id} -> {rel.relationship_type} -> (This Entity)")
            
        data = {
            "identifier": entity.entity_identifier,
            "type": entity.entity_type,
            "risk_score": entity.risk_score,
            "status": entity.status,
            "first_seen": str(entity.first_seen),
            "last_seen": str(entity.last_seen),
            "relationships": relationships
        }
        return json.dumps(data, indent=2)

async def get_recent_events(limit: int = 10) -> str:
    """Get the most recent surveillance events/observations from cameras."""
    async with SessionLocal() as db:
        query = select(Observation).order_by(Observation.timestamp.desc()).limit(limit)
        result = await db.execute(query)
        observations = result.scalars().all()
        
        data = []
        for obs in observations:
            data.append({
                "id": obs.id,
                "timestamp": str(obs.timestamp),
                "camera_id": obs.camera_id,
                "metadata": obs.metadata_json
            })
        return json.dumps(data, indent=2)

# Dictionary of all available tools for the agent
AVAILABLE_TOOLS = {
    "get_top_risk_entities": get_top_risk_entities,
    "get_entity_details": get_entity_details,
    "get_recent_events": get_recent_events
}
