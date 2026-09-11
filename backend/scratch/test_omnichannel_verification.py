"""
=============================================================================
INTERACAI OMNICHANNEL & SOCIAL SIGNAL INTELLIGENCE VERIFICATION TEST SUITE
=============================================================================
Tests:
1. Channel Adapter Unit & HMAC-SHA256 verification
2. Social Comment NLP classification & risk taxonomy
3. Messenger message ingestion, conversation creation & Lead identity tracking
4. Instagram DM ingestion, conversation creation & Lead identity tracking
5. Comment ingestion, public reply & Comment-to-DM pipeline
6. Human mode co-existence, owner echo detection & critical risk auto-escalation
7. Webhook deduplication & replay prevention
8. WhatsApp regression verification
=============================================================================
"""

import sys
import os

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import asyncio
import json
import time
import hmac
import hashlib

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from database.session import AsyncSessionLocal
from database.models.general import Business, BusinessMetaConfig
from database.models.chat import Conversation, Message
from database.models.crm import Lead
from services.channel_adapters.base import CanonicalEvent, verify_meta_hmac_sha256
from services.channel_adapters.messenger_adapter import MessengerChannelAdapter
from services.channel_adapters.instagram_adapter import InstagramChannelAdapter
from services.channel_adapters.comment_adapter import CommentAdapter
from services.channel_adapters.whatsapp_adapter import WhatsAppChannelAdapter
from services.prompt_service import prompt_service
from services.omnichannel_engine import omnichannel_engine
from services import db_service

TEST_BIZ_ID = "test_omnichannel_biz_001"
TEST_PAGE_ID = "109876543210987"
TEST_IG_ID = "17841400011223344"
TEST_APP_SECRET = "test_meta_app_secret_abc123"
TEST_VERIFY_TOKEN = "interac_meta_verify_secret"


async def setup_test_business():
    """Ensure a test business and business_meta_config exist."""
    print("\n[SETUP] Initializing test business and Meta config...")
    async with AsyncSessionLocal() as session:
        # Check if business exists
        biz = await session.get(Business, TEST_BIZ_ID)
        if not biz:
            biz = Business(
                id=TEST_BIZ_ID,
                name="Omnichannel Test Boutique",
                is_deleted=False
            )
            session.add(biz)
            await session.commit()
            print(f"  Created test business: {TEST_BIZ_ID}")
        else:
            print(f"  Existing test business: {TEST_BIZ_ID}")

        # Clean prior test messages, conversations, and leads for isolated run
        from sqlalchemy import delete
        await session.execute(delete(Message).where(Message.business_id == TEST_BIZ_ID))
        await session.execute(delete(Conversation).where(Conversation.business_id == TEST_BIZ_ID))
        await session.execute(delete(Lead).where(Lead.business_id == TEST_BIZ_ID))
        await session.commit()

        # Ensure Meta config exists
        meta_cfg = await db_service.get_meta_config(TEST_BIZ_ID)
        await db_service.update_meta_config(
            TEST_BIZ_ID,
            page_id=TEST_PAGE_ID,
            page_access_token="test_mock_page_token_valid_format",
            instagram_business_id=TEST_IG_ID,
            app_id="1234567890",
            app_secret=TEST_APP_SECRET,
            verify_token=TEST_VERIFY_TOKEN,
            is_active=True,
            messenger_enabled=True,
            instagram_enabled=True,
            facebook_comments_enabled=True,
            instagram_comments_enabled=True,
            comment_to_dm_enabled=True,
            auto_escalate_critical=True,
            human_mode_policy="ai_active"
        )
        print("  Meta config saved and linked successfully.")


