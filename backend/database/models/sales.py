from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base import Base

class Offer(Base):
    __tablename__ = "sales_offers"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    
    title = Column(String, nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    delivery_type = Column(String) # file, link, consultation
    slug = Column(String, index=True) # for /:businessSlug/:offerSlug
    is_active = Column(Boolean, default=True)
    
    # Offer Intelligence Layer
    ai_metadata = Column(JSON, default=dict) # {target_audience, core_benefit, price_positioning}
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business")
    pages = relationship("SalesPage", back_populates="offer", uselist=False)
    orders = relationship("Order", back_populates="offer")

class SalesPage(Base):
    __tablename__ = "sales_pages"

    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("sales_offers.id"), unique=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    
    content = Column(JSON) # Template config mapping (colors, text blocks, images)
    assessment_template = Column(JSON, default=list) # Array of pre-qualification questions
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    offer = relationship("Offer", back_populates="pages")
    business = relationship("Business")

class Order(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    offer_id = Column(Integer, ForeignKey("sales_offers.id"))
    
    # Optional links to CRM
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=True)
    
    amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    status = Column(String, default="pending") # pending, paid, failed, refunded
    payment_mode = Column(String, default="test") # test, live
    
    paystack_reference = Column(String, unique=True, index=True)
    customer_email = Column(String) # Captured at checkout
    customer_phone = Column(String, nullable=True) # WhatsApp number
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    offer = relationship("Offer", back_populates="orders")
    business = relationship("Business")
    deliveries = relationship("Delivery", back_populates="order")

class Delivery(Base):
    __tablename__ = "sales_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"))
    
    type = Column(String) # file, link, consultation
    channel = Column(String) # email, whatsapp
    resource_url = Column(String, nullable=True) # Direct link or S3 url
    status = Column(String, default="pending") # pending, delivered, failed
    
    retry_count = Column(Integer, default=0)
    error_log = Column(Text, nullable=True)
    
    delivered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="deliveries")

class SalesWebhookLog(Base):
    __tablename__ = "sales_webhook_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, index=True) # For idempotency
    event_type = Column(String)
    payload = Column(JSON)
    
    processed_at = Column(DateTime, default=datetime.utcnow)
