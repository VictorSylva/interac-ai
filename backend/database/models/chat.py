from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, Text, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True) # User ID (e.g. phone number or cookie ID)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    
    customer_name = Column(String)
    platform = Column(String) # whatsapp, web, etc.
    mode = Column(String, default="ai") # ai, human
    assigned_agent_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="active") # active, waiting, closed
    last_message = Column(Text, nullable=True)
    last_timestamp = Column(DateTime, index=True) # Used as last_message_at
    last_message_at = Column(DateTime, default=datetime.utcnow)
    conversation_start_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    unread_count = Column(Integer, default=0)
    
    # Analytics Snapshot
    last_intent = Column(String)
    last_sentiment = Column(String)
    department = Column(String, nullable=True) # e.g. "sales", "support", "billing"

    # Canonical Omnichannel Extensions
    external_account_id = Column(String, nullable=True, index=True) # Phone ID / Page ID / IG Account ID
    external_user_id = Column(String, nullable=True, index=True)    # Phone / PSID / IGSID
    channel = Column(String, nullable=True, index=True)             # whatsapp, messenger, instagram, facebook_comment, instagram_comment, web
    channel_metadata = Column(JSON, default=dict)

    business = relationship("Business", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), index=True)
    
    text = Column(Text)
    sender = Column(String) # customer, agent, bot
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    platform = Column(String)
    status = Column(String, default="sent") # pending, sent, failed
    
    intent = Column(String)
    sentiment = Column(String)

    # Canonical Omnichannel Extensions
    external_message_id = Column(String, nullable=True, index=True) # wamid, mid, comment_id
    message_type = Column(String, default="text")                   # text, comment, private_reply, template, image
    channel = Column(String, nullable=True, index=True)
    source_post_id = Column(String, nullable=True, index=True)
    source_comment_id = Column(String, nullable=True, index=True)
    raw_metadata = Column(JSON, default=dict)

    conversation = relationship("Conversation", back_populates="messages")
