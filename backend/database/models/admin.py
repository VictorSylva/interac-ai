from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base import Base
import uuid

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False) # e.g., 'delete_business', 'credit_tokens'
    target_id = Column(String, nullable=True) # e.g., business_id or transaction_id
    details = Column(JSON, default={})
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    admin = relationship("User")

class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String, nullable=False) # 'whatsapp', 'paystack'
    event_type = Column(String, nullable=True)
    payload = Column(JSON)
    status_code = Column(Integer)
    response_body = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
