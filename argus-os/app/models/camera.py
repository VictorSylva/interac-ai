from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, func
from app.models.base import Base

class Camera(Base):
    """Database model representing a registered surveillance camera."""
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    rtsp_url = Column(String, nullable=False)
    location = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="offline", nullable=False)  # online, offline, error
    ptz_supported = Column(Boolean, default=False, nullable=False)
    zone_polygons = Column(JSON, nullable=True)  # List of coordinates [[x1, y1], [x2, y2], ...]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