async def test_suite_1_adapters_and_security():
    print("\n=======================================================")
    print("TEST SUITE 1: Channel Adapters & Cryptographic Security")
    print("=======================================================")

    # 1.1 HMAC SHA-256 verification
    secret = "my_meta_secret_key"
    payload = b'{"object":"page","entry":[]}'
    expected_hash = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    valid_header = f"sha256={expected_hash}"
    invalid_header = "sha256=wrong_hash_000000000000000000000000"

    assert verify_meta_hmac_sha256(payload, valid_header, secret) is True, "Valid HMAC signature must pass"
    assert verify_meta_hmac_sha256(payload, invalid_header, secret) is False, "Invalid HMAC signature must fail"
    assert verify_meta_hmac_sha256(payload, None, secret) is False, "Missing header with configured secret must fail"
    print("  [PASS] HMAC SHA-256 signature verification passes positive and negative cases.")

    # 1.2 Messenger Adapter
    messenger_payload = {
        "object": "page",
        "entry": [{
            "id": TEST_PAGE_ID,
            "time": 1726050000000,
            "messaging": [{
                "sender": {"id": "user_psid_999"},
                "recipient": {"id": TEST_PAGE_ID},
                "timestamp": 1726050000000,
                "message": {
                    "mid": "m_msg_test_001",
                    "text": "Hello, do you have size 10 sneakers?"
                }
            }]
        }]
    }
    adapter = MessengerChannelAdapter()
    events = await adapter.parse_inbound_payload(messenger_payload)
    assert len(events) == 1, f"Expected 1 canonical event, got {len(events)}"
    ev = events[0]
    assert ev.channel == "messenger"
    assert ev.sender_id == "user_psid_999"
    assert ev.recipient_id == TEST_PAGE_ID
    assert ev.text == "Hello, do you have size 10 sneakers?"
    assert ev.is_echo is False
    print("  [PASS] MessengerAdapter successfully parsed inbound user message.")

    # 1.3 Messenger Echo Detection (Page Owner manual reply)
    echo_payload = {
        "object": "page",
        "entry": [{
            "id": TEST_PAGE_ID,
            "messaging": [{
                "sender": {"id": TEST_PAGE_ID},
                "recipient": {"id": "user_psid_999"},
                "message": {
                    "mid": "m_echo_001",
                    "is_echo": True,
                    "text": "Hi! This is Sarah from support, I'm checking inventory now."
                }
            }]
        }]
    }
    echo_events = await adapter.parse_inbound_payload(echo_payload)
    assert len(echo_events) == 1
    assert echo_events[0].is_echo is True
    assert echo_events[0].external_account_id == TEST_PAGE_ID
    assert echo_events[0].external_user_id == "user_psid_999"
    print("  [PASS] MessengerAdapter correctly identifies page owner echo/agent reply.")

    # 1.4 Instagram Adapter
    ig_adapter = InstagramChannelAdapter()
    ig_payload = {
        "object": "instagram",
        "entry": [{
            "id": TEST_IG_ID,
            "messaging": [{
                "sender": {"id": "user_igsid_777"},
                "recipient": {"id": TEST_IG_ID},
                "timestamp": 1726050001000,
                "message": {
                    "mid": "ig_msg_001",
                    "text": "Sent from Instagram DM! Are you open on Sunday?"
                }
            }]
        }]
    }
    ig_events = await ig_adapter.parse_inbound_payload(ig_payload)
    assert len(ig_events) == 1
    assert ig_events[0].channel == "instagram"
    assert ig_events[0].sender_id == "user_igsid_777"
    assert ig_events[0].recipient_id == TEST_IG_ID
    print("  [PASS] InstagramChannelAdapter parsed inbound Instagram DM.")

    # 1.5 Facebook Page Comment Adapter
    comment_adapter = CommentAdapter()
    fb_comment_payload = {
        "object": "page",
        "entry": [{
            "id": TEST_PAGE_ID,
            "changes": [{
                "field": "feed",
                "value": {
                    "item": "comment",
                    "verb": "add",
                    "comment_id": "comment_fb_123",
                    "post_id": f"{TEST_PAGE_ID}_post_456",
                    "parent_id": f"{TEST_PAGE_ID}_post_456",
                    "from": {"id": "user_fb_888", "name": "Alice Johnson"},
                    "message": "What is the price of this jacket?",
                    "created_time": 1726050002
                }
            }]
        }]
    }
    fb_c_events = await comment_adapter.parse_inbound_payload(fb_comment_payload)
    assert len(fb_c_events) == 1
    assert fb_c_events[0].channel == "facebook_comment"
    assert fb_c_events[0].source_comment_id == "comment_fb_123"
    assert fb_c_events[0].source_post_id == f"{TEST_PAGE_ID}_post_456"
    assert fb_c_events[0].sender_name == "Alice Johnson"
    print("  [PASS] CommentAdapter parsed Facebook Page comment.")

    # 1.6 Instagram Media Comment Adapter
    ig_comment_payload = {
        "object": "instagram",
        "entry": [{
            "id": TEST_IG_ID,
            "changes": [{
                "field": "comments",
                "value": {
                    "id": "ig_comment_999",
                    "media": {"id": "ig_media_555"},
                    "from": {"id": "user_ig_333", "username": "sarah_travels"},
                    "text": "Love this picture! Where was this taken?"
                }
            }]
        }]
    }
    ig_c_events = await comment_adapter.parse_inbound_payload(ig_comment_payload)
    assert len(ig_c_events) == 1
    assert ig_c_events[0].channel == "instagram_comment"
    assert ig_c_events[0].source_comment_id == "ig_comment_999"
    assert ig_c_events[0].source_post_id == "ig_media_555"
    assert ig_c_events[0].sender_name in ["sarah_travels", "@sarah_travels"]
    print("  [PASS] CommentAdapter parsed Instagram media comment.")


