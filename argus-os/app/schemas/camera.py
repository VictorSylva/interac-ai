from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class CameraBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    rtsp_url: str = Field(..., description="RTSP connection stream URL")
    location: Optional[str] = Field(None, max_length=200)
    is_active: bool = True
    status: str = "offline"
    ptz_supported: bool = False
    zone_polygons: Optional[List[List[float]]] = Field(
        None, description="Normalized restricted zone coordinates [[x1, y1], [x2, y2], ...]"
    )

class CameraCreate(BaseModel):
    name: str = Field(..., min_length=1)
    rtsp_url: str
    location: Optional[str] = None
    ptz_supported: bool = False
    zone_polygons: Optional[List[List[float]]] = None

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    rtsp_url: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None
    ptz_supported: Optional[bool] = None
    zone_polygons: Optional[List[List[float]]] = None

class CameraResponse(CameraBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
