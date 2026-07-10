from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Event(Base):
    """Database model representing a generated surveillance threat event/alert."""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(
        Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False
    )
    event_type = Column(String, index=True, nullable=False)  # person_detected, restricted_zone, etc.
    severity = Column(String, default="medium", nullable=False)  # low, medium, high, critical
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    snapshot_path = Column(String, nullable=True)
    video_clip_path = Column(String, nullable=True)
    ai_metadata = Column(JSON, nullable=True)  # JSON field for bounding boxes, confidences, tracking IDs
    is_resolved = Column(Boolean, default=False, nullable=False)

    # Establish relation back to Camera
    camera = relationship("Camera")