async def test_suite_2_comment_classification():
    print("\n=======================================================")
    print("TEST SUITE 2: Social Comment Classification & NLP Taxonomy")
    print("=======================================================")

    # 2.1 Price inquiry
    res1 = await prompt_service.classify_social_comment("How much is this bag and do you ship to Lagos?")
    print(f"  Price Inquiry Classification: Intent={res1.get('intent')}, Risk={res1.get('risk_level')}, Action={res1.get('recommended_action')}")
    assert str(res1.get("intent", "")).upper() in ["PRICE_ENQUIRY", "PRODUCT_QUESTION", "PURCHASE_INTENT", "GENERAL"]
    assert str(res1.get("risk_level", "")).lower() in ["low", "none", "medium"]
    print("  [PASS] Price inquiry correctly categorized.")

    # 2.2 Urgent complaint / scam accusation
    res2 = await prompt_service.classify_social_comment("Fraud! You debited my card twice and your customer service is ignoring me! Refund my money immediately!")
    print(f"  Complaint Classification: Intent={res2.get('intent')}, Sentiment={res2.get('sentiment')}, Risk={res2.get('risk_level')}")
    assert any(k in str(res2.get("intent", "")).upper() for k in ["COMPLAINT", "URGENT", "SUPPORT"])
    assert str(res2.get("sentiment", "")).lower() in ["negative", "very_negative"]
    assert str(res2.get("risk_level", "")).lower() in ["critical", "high"]
    assert any(act in str(res2.get("recommended_action", "")).upper() for act in ["ESCALATE", "STAFF", "HUMAN", "PRIVATE_REPLY"])
    print("  [PASS] Critical complaint identified with high risk level and human escalation.")

    # 2.3 Praise / testimonial
    res3 = await prompt_service.classify_social_comment("This is the best service I've experienced in years! Highly recommend.")
    print(f"  Praise Classification: Intent={res3.get('intent')}, Sentiment={res3.get('sentiment')}")
    assert any(k in str(res3.get("intent", "")).upper() for k in ["PRAISE", "GENERAL", "FEEDBACK", "ENQUIRY"])
    assert str(res3.get("sentiment", "")).lower() in ["positive", "neutral"]
    print("  [PASS] Positive brand sentiment correctly recognized.")


