from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud.event import event_crud
from app.schemas.event import EventCreate, EventResponse
from app.websocket_manager import manager
from app.services.graph_service import graph_service

router = APIRouter()

@router.get("/", response_model=List[EventResponse])
async def list_events(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve all surveillance events."""
    events = await event_crud.get_multi(db, skip=skip, limit=limit)
    return events

@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: EventCreate,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Creates a new event, stores it, and broadcasts it in real-time to active WebSockets."""
    event = await event_crud.create(db, obj_in=obj_in)
    
    # Process event in Security Graph Engine
    try:
        await graph_service.process_event(db, event)
    except Exception as e:
        import logging
        logging.getLogger("app.api.events").error(f"Error processing event in Security Graph: {e}")
    
    # Structure serialization dictionary for WebSockets
    event_dict = {
        "id": event.id,
        "camera_id": event.camera_id,
        "event_type": event.event_type,
        "severity": event.severity,
        "timestamp": event.timestamp.isoformat(),
        "snapshot_path": event.snapshot_path,
        "video_clip_path": event.video_clip_path,
        "ai_metadata": event.ai_metadata,
        "is_resolved": event.is_resolved,
    }
    
    # Broadcast through Redis PubSub broker
    await manager.publish_event(event_dict)
    
    return event

@router.get("/unresolved", response_model=List[EventResponse])
async def list_unresolved_events(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve all active unresolved security threat alerts."""
    events = await event_crud.get_unresolved_events(db, skip=skip, limit=limit)
    return events

@router.get("/camera/{camera_id}", response_model=List[EventResponse])
async def list_events_by_camera(
    *,
    db: AsyncSession = Depends(deps.get_db),
    camera_id: int,
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve all events recorded by a specific camera."""
    events = await event_crud.get_by_camera(
        db, camera_id=camera_id, skip=skip, limit=limit
    )
    return events

@router.put("/{event_id}/resolve", response_model=EventResponse)
async def resolve_event(
    *,
    db: AsyncSession = Depends(deps.get_db),
    event_id: int,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Mark a security event/threat warning as resolved."""
    event = await event_crud.resolve_event(db, event_id=event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return event
