from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base import Base

class BASession(Base):
    """Namespaced session for Behavioral Analytics."""
    __tablename__ = "ba_sessions"

    id = Column(String, primary_key=True) # UUID
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    
    visitor_id = Column(String, index=True) # ba_visitor_id
    referrer = Column(String)
    utm_source = Column(String)
    utm_medium = Column(String)
    utm_campaign = Column(String)
    
    device = Column(String)
    browser = Column(String)
    os = Column(String)
    country = Column(String)
    
    start_time = Column(DateTime, default=datetime.utcnow, index=True)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    
    is_bounce = Column(Boolean, default=True)
    page_views_count = Column(Integer, default=0)

    # Relationships
    business = relationship("Business")
    events = relationship("BAEvent", back_populates="session")

class BAEvent(Base):
    """Namespaced event for Behavioral Analytics."""
    __tablename__ = "ba_events"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    session_id = Column(String, ForeignKey("ba_sessions.id"), index=True)
    
    event_type = Column(String, index=True) # pageview, click, scroll, etc.
    path = Column(String)
    
    # Funnel Attribution tracking
    offer_id = Column(Integer, ForeignKey("sales_offers.id"), nullable=True, index=True)
    funnel_id = Column(String, nullable=True, index=True) # The unique ID corresponding to the funnel flow
    
    element_id = Column(String)
    element_class = Column(String)
    element_text = Column(String)
    
    properties = Column(JSON, default={})
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    session = relationship("BASession", back_populates="events")

class BAAggregate(Base):
    """Namespaced daily rollups for Behavioral Analytics."""
    __tablename__ = "ba_aggregates"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    date = Column(DateTime, index=True)
    
    metric_name = Column(String, index=True)
    metric_value = Column(Float)
    
    dimension_name = Column(String, nullable=True)
    dimension_value = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
