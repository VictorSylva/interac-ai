from sqlalchemy import Column, DateTime, String, Text, JSON, func
from app.models.base import Base

class Investigation(Base):
    """Database model representing a structured investigation case."""
    __tablename__ = "investigations"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="open", nullable=False)  # open, in_progress, under_review, closed
    severity = Column(String, default="medium", nullable=False)  # low, medium, high, critical
    
    # Identifier of the primary graph entity being investigated (e.g., "customer_user42" or "person_id_5")
    entity_identifier = Column(String, index=True, nullable=False)
    
    assigned_to = Column(String, nullable=True)
    notes = Column(JSON, default=list, nullable=False)  # List of objects: [{"author": "...", "text": "...", "timestamp": "..."}]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
