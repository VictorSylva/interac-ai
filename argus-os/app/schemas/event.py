from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel

class EventBase(BaseModel):
    camera_id: int
    event_type: str  # person_detected, restricted_zone, loitering, etc.
    severity: str = "medium"  # low, medium, high, critical
    snapshot_path: Optional[str] = None
    video_clip_path: Optional[str] = None
    ai_metadata: Optional[Dict[str, Any]] = None
    is_resolved: bool = False

class EventCreate(BaseModel):
    camera_id: int
    event_type: str
    severity: Optional[str] = "medium"
    snapshot_path: Optional[str] = None
    video_clip_path: Optional[str] = None
    ai_metadata: Optional[Dict[str, Any]] = None

class EventUpdate(BaseModel):
    is_resolved: Optional[bool] = None
    severity: Optional[str] = None
    ai_metadata: Optional[Dict[str, Any]] = None

class EventResponse(EventBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
