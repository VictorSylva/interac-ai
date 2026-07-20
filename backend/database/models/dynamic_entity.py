"""
InteracAI Dynamic Entity System Models (EAV-JSON Hybrid Schema).
Allows any Industry Module to define custom entity schemas dynamically without altering physical SQL database tables.
"""

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON, Text, UniqueConstraint
from sqlalchemy.sql import func
from ..base import Base



class EntityType(Base):
    __tablename__ = "entity_types"

    id = Column(String(64), primary_key=True, index=True)
    org_id = Column(String(64), nullable=False, index=True)
    module_id = Column(String(64), nullable=False, default="core") # e.g., 'module_retail', 'module_hotels'
    code = Column(String(64), nullable=False, index=True)          # e.g., 'vehicle', 'taxpayer'
    display_name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    schema_definition = Column(JSON, nullable=False, default={})   # Field definitions, validation rules, UI metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('org_id', 'code', name='unq_org_entity_type_code'),
    )


class EntityV2(Base):
    __tablename__ = "entities_v2"

    id = Column(String(64), primary_key=True, index=True)
    org_id = Column(String(64), nullable=False, index=True)
    entity_type_id = Column(String(64), ForeignKey("entity_types.id"), nullable=False, index=True)
    external_ref_id = Column(String(128), nullable=True, index=True) # Optional link to legacy table IDs (e.g. customer_id)
    display_label = Column(String(255), nullable=False, index=True)
    attributes = Column(JSON, nullable=False, default={})             # Custom field key-value pairs
    risk_score = Column(Float, default=0.0, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
