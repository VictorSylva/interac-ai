from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base import Base

class Business(Base):
    __tablename__ = "businesses"

    id = Column(String, primary_key=True, index=True) # Manually assigned ID (e.g. 'demo')
    name = Column(String)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="business")
    settings = relationship("BusinessSettings", back_populates="business", uselist=False)
    knowledge_docs = relationship("KnowledgeDoc", back_populates="business")
    conversations = relationship("Conversation", back_populates="business")
    workflows = relationship("Workflow", back_populates="business")
    leads = relationship("Lead", back_populates="business")
    whatsapp_config = relationship("BusinessWhatsAppConfig", back_populates="business", uselist=False)
    email_config = relationship("BusinessEmailConfig", back_populates="business", uselist=False)
    activities = relationship("LeadActivity", back_populates="business")
    properties = relationship("Property", back_populates="business")
    roles = relationship("Role", back_populates="business")
    invitations = relationship("UserInvitation", back_populates="business")
    
    # Scheduling Relationships
    appointment_types = relationship("AppointmentType", back_populates="business")
    availability_rules = relationship("AvailabilityRule", back_populates="business")
    appointments = relationship("Appointment", back_populates="business")

    # Billing & Subscription Relationships
    subscription = relationship("BusinessSubscription", back_populates="business", uselist=False)
    token_wallet = relationship("TokenWallet", back_populates="business", uselist=False)
    token_transactions = relationship("TokenTransaction", back_populates="business")
    usage_metrics = relationship("BusinessUsageMetrics", back_populates="business", uselist=False)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    business_id = Column(String, ForeignKey("businesses.id"))
    email = Column(String, unique=True, index=True)
    password_hash = Column(String) # For SQL Auth
    role = Column(String, default="agent") # owner, agent
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    department = Column(String, nullable=True) # e.g. "sales", "support", "billing"
    property_id = Column(String, nullable=True) # Link to specific hotel property for multi-unit corporate hierarchy

    business = relationship("Business", back_populates="users")
    push_subscriptions = relationship("PushSubscription", back_populates="user")
    
    # Extended Enterprise Identity fields
    status = Column(String, default="active") # active, suspended, pending
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    role_id = Column(String, ForeignKey("roles.id"), nullable=True)
    department_id = Column(String, nullable=True)
    
    custom_role = relationship("Role", back_populates="users")

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    endpoint = Column(Text, unique=True)
    p256dh = Column(Text)
    auth = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="push_subscriptions")

class BusinessSettings(Base):
    """Stores profile, tone, etc."""
    __tablename__ = "business_settings"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), unique=True)
    
    industry = Column(String)
    description = Column(Text)
    services = Column(Text)
    tone = Column(String)
    faq = Column(Text)
    custom_instructions = Column(Text)
    location = Column(String)
    hours = Column(String)
    auto_escalate_on_keyword = Column(Boolean, default=False)
    departments = Column(JSON, default=lambda: ["sales", "support", "billing", "general"]) # Default departments
    installed_modules = Column(JSON, default=list) # Persisted list of active industry modules
    updated_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="settings")

class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"
    
    id = Column(String, primary_key=True) # UUID
    business_id = Column(String, ForeignKey("businesses.id"))
    type = Column(String) # file, url
    title = Column(String)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="knowledge_docs")

class BusinessWhatsAppConfig(Base):
    """Stores business-specific WhatsApp API credentials."""
    __tablename__ = "business_whatsapp_configs"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), unique=True)
    
    phone_number_id = Column(String)
    business_account_id = Column(String)
    app_id = Column(String)
    app_secret = Column(Text) # Encrypted
    access_token = Column(Text) # Encrypted
    
    webhook_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="whatsapp_config")

class BusinessEmailConfig(Base):
    """Stores business-specific Email API credentials (e.g. Resend)."""
    __tablename__ = "business_email_configs"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), unique=True)
    
    provider = Column(String, default="resend") # resend, smtp, postmark
    api_key = Column(Text, nullable=True) # Encrypted
    smtp_host = Column(String, nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_user = Column(String, nullable=True)
    smtp_password = Column(Text, nullable=True) # Encrypted
    
    from_email = Column(String, nullable=True)
    from_name = Column(String, nullable=True)
    reply_to = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="email_config")

class Property(Base):
    __tablename__ = "properties"
    
    id = Column(String, primary_key=True)
    business_id = Column(String, ForeignKey("businesses.id"))
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="properties")

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(String, primary_key=True)
    business_id = Column(String, ForeignKey("businesses.id"), nullable=True) # Null for system-wide roles
    name = Column(String)
    code = Column(String) # owner, receptionist, general_manager, security_officer, etc.
    permissions = Column(JSON, default=list) # List of permission strings
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="roles")
    users = relationship("User", back_populates="custom_role")

class UserInvitation(Base):
    __tablename__ = "user_invitations"
    
    id = Column(String, primary_key=True) # Token
    business_id = Column(String, ForeignKey("businesses.id"))
    email = Column(String, index=True)
    role = Column(String, default="agent") # Role code
    department = Column(String, default="general")
    property_id = Column(String, nullable=True)
    status = Column(String, default="pending") # pending, accepted, expired
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)

    business = relationship("Business", back_populates="invitations")

class LoginAuditLog(Base):
    __tablename__ = "login_audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    email = Column(String)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    status = Column(String) # success, failed
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
