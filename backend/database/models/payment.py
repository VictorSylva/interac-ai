from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, DateTime, text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base import Base

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(String, primary_key=True) # UUID
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    reference = Column(String, unique=True, index=True)
    amount = Column(Float)
    currency = Column(String, default="NGN")
    status = Column(String) # pending, success, failed
    transaction_metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business")
