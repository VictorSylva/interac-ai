from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, DateTime, UUID, text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..base import Base

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String, primary_key=True) # starter, growth, pro
    name = Column(String, nullable=False)
    price = Column(Float, nullable=True) # Enterprise is NULL
    token_allocation = Column(Integer, default=0)
    conversation_limit = Column(Integer, default=500)
    is_public = Column(Boolean, default=True)
    requires_contact = Column(Boolean, default=False)
    feature_flags = Column(JSON, default={})
    limits = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    subscriptions = relationship("BusinessSubscription", back_populates="plan")

class BusinessSubscription(Base):
    __tablename__ = "business_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), unique=True)
    plan_id = Column(String, ForeignKey("subscription_plans.id"))
    status = Column(String, default="active") # active, trialing, past_due, canceled
    conversations_used = Column(Integer, default=0)
    billing_cycle_anchor = Column(DateTime, default=datetime.utcnow)
    current_period_start = Column(DateTime, default=datetime.utcnow)
    current_period_end = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="subscription")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")

class TokenWallet(Base):
    __tablename__ = "token_wallets"

    business_id = Column(String, ForeignKey("businesses.id"), primary_key=True)
    sub_balance = Column(Integer, default=0) # Monthly allocation tokens (reset)
    payg_balance = Column(Integer, default=0) # Paid tokens (roll-over)
    status = Column(String, default="active") # active, frozen
    last_refill_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="token_wallet")

class TokenTransaction(Base):
    __tablename__ = "token_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    amount = Column(Integer, nullable=False) # Negative for usage, positive for refill
    token_pool = Column(String, nullable=False) # 'subscription' or 'payg'
    action_type = Column(String, nullable=False) # e.g., 'ai_inference', 'whatsapp_outbound', 'refill'
    transaction_metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="token_transactions")

class BusinessUsageMetrics(Base):
    __tablename__ = "business_usage_metrics"

    business_id = Column(String, ForeignKey("businesses.id"), primary_key=True)
    total_tokens_used = Column(Integer, default=0)
    total_conversations = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    estimated_profit = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="usage_metrics")

