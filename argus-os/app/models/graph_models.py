from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Float, func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Entity(Base):
    """Database model representing a tracked entity (e.g. Person, Vehicle, License Plate, Camera, Zone)."""
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, index=True, nullable=False)  # person, vehicle, license_plate, camera, zone
    entity_identifier = Column(String, unique=True, index=True, nullable=False)  # unique string descriptor
    first_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    metadata_json = Column(JSON, name="metadata", nullable=True)
    risk_score = Column(Float, default=0.0, nullable=False)
    status = Column(String, default="active", nullable=False)  # active, flagged, alert

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    observations = relationship("Observation", back_populates="entity", cascade="all, delete-orphan")
    relationships_out = relationship("Relationship", foreign_keys="[Relationship.source_entity_id]", back_populates="source_entity", cascade="all, delete-orphan")
    relationships_in = relationship("Relationship", foreign_keys="[Relationship.target_entity_id]", back_populates="target_entity", cascade="all, delete-orphan")
    risk_assessments = relationship("RiskAssessment", back_populates="entity", cascade="all, delete-orphan")


class Observation(Base):
    """Database model representing a single sighting of an entity on a camera/event."""
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    metadata_json = Column(JSON, name="metadata", nullable=True)

    # Relationships
    entity = relationship("Entity", back_populates="observations")
    camera = relationship("Camera")
    event = relationship("Event")


class Relationship(Base):
    """Database model representing a relational link (edge) between two entities."""
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)
    source_entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    target_entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String, index=True, nullable=False)  # SEEN_AT, OBSERVED_BY, ASSOCIATED_WITH, INVOLVED_IN
    confidence_score = Column(Float, default=1.0, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    metadata_json = Column(JSON, name="metadata", nullable=True)

    # Relationships
    source_entity = relationship("Entity", foreign_keys=[source_entity_id], back_populates="relationships_out")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], back_populates="relationships_in")


class RiskAssessment(Base):
    """Database model representing a historical log of risk score assessments for an entity."""
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, default=0.0, nullable=False)
    contributing_factors = Column(JSON, nullable=True)  # List of objects: [{"factor": "intrusion", "points": 20, "timestamp": "..."}]
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    entity = relationship("Entity", back_populates="risk_assessments")
