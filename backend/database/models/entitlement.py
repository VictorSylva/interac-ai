from sqlalchemy import Column, Integer, String, Float, BigInteger, ForeignKey, JSON, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..base import Base

class BusinessEntitlement(Base):
    """
    Core granular capability and quota record for a tenant.
    Independent of any fixed subscription tiers.
    """
    __tablename__ = "business_entitlements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    business_id = Column(String, ForeignKey("businesses.id"), index=True, nullable=False)
    entitlement_key = Column(String, index=True, nullable=False) # e.g. 'hotel.reservations', 'ai.conversations'
    entitlement_type = Column(String, default="boolean") # boolean, numeric, token, seat, resource, module, integration, time_bound
    enabled = Column(Boolean, default=True)
    numeric_limit = Column(BigInteger, nullable=True) # e.g. 5000, 10000000, -1 for unlimited
    unit = Column(String, nullable=True) # monthly_conversations, monthly_tokens, seats, cameras
    effective_from = Column(DateTime, default=datetime.utcnow)
    effective_until = Column(DateTime, nullable=True) # For time-bound pilots or features
    source = Column(String, default="custom_contract") # custom_contract, audit_quote, pilot, legacy_migration, admin_override
    notes = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    updated_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="entitlements")

class EntitlementOverride(Base):
    """
    Controlled, audited, time-bound overrides for enterprise clients or emergency break-glass.
    """
    __tablename__ = "entitlement_overrides"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    business_id = Column(String, ForeignKey("businesses.id"), index=True, nullable=False)
    entitlement_key = Column(String, nullable=False)
    override_type = Column(String, default="grant_access") # grant_access, limit_increase, emergency_break_glass
    override_value = Column(JSON, default={}) # {"enabled": true, "limit": 10000}
    reason = Column(Text, nullable=False)
    approved_by = Column(String, ForeignKey("users.id"), nullable=False)
    starts_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="entitlement_overrides")

class AdminAuditLog(Base):
    """
    Immutable compliance audit log for sensitive administrative actions.
    """
    __tablename__ = "admin_audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = Column(String, ForeignKey("users.id"), nullable=True)
    admin_email = Column(String, nullable=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True, nullable=True)
    action = Column(String, nullable=False) # entitlement.update, business.provision, override.create, etc.
    target_resource = Column(String, nullable=True)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CommercialProfile(Base):
    """
    Detailed enterprise customer profile and commercial operating parameters.
    """
    __tablename__ = "commercial_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    business_id = Column(String, ForeignKey("businesses.id"), unique=True, nullable=False)
    commercial_status = Column(String, default="prospect") # prospect, audit_scheduled, audit_completed, proposal_sent, pilot_active, pilot_expired, customer_active, suspended, churned
    billing_interval = Column(String, default="monthly") # monthly, quarterly, annual, pilot, one_time, custom_contract
    account_manager_id = Column(String, ForeignKey("users.id"), nullable=True)
    account_manager_name = Column(String, nullable=True)
    contract_reference = Column(String, nullable=True)
    
    # Audit & Sizing Metadata
    business_size = Column(String, default="Medium") # Small, Medium, Large, Enterprise
    num_employees = Column(Integer, default=0)
    num_branches = Column(Integer, default=1)
    num_rooms_or_units = Column(Integer, nullable=True)
    legacy_pms = Column(String, nullable=True)
    legacy_pos = Column(String, nullable=True)
    primary_communication = Column(String, default="WhatsApp")
    security_infrastructure = Column(String, nullable=True)

    # Pilot Configuration
    pilot_enabled = Column(Boolean, default=False)
    pilot_start_date = Column(DateTime, nullable=True)
    pilot_end_date = Column(DateTime, nullable=True)
    pilot_notes = Column(Text, nullable=True)

    # Commercial Terms
    implementation_fee = Column(Float, default=0.0)
    platform_fee = Column(Float, default=0.0)
    custom_integration_fee = Column(Float, default=0.0)
    currency = Column(String, default="NGN")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="commercial_profile")

class CustomInvoice(Base):
    """
    Custom negotiated invoice for audit-based enterprise contracts and pilot conversions.
    """
    __tablename__ = "custom_invoices"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    business_id = Column(String, ForeignKey("businesses.id"), index=True, nullable=False)
    invoice_number = Column(String, unique=True, nullable=False)
    title = Column(String, default="InteracAI Custom Operating System Agreement")
    currency = Column(String, default="NGN")
    total_amount = Column(Float, default=0.0)
    status = Column(String, default="draft") # draft, issued, paid, canceled, refunded
    issue_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    payment_reference = Column(String, nullable=True)
    entitlements_snapshot = Column(JSON, default={}) # Entitlements unlocked upon invoice fulfillment
    notes = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="custom_invoices")
    items = relationship("CustomInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")

class CustomInvoiceItem(Base):
    __tablename__ = "custom_invoice_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id = Column(String, ForeignKey("custom_invoices.id"), nullable=False)
    description = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)

    invoice = relationship("CustomInvoice", back_populates="items")

class SignalAuditLead(Base):
    """
    Inbound prospective business requesting a Signal Audit from the public landing page.
    """
    __tablename__ = "signal_audit_leads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    business_name = Column(String, nullable=False)
    contact_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    industry = Column(String, nullable=False)
    employee_count = Column(String, nullable=True)
    primary_challenges = Column(JSON, default=list) # e.g. ["customer_inquiries", "cctv_blindspots", "manual_scheduling"]
    current_systems = Column(String, nullable=True)
    audit_scope = Column(Text, nullable=True)
    status = Column(String, default="new") # new, contacted, audit_scheduled, proposal_sent, converted, dismissed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