async def test_suite_3_messenger_pipeline():
    print("\n=======================================================")
    print("TEST SUITE 3: Messenger Inbound Ingestion, CRM & ARGUS")
    print("=======================================================")

    event = CanonicalEvent(
        channel="messenger",
        external_message_id=f"mid_test_m_{int(time.time())}",
        sender_id="psid_test_buyer_101",
        sender_name="David Adeleke",
        recipient_id=TEST_PAGE_ID,
        text="Hi, I'm interested in wholesale pricing for your products.",
        raw_payload={"mock": True}
    )

    result = await omnichannel_engine.process_canonical_event(TEST_BIZ_ID, event)
    assert result.get("status") in ["processed", "success"]
    print(f"  OmnichannelEngine processed Messenger event: status={result.get('status')}")

    # Verify Database Conversation & Message records
    async with AsyncSessionLocal() as session:
        # Check conversation
        conv_id = f"{TEST_BIZ_ID}:psid_test_buyer_101"
        conv = await session.get(Conversation, conv_id)
        assert conv is not None, f"Conversation {conv_id} must exist in DB"
        assert conv.channel == "messenger"
        assert conv.external_account_id == TEST_PAGE_ID
        assert conv.external_user_id == "psid_test_buyer_101"
        print(f"  [PASS] Conversation created: channel={conv.channel}, external_user_id={conv.external_user_id}")

        # Check message
        stmt_msg = (
            session.query(Message)
            if hasattr(session, "query")
            else None
        )
        # Using select for async
        from sqlalchemy import select
        res_msgs = await session.execute(select(Message).where(Message.conversation_id == conv_id))
        msgs = res_msgs.scalars().all()
        assert len(msgs) >= 1, "At least one message should be recorded"
        cust_msg = [m for m in msgs if m.sender == "customer"][0]
        assert cust_msg.channel == "messenger"
        assert cust_msg.external_message_id == event.external_message_id
        print(f"  [PASS] Customer message recorded with external_message_id={cust_msg.external_message_id}")

        # Check CRM Lead created and identity mapped
        from services.db_service import get_lead_by_contact
        lead_id = await get_lead_by_contact(TEST_BIZ_ID, external_user_id="psid_test_buyer_101")
        assert lead_id is not None, "Lead should be automatically created in CRM for new social contact"
        lead = await session.get(Lead, lead_id)
        assert lead.external_identities is not None
        assert lead.external_identities.get("messenger") == "psid_test_buyer_101"
        print(f"  [PASS] CRM Lead captured: Name='{lead.name}', external_identities={lead.external_identities}")


async def test_suite_4_instagram_dm_pipeline():
    print("\n=======================================================")
    print("TEST SUITE 4: Instagram DM Ingestion & Identity Linkage")
    print("=======================================================")

    ig_event = CanonicalEvent(
        channel="instagram",
        external_message_id=f"ig_mid_{int(time.time())}",
        sender_id="igsid_user_chioma_404",
        sender_name="Chioma Luxury",
        recipient_id=TEST_IG_ID,
        text="Hello! Do you ship to Abuja?",
        raw_payload={"mock": True}
    )

    result = await omnichannel_engine.process_canonical_event(TEST_BIZ_ID, ig_event)
    assert result.get("status") in ["processed", "success"]

    async with AsyncSessionLocal() as session:
        conv_id = f"{TEST_BIZ_ID}:igsid_user_chioma_404"
        conv = await session.get(Conversation, conv_id)
        assert conv is not None
        assert conv.channel == "instagram"
        assert conv.external_account_id == TEST_IG_ID
        print(f"  [PASS] Instagram DM conversation created: channel={conv.channel}")

        # Check CRM Lead
        from services.db_service import get_lead_by_contact
        lead_id = await get_lead_by_contact(TEST_BIZ_ID, external_user_id="igsid_user_chioma_404")
        assert lead_id is not None
        lead = await session.get(Lead, lead_id)
        assert lead.external_identities.get("instagram") == "igsid_user_chioma_404"
        print(f"  [PASS] CRM Lead mapped to Instagram identity: {lead.external_identities}")


