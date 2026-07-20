"""
InteracAI Dynamic Observation Model.
Normalizes all digital and physical platform signals into standard Observations.
"""

from sqlalchemy import Column, String, Float, DateTime, JSON, Text, ForeignKey
from sqlalchemy.sql import func
from ..base import Base



class ObservationV2(Base):
    __tablename__ = "observations_v2"

    id = Column(String(64), primary_key=True, index=True)
    org_id = Column(String(64), nullable=False, index=True)
    source_channel = Column(String(64), nullable=False, index=True)  # e.g., 'cctv_yolo', 'whatsapp', 'workflow', 'pos', 'sensor'
    observation_type = Column(String(64), nullable=False, index=True) # e.g., 'vehicle_intrusion', 'tax_filing', 'guest_checkin'
    primary_entity_id = Column(String(64), nullable=True, index=True)
    location_label = Column(String(128), nullable=True)
    payload = Column(JSON, nullable=False, default={})
    severity = Column(String(32), nullable=False, default="INFO")    # INFO | WARNING | CRITICAL
    confidence = Column(Float, default=1.0)
    risk_score_impact = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
