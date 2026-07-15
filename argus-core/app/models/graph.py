from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Float, func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Entity(Base):
    """Database model representing any Enterprise or Surveillance entity (e.g. Person, Lead, Customer, Invoice, Camera)."""
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, index=True, nullable=False)  # person, vehicle, license_plate, camera, zone, location, employee, customer, visitor, asset, invoice, payment, workflow, task
    entity_identifier = Column(String, unique=True, index=True, nullable=False)  # unique string descriptor (e.g. "ABC-123", "emp_42")
    first_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    metadata_json = Column(JSON, name="metadata", nullable=True)
    risk_score = Column(Float, default=0.0, nullable=False)
    status = Column(String, default="active", nullable=False)  # active, flagged, alert
    
    # Direct reference to external SaaS records (e.g. user_id, lead_id, invoice_id)
    external_ref_id = Column(String, nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    relationships_out = relationship("Relationship", foreign_keys="[Relationship.source_entity_id]", back_populates="source_entity", cascade="all, delete-orphan")
    relationships_in = relationship("Relationship", foreign_keys="[Relationship.target_entity_id]", back_populates="target_entity", cascade="all, delete-orphan")
    risk_assessments = relationship("RiskAssessment", back_populates="entity", cascade="all, delete-orphan")


class Relationship(Base):
    """Database model representing a relational link (edge) between two entities."""
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)
    source_entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    target_entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String, index=True, nullable=False)  # WORKS_AT, OWNS, OBSERVED_AT, DETECTED_BY, VISITED, ASSIGNED_TO, PURCHASED, COMMUNICATED_WITH, TRIGGERED, LINKED_TO, INVESTIGATED, ESCALATED, RESOLVED
    confidence_score = Column(Float, default=1.0, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    metadata_json = Column(JSON, name="metadata", nullable=True)

    # Relationships
    source_entity = relationship("Entity", foreign_keys=[source_entity_id], back_populates="relationships_out")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], back_populates="relationships_in")


class RiskAssessment(Base):
    """Database model representing historical risk score log for an entity."""
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, default=0.0, nullable=False)
    contributing_factors = Column(JSON, nullable=True)  # List of objects: [{"factor": "intrusion", "points": 20, "timestamp": "..."}]
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    entity = relationship("Entity", back_populates="risk_assessments")
