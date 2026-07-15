from sqlalchemy import Column, DateTime, Float, JSON, Integer, String, Text, func
from app.models.base import Base

class Observation(Base):
    """Universal model representing any physical, business, or operational observation."""
    __tablename__ = "observations"

    id = Column(String, primary_key=True, index=True)  # Standard UUID or namespaced string (e.g. OBS_123)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    source_system = Column(String, nullable=False, index=True)  # "whatsapp", "email", "cameras", "payments", "workflows"
    entity_type = Column(String, nullable=False, index=True)  # "person", "vehicle", "license_plate", "customer", "employee", "invoice"
    entity_id = Column(String, nullable=False, index=True)  # ID of the entity in the source system
    location = Column(String, nullable=True, index=True)
    confidence = Column(Float, default=1.0, nullable=False)
    metadata_json = Column(JSON, name="metadata", nullable=True)  # Core telemetry payload
    evidence = Column(JSON, nullable=True)  # Links to clips, snapshots, chat logs, invoice details, etc.
    relationships = Column(JSON, nullable=True)  # List of related entities, e.g. [{"target_type": "vehicle", "target_id": "V1", "type": "ASSOCIATED_WITH"}]
    context = Column(Text, nullable=True)
    severity = Column(String, default="info", nullable=False, index=True)  # info, low, medium, high, critical