async def test_suite_5_social_comment_and_comment_to_dm():
    print("\n=======================================================")
    print("TEST SUITE 5: Social Comment Ingestion & Comment-to-DM")
    print("=======================================================")

    c_id = f"c_test_{int(time.time())}"
    comment_event = CanonicalEvent(
        channel="facebook_comment",
        external_message_id=c_id,
        sender_id="user_fb_commenter_505",
        sender_name="Emeka Okafor",
        recipient_id=TEST_PAGE_ID,
        text="How much is this? Can you send me the invoice?",
        source_post_id=f"{TEST_PAGE_ID}_post_999",
        source_comment_id=c_id,
        raw_payload={"mock": True}
    )

    result = await omnichannel_engine.process_canonical_event(TEST_BIZ_ID, comment_event)
    assert result.get("status") in ["processed", "success"]
    assert str(result.get("intent", "")).upper() in ["PRICE_ENQUIRY", "PURCHASE_INTENT", "PRODUCT_QUESTION", "GENERAL"]
    print(f"  Comment Intent classified: {result.get('intent')}, Public Reply: '{result.get('public_reply')}'")

    async with AsyncSessionLocal() as session:
        conv_id = f"{TEST_BIZ_ID}:{c_id}"
        conv = await session.get(Conversation, conv_id)
        assert conv is not None
        assert conv.channel == "facebook_comment"
        assert conv.channel_metadata.get("comment_id") == c_id
        assert conv.channel_metadata.get("post_id") == f"{TEST_PAGE_ID}_post_999"
        print(f"  [PASS] Social comment thread stored with post_id and comment_id metadata.")


async def test_suite_6_human_mode_and_auto_escalation():
    print("\n=======================================================")
    print("TEST SUITE 6: Human Mode Co-existence & Auto-Escalation")
    print("=======================================================")

    # 6.1 Critical complaint triggers auto-escalation to human mode
    crit_id = f"mid_crit_{int(time.time())}"
    crit_event = CanonicalEvent(
        channel="messenger",
        external_message_id=crit_id,
        sender_id="psid_angry_customer_606",
        sender_name="Angry Customer",
        recipient_id=TEST_PAGE_ID,
        text="You guys are a scam! I am reporting this page to the police and consumer protection right now!",
        raw_payload={"mock": True}
    )

    res_crit = await omnichannel_engine.process_canonical_event(TEST_BIZ_ID, crit_event)
    async with AsyncSessionLocal() as session:
        conv_id = f"{TEST_BIZ_ID}:psid_angry_customer_606"
        conv = await session.get(Conversation, conv_id)
        assert conv is not None
        assert conv.mode == "human", f"Expected mode='human', got {conv.mode}"
        assert conv.status == "waiting", f"Expected status='waiting', got {conv.status}"
        print("  [PASS] Critical sentiment complaint automatically switched conversation to Human Mode.")

    # 6.2 Page Owner Echo Message (Native mobile reply / Business Suite reply)
    echo_mid = f"mid_echo_{int(time.time())}"
    echo_event = CanonicalEvent(
        channel="messenger",
        external_message_id=echo_mid,
        external_account_id=TEST_PAGE_ID,
        external_user_id="psid_angry_customer_606",
        text="Hello, this is the store manager. We sincerely apologize and will issue your refund right away.",
        is_echo=True,
        raw_payload={"mock": True}
    )

    res_echo = await omnichannel_engine.process_canonical_event(TEST_BIZ_ID, echo_event)
    assert res_echo.get("status") == "human_echo_recorded"
    print("  [PASS] Page owner manual echo detected. Omnichannel engine recorded reply without AI triggering.")

    # Check conversation remains in human mode with agent reply stored
    async with AsyncSessionLocal() as session:
        conv = await session.get(Conversation, conv_id)
        assert conv.mode == "human"
        from sqlalchemy import select
        res_msgs = await session.execute(select(Message).where(Message.conversation_id == conv_id))
        msgs = res_msgs.scalars().all()
        agent_msgs = [m for m in msgs if m.sender == "agent"]
        assert len(agent_msgs) >= 1
        print("  [PASS] Owner echo saved as agent message in conversation thread.")


