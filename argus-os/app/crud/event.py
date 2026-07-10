from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.base import CRUDBase
from app.models.event import Event
from app.schemas.event import EventCreate, EventUpdate

class CRUDEvent(CRUDBase[Event, EventCreate, EventUpdate]):
    """Repository class managing Security Threat Events and Ingestion."""

    async def get_unresolved_events(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[Event]:
        """Fetch all events that are active/unresolved, ordered by newest."""
        query = (
            select(Event)
            .filter(Event.is_resolved == False)
            .order_by(Event.timestamp.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_by_camera(
        self, db: AsyncSession, *, camera_id: int, skip: int = 0, limit: int = 100
    ) -> List[Event]:
        """Fetch all events captured by a specific camera, ordered by newest."""
        query = (
            select(Event)
            .filter(Event.camera_id == camera_id)
            .order_by(Event.timestamp.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    async def resolve_event(self, db: AsyncSession, *, event_id: int) -> Optional[Event]:
        """Mark an alert/event as resolved."""
        event = await self.get(db, event_id)
        if event:
            event.is_resolved = True
            db.add(event)
            await db.commit()
            await db.refresh(event)
        return event

event_crud = CRUDEvent(Event)
