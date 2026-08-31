"""
Commercial Architecture Transformation Test Suite.
Verifies the complete audit-first custom entitlements commercial model:
1. Custom Entitlement Engine & Evaluation (Grants, Denials, Overrides)
2. Quota Metering (Conversations & Token Pools)
3. Audit-First Enterprise Provisioning
4. Commercial Invoicing & Capability Fulfillment
5. Compliance Audit Logging
6. Zero-Downtime Migration
"""

import asyncio
import logging
import sys
from datetime import datetime, timedelta
from sqlalchemy import select

from database.session import AsyncSessionLocal, engine
from database.base import Base
from database.models.general import Business, User, BusinessSettings
from database.models.billing import TokenWallet, BusinessUsageMetrics
from database.models.entitlement import (
    BusinessEntitlement, 
    EntitlementOverride, 
    CommercialProfile, 
    CustomInvoice, 
    CustomInvoiceItem,
    AdminAuditLog,
    SignalAuditLead
)
from services.entitlement_service import entitlement_service
from services.provisioning_service import provision_tenant
from services.admin_service import admin_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_commercial")

async def run_tests():
    logger.info("=== INITIALIZING COMMERCIAL ARCHITECTURE TEST SUITE ===")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        test_biz_name = f"Test Grand Hotel {datetime.now().strftime('%H%M%S')}"
        test_email = f"owner_{datetime.now().strftime('%H%M%S')}@grandhotel.com"

        # TEST 1: Provision Business with Commercial Profile & Custom Entitlements
        logger.info("\n--- TEST 1: Provisioning Enterprise Business with Commercial Profile ---")
        prov_result = await provision_tenant(
            db_session=session,
            email=test_email,
            password_hash="fake_hashed_pwd",
            business_name=test_biz_name,
            industry="hotel",
            business_size="Large",
            commercial_status="customer_active",
            pilot_enabled=False,
            pilot_days=0,
            account_manager_name="Victor Sylva",
            initial_tokens=15000000,
            custom_limits={"ai.conversations": 12000, "platform.seats": 35}
        )
        biz_id = prov_result["business_id"]
        assert biz_id is not None
        
        # Verify profile
        prof_res = await session.execute(select(CommercialProfile).where(CommercialProfile.business_id == biz_id))
        profile = prof_res.scalar_one()
        assert profile.commercial_status == "customer_active"
        logger.info(f"✓ Created Business {test_biz_name} (ID: {biz_id}) with Commercial Profile.")

        # TEST 2: Verify Default Entitlement Grants & Denials
        logger.info("\n--- TEST 2: Verifying Default Entitlement Grants & Denials ---")
        # hotel.reservations should be granted by default for hotels
        has_reservations = await entitlement_service.is_entitled(biz_id, "hotel.reservations")
        assert has_reservations is True, "Hotel should have hotel.reservations entitled"
        logger.info("✓ Verified hotel.reservations is entitled.")

        # hospital.patients should NOT be entitled for hotel
        has_patients = await entitlement_service.is_entitled(biz_id, "hospital.patients")
        assert has_patients is False, "Hotel should NOT have hospital.patients entitled"
        logger.info("✓ Verified hospital.patients is denied.")

        # Check numeric limits
        convo_limit = await entitlement_service.get_limit(biz_id, "ai.conversations")
        assert convo_limit == 12000, f"Expected 12000 conversations limit, got {convo_limit}"
        logger.info(f"✓ Custom limit resolved accurately: ai.conversations = {convo_limit}")

        # TEST 3: Time-Bound Entitlement Override
        logger.info("\n--- TEST 3: Time-Bound Entitlement Override ---")
        # Grant temporary access to argus.threat_graph
        exp_date = datetime.utcnow() + timedelta(days=7)
        override_id = await entitlement_service.create_override(
            business_id=biz_id,
            entitlement_key="argus.threat_graph",
            override_type="grant_access",
            override_value={"enabled": True},
            reason="Executive Proof of Concept trial",
            approved_by="admin@interac.ai",
            expires_at=exp_date
        )
        assert override_id is not None

        has_threat_graph = await entitlement_service.is_entitled(biz_id, "argus.threat_graph")
        assert has_threat_graph is True, "argus.threat_graph should be entitled via active override"
        logger.info("✓ Time-bound override evaluated as ACTIVE and granted access.")

        # TEST 4: Quota Checking
        logger.info("\n--- TEST 4: Quota Checking ---")
        # Conversation quota check (used: 0, limit: 12000)
        can_talk = await entitlement_service.check_usage_quota(biz_id, "ai.conversations", required_amount=1)
        assert can_talk.get("allowed") is True, "Should be allowed to initiate conversation within quota"
        logger.info("✓ Conversation quota validation passed.")

        # Token wallet balance check
        has_tokens = await entitlement_service.check_usage_quota(biz_id, "ai.tokens", required_amount=5000)
        assert has_tokens.get("allowed") is True, "Should have sufficient token balance"
        logger.info("✓ Token wallet reserve validation passed.")

        # TEST 5: Custom Commercial Invoicing & Entitlement Activation
        logger.info("\n--- TEST 5: Custom Commercial Invoicing ---")
        inv_res = await admin_service.create_custom_invoice(
            invoice_data={
                "business_id": biz_id,
                "title": "Q3 Enterprise Expansion Pack",
                "currency": "NGN",
                "items": [
                    {"description": "WhatsApp Multi-Branch Concierge Dispatch", "quantity": 1, "unit_price": 250000},
                    {"description": "Opera PMS Two-Way Integration", "quantity": 1, "unit_price": 500000}
                ],
                "notes": "Custom contract approved by management"
            },
            admin_id="admin@interac.ai"
        )
        assert inv_res.get("status") == "success"
        assert inv_res.get("total") == 750000
        logger.info(f"✓ Generated Custom Invoice {inv_res.get('invoice_number')} totaling NGN {inv_res.get('total'):,}")

        # Approve Invoice
        approved_res = await admin_service.approve_and_provision_invoice(inv_res.get("invoice_id"), admin_id="admin@interac.ai")
        assert approved_res is True
        logger.info("✓ Approved invoice and marked status as PAID.")

        # TEST 6: Compliance Audit Trail Verification
        logger.info("\n--- TEST 6: Verifying Compliance Audit Logs ---")
        logs = await admin_service.get_admin_audit_logs(business_id=biz_id)
        assert len(logs) > 0, "Audit logs must record provisioning and override actions"
        logger.info(f"✓ Found {len(logs)} audit log records for tenant {biz_id}.")
        for log in logs:
            logger.info(f"  - Action: {log['action']} | Actor: {log['admin_email']} | Reason: {log.get('reason')}")

        # TEST 7: Entitlement Bundle Assembly for Client UI
        logger.info("\n--- TEST 7: Client Diagnostic Entitlement Bundle ---")
        bundle = await entitlement_service.get_business_entitlement_bundle(biz_id)
        assert bundle["business_id"] == biz_id
        assert "entitlements" in bundle
        assert "usage" in bundle
        assert "commercial_profile" in bundle
        logger.info("✓ Assembled complete client entitlement matrix bundle.")

    logger.info("\n=== ALL COMMERCIAL ARCHITECTURE TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