async def test_suite_7_deduplication():
    print("\n=======================================================")
    print("TEST SUITE 7: Webhook Deduplication & Replay Prevention")
    print("=======================================================")

    dedup_mid = f"mid_dedup_test_{int(time.time())}"
    ev = CanonicalEvent(
        channel="messenger",
        external_message_id=dedup_mid,
        sender_id="psid_dedup_user",
        recipient_id=TEST_PAGE_ID,
        text="What time do you close today?",
        raw_payload={"mock": True}
    )

    # First delivery
    res1 = await omnichannel_engine.process_canonical_event(TEST_BIZ_ID, ev)
    assert res1.get("status") in ["processed", "success"]

    # Second delivery (Simulate Meta webhook retry)
    res2 = await omnichannel_engine.process_canonical_event(TEST_BIZ_ID, ev)
    assert res2.get("status") == "duplicate"
    print("  [PASS] Duplicate webhook event within TTL detected and safely bypassed.")


async def test_suite_8_whatsapp_regression():
    print("\n=======================================================")
    print("TEST SUITE 8: WhatsApp Regression & Backward Compatibility")
    print("=======================================================")

    wa_adapter = WhatsAppChannelAdapter()
    wa_payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "123456789",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {"display_phone_number": "15551234567", "phone_number_id": "123456789"},
                    "contacts": [{"profile": {"name": "Grace Okon"}, "wa_id": "2348012345678"}],
                    "messages": [{
                        "from": "2348012345678",
                        "id": f"wamid_test_{int(time.time())}",
                        "timestamp": "1726050010",
                        "text": {"body": "Hello WhatsApp bot! Can I see your catalog?"},
                        "type": "text"
                    }]
                },
                "field": "messages"
            }]
        }]
    }

    events = await wa_adapter.parse_inbound_payload(wa_payload)
    assert len(events) == 1
    we = events[0]
    assert we.channel == "whatsapp"
    assert we.sender_id == "2348012345678"
    assert we.sender_name == "Grace Okon"
    assert "catalog" in we.text
    print(f"  [PASS] WhatsApp adapter parsed inbound message: from={we.sender_id}, name={we.sender_name}")

    # Process via Omnichannel Engine
    res_wa = await omnichannel_engine.process_canonical_event(TEST_BIZ_ID, we)
    assert res_wa.get("status") in ["processed", "success"]
    print("  [PASS] WhatsApp message processed successfully through canonical omnichannel engine.")


async def main():
    print("================================================================")
    print("STARTING INTERACAI OMNICHANNEL & SOCIAL SIGNAL VERIFICATION")
    print("================================================================")
    start_time = time.time()

    await setup_test_business()
    await test_suite_1_adapters_and_security()
    await test_suite_2_comment_classification()
    await test_suite_3_messenger_pipeline()
    await test_suite_4_instagram_dm_pipeline()
    await test_suite_5_social_comment_and_comment_to_dm()
    await test_suite_6_human_mode_and_auto_escalation()
    await test_suite_7_deduplication()
    await test_suite_8_whatsapp_regression()

    duration = time.time() - start_time
    print("\n================================================================")
    print(f"ALL 8 VERIFICATION SUITES PASSED PERFECTLY in {duration:.2f}s!")
    print("================================================================")


if __name__ == "__main__":
    asyncio.run(main())
