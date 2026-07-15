from typing import Any, Dict, List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.observation import Observation
import uuid

class CRUDObservation:
    async def create(self, db: AsyncSession, *, obj_in: Dict[str, Any]) -> Observation:
        """Create a new observation record."""
        obs_id = obj_in.get("id") or f"obs_{uuid.uuid4().hex}"
        db_obj = Observation(
            id=obs_id,
            timestamp=obj_in.get("timestamp"),
            source_system=obj_in["source_system"],
            entity_type=obj_in["entity_type"],
            entity_id=str(obj_in["entity_id"]),
            location=obj_in.get("location"),
            confidence=obj_in.get("confidence", 1.0),
            metadata_json=obj_in.get("metadata", {}),
            evidence=obj_in.get("evidence", {}),
            relationships=obj_in.get("relationships", []),
            context=obj_in.get("context"),
            severity=obj_in.get("severity", "info")
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get(self, db: AsyncSession, id: str) -> Optional[Observation]:
        """Fetch a single observation by ID."""
        result = await db.execute(select(Observation).where(Observation.id == id))
        return result.scalars().first()

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[Observation]:
        """Retrieve multiple observation records sorted by newest timestamp."""
        stmt = select(Observation).order_by(desc(Observation.timestamp)).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_entity(
        self, db: AsyncSession, *, entity_type: str, entity_id: str, limit: int = 50
    ) -> List[Observation]:
        """Retrieve all observations associated with a specific entity type and ID."""
        stmt = (
            select(Observation)
            .where(Observation.entity_type == entity_type, Observation.entity_id == entity_id)
            .order_by(desc(Observation.timestamp))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

observation_crud = CRUDObservation()
