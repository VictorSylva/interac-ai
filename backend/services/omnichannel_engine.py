"""
InteracAI Omnichannel Conversation Engine.
Central coordinator for all messaging and social signal intelligence across:
- WhatsApp Cloud API
- Facebook Messenger
- Instagram Direct Messages
- Facebook Page Comments
- Instagram Media Comments
"""

import logging
import re
import json
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from database.session import AsyncSessionLocal
from database.models.chat import Conversation, Message
from database.models.crm import Lead
from database.models.general import BusinessSettings

from services.channel_adapters.base import CanonicalEvent
from services.channel_adapters.whatsapp_adapter import whatsapp_adapter
from services.channel_adapters.messenger_adapter import messenger_adapter
from services.channel_adapters.instagram_adapter import instagram_adapter
from services.channel_adapters.comment_adapter import comment_adapter

from services.db_service import (
    store_message,
    get_chat_history,
    set_conversation_mode,
    get_business_profile,
    save_lead,
    get_lead_by_contact,
    resolve_business_id
)
from services.prompt_service import prompt_service
from services.ai_service import generate_response
from services.workflow_engine import workflow_engine
from services.observation_service import observation_service
from services.argus_core_client import emit_observation
from services.notification_service import notification_service
from services.socket_manager import socket_manager
from services.subscription_service import check_access, track_conversation

logger = logging.getLogger(__name__)

# In-memory deduplication set for fast duplicate rejection (expires via timestamp purge)
# Format: {dedup_key: timestamp}
DEDUP_CACHE: Dict[str, float] = {}
DEDUP_TTL_SECONDS = 86400  # 24 hours


class OmnichannelEngine:
    """
    Unified engine processing canonical events across all channels.
    """

    def is_duplicate(self, business_id: str, channel: str, event_id: str) -> bool:
        """Checks whether this external message/comment ID has already been ingested."""
        if not event_id:
            return False

        dedup_key = f"dedup:{business_id}:{channel}:{event_id}"
        import time
        now = time.time()

        # Fast path: in-memory cache
        if dedup_key in DEDUP_CACHE:
            if now - DEDUP_CACHE[dedup_key] < DEDUP_TTL_SECONDS:
                logger.info(f"[OmnichannelEngine] Duplicate event rejected by cache: {dedup_key}")
                return True

        DEDUP_CACHE[dedup_key] = now

        # Periodic cleanup if cache grows large
        if len(DEDUP_CACHE) > 5000:
            expired = [k for k, ts in DEDUP_CACHE.items() if now - ts > DEDUP_TTL_SECONDS]
            for k in expired:
                DEDUP_CACHE.pop(k, None)

        return False

    async def is_already_persisted(self, business_id: str, external_message_id: str) -> bool:
        """Database safety check for duplicate messages across retries."""
        if not external_message_id:
            return False
        async with AsyncSessionLocal() as session:
            stmt = select(Message.id).where(
                Message.business_id == business_id,
                Message.external_message_id == external_message_id
            ).limit(1)
            res = await session.execute(stmt)
            return res.scalar_one_or_none() is not None

    async def process_canonical_event(self, business_id: str, event: CanonicalEvent) -> dict:
        """
        Ingests a CanonicalEvent, handles deduplication, echoes, comments, and direct messages,
        returning structured status metadata for caller and test verification.
        """
        event.business_id = business_id
        event_id = event.event_id or event.external_message_id

        # 1. Deduplication check
        if self.is_duplicate(business_id, event.channel, event_id):
            logger.info(f"[OmnichannelEngine] Duplicate event detected for {event_id}")
            return {"status": "duplicate", "event_id": event_id}

        if await self.is_already_persisted(business_id, event_id):
            logger.info(f"[OmnichannelEngine] Event {event_id} already persisted in DB")
            return {"status": "duplicate", "event_id": event_id}

        # 2. Page Owner / Human Agent Echo handling (Native Mobile / Business Suite reply)
        if event.is_echo:
            user_id = event.external_user_id
            await store_message(
                business_id=business_id,
                user_id=user_id,
                text=event.content or event.text,
                sender="agent",
                platform=event.channel,
                external_account_id=event.external_account_id,
                external_user_id=user_id,
                external_message_id=event_id,
                customer_name=event.customer_name
            )
            await set_conversation_mode(business_id, user_id, mode="human", status="active")
            logger.info(f"[OmnichannelEngine] Human echo recorded for conversation {user_id}")
            return {"status": "human_echo_recorded", "event_id": event_id}

        # 3. Route to comment or DM pipeline
        if event.channel in ["facebook_comment", "instagram_comment"]:
            res = await self._process_social_comment(event)
            return res or {"status": "processed", "event_id": event_id}
        else:
            res = await self._process_direct_message(event)
            return res or {"status": "processed", "event_id": event_id}

    async def process_event(self, event: CanonicalEvent):
        """
        Main ingress pipeline for CanonicalEvents received from routes.
        """
        try:
            logger.info(f"[OmnichannelEngine] Processing event {event.event_id} on channel {event.channel} for business {event.business_id}")

            # Access & Entitlement Check
            access = await check_access(event.business_id)
            if not access["allowed"]:
                logger.warning(f"[OmnichannelEngine] Access denied for business {event.business_id}: {access.get('reason')}")
                return

            # Track Conversation Session
            await track_conversation(event.business_id, event.external_user_id)

            # Delegate to canonical pipeline
            await self.process_canonical_event(event.business_id, event)

        except Exception as e:
            logger.error(f"[OmnichannelEngine] Error processing event: {e}", exc_info=True)

    # -------------------------------------------------------------
    # SOCIAL COMMENT PIPELINE
    # -------------------------------------------------------------
    async def _process_social_comment(self, event: CanonicalEvent) -> dict:
        """
        Handles Facebook Page and Instagram comments with intent intelligence,
        risk assessment, and Comment-to-DM workflows.
        """
        business_id = event.business_id
        comment_text = event.content or event.text
        user_id = event.external_user_id
        comment_id = event.event_id or event.external_message_id
        convo_id = f"{business_id}:{comment_id}"

        # 1. Intent, Sentiment & Risk Classification
        classification = await prompt_service.classify_social_comment(comment_text)
        intent = classification.get("intent", "GENERAL_ENQUIRY")
        sentiment = classification.get("sentiment", "neutral")
        risk_level = classification.get("risk_level", "LOW")
        department = classification.get("department", "general")

        logger.info(f"[SocialComment] Comment '{comment_text[:40]}' classified as {intent} (Risk: {risk_level}, Dept: {department})")

        # 2. Persist Comment in Unified Conversation Store using comment_id for thread identity
        await store_message(
            business_id=business_id,
            user_id=comment_id,
            text=comment_text,
            sender="customer",
            platform=event.channel,
            intent=intent,
            sentiment=sentiment,
            external_account_id=event.external_account_id,
            external_user_id=user_id,
            external_message_id=comment_id,
            message_type="comment",
            source_post_id=event.source_post_id,
            source_comment_id=event.source_comment_id or comment_id,
            raw_metadata={"comment_id": comment_id, "post_id": event.source_post_id, **(event.raw_payload or {})},
            customer_name=event.customer_name
        )

        # 3. Emit Normalized Observation to ARGUS Core
        try:
            severity_map = {"LOW": "info", "MEDIUM": "warning", "HIGH": "warning", "CRITICAL": "critical"}
            await emit_observation(
                source_system=event.channel,
                entity_type=intent.lower(),
                entity_id=comment_id,
                confidence=classification.get("confidence", 0.9),
                metadata={
                    "comment_text": comment_text,
                    "sender_name": event.customer_name,
                    "post_id": event.source_post_id,
                    "risk_level": risk_level,
                    "business_id": business_id
                },
                context=f"Social comment on {event.channel} by {event.customer_name}: {comment_text[:80]}",
                severity=severity_map.get(risk_level, "info")
            )
        except Exception as obs_err:
            logger.warning(f"[SocialComment] Observation emission error: {obs_err}")

        # 4. Trigger Workflow Engine
        trigger_payload = {
            "channel": event.channel,
            "comment_id": comment_id,
            "post_id": event.source_post_id,
            "user_id": user_id,
            "customer_name": event.customer_name,
            "message_body": comment_text,
            "intent": intent,
            "sentiment": sentiment,
            "risk_level": risk_level,
            "department": department,
            "business_id": business_id
        }
        await workflow_engine.trigger_workflow(business_id, event.channel, trigger_payload)
        await workflow_engine.trigger_workflow(business_id, "social_comment", trigger_payload)

        # 5. Risk-Based Response Execution
        # Case A: Critical / Complaint -> Escalate to human staff immediately
        if risk_level in ["CRITICAL", "HIGH"] or intent in ["CUSTOMER_COMPLAINT", "COMPLAINT", "URGENT_ASSISTANCE"]:
            await set_conversation_mode(business_id, comment_id, mode="human", status="waiting", department="support")
            await notification_service.notify_agent_and_owner(
                business_id=business_id,
                title=f"🚨 Critical Social Complaint ({event.channel.replace('_', ' ').title()})",
                message=f"{event.customer_name}: {comment_text}",
                customer_identifier=event.customer_name or user_id,
                department="support",
                conversation_id=convo_id,
                url="/dashboard/conversations"
            )
            # Post polite public de-escalation reply
            deescalation_msg = "We're so sorry for this experience! A senior support manager has been alerted and is reaching out to you privately right now to resolve this."
            await comment_adapter.send_public_reply(business_id, event.channel, comment_id, deescalation_msg)
            return {
                "status": "processed",
                "event_id": comment_id,
                "intent": intent,
                "risk_level": risk_level,
                "public_reply": deescalation_msg
            }

        # Case B: Purchase Intent / Price Enquiry -> Send Public Reply + Comment-to-DM
        if intent in ["PRICE_ENQUIRY", "PURCHASE_INTENT", "AVAILABILITY_ENQUIRY", "DELIVERY_ENQUIRY", "PRODUCT_QUESTION"]:
            # 1. Post friendly public comment reply
            public_text = f"Hi {event.customer_name or ''}! We've sent you the full details via direct message. Please check your inbox or message requests! ✨"
            await comment_adapter.send_public_reply(business_id, event.channel, comment_id, public_text)

            # 2. Generate and send Private Reply (Comment-to-DM)
            if event.is_private_reply_eligible:
                ai_private_reply = await generate_response(
                    user_message=comment_text,
                    conversation_history=[],
                    user_id=user_id,
                    business_id=business_id
                )
                clean_ai_reply = re.sub(r'\[ACTION:.*?\]', '', ai_private_reply, flags=re.DOTALL)
                clean_ai_reply = re.sub(r'\[ANALYSIS:.*?\]', '', clean_ai_reply, flags=re.DOTALL).strip()

                sent = await comment_adapter.send_private_reply(business_id, comment_id, clean_ai_reply)
                if sent:
                    await store_message(
                        business_id=business_id,
                        user_id=comment_id,
                        text=clean_ai_reply,
                        sender="agent",
                        platform=event.channel,
                        intent=intent,
                        sentiment=sentiment,
                        external_account_id=event.external_account_id,
                        external_user_id=user_id,
                        message_type="private_reply",
                        source_comment_id=comment_id
                    )

            # 3. Create Sales CRM Lead if Purchase Intent
            if intent in ["PURCHASE_INTENT", "PRICE_ENQUIRY"]:
                await save_lead(business_id, {
                    "name": event.customer_name or f"Lead ({event.channel})",
                    "contact": user_id,
                    "source": event.channel,
                    "notes": f"Purchase intent detected from comment: '{comment_text}'",
                    "tags": ["social_lead", intent.lower()],
                    "status": "new"
                })
                await notification_service.notify_agent_and_owner(
                    business_id=business_id,
                    title=f"💰 New Purchase Intent ({event.channel.replace('_', ' ').title()})",
                    message=f"{event.customer_name}: '{comment_text}'",
                    customer_identifier=event.customer_name or user_id,
                    department="sales",
                    conversation_id=convo_id,
                    url="/dashboard/conversations"
                )

            return {
                "status": "processed",
                "event_id": comment_id,
                "intent": intent,
                "risk_level": risk_level,
                "public_reply": public_text
            }

        # Case C: Low Risk / General / Positive Feedback -> Friendly public reply
        thanks_replies = [
            "Thank you so much! We really appreciate your support! ❤️",
            "Thanks for the love! ✨ Let us know if you need anything!",
            "We appreciate you! Stay awesome! 🙌"
        ]
        import random
        chosen_reply = random.choice(thanks_replies)
        await comment_adapter.send_public_reply(business_id, event.channel, comment_id, chosen_reply)
        return {
            "status": "processed",
            "event_id": comment_id,
            "intent": intent,
            "risk_level": risk_level,
            "public_reply": chosen_reply
        }

    # -------------------------------------------------------------
    # DIRECT MESSAGE PIPELINE (WhatsApp, Messenger, Instagram DM)
    # -------------------------------------------------------------
    async def _process_direct_message(self, event: CanonicalEvent) -> dict:
        """
        Handles direct private messages across WhatsApp, Facebook Messenger, and Instagram DMs.
        """
        business_id = event.business_id
        user_id = event.external_user_id
        msg_body = event.content or event.text
        channel = event.channel
        convo_id = f"{business_id}:{user_id}"

        # 1. Check Conversation Mode (Human vs AI)
        async with AsyncSessionLocal() as session:
            convo = await session.get(Conversation, convo_id)
            if convo and convo.mode == "human":
                logger.info(f"[OmnichannelEngine] Conversation {convo_id} is in HUMAN mode. Storing and skipping AI.")
                await store_message(
                    business_id=business_id,
                    user_id=user_id,
                    text=msg_body,
                    sender="customer",
                    platform=channel,
                    external_account_id=event.external_account_id,
                    external_user_id=user_id,
                    external_message_id=event.event_id,
                    customer_name=event.customer_name
                )
                return {"status": "processed", "event_id": event.event_id}

        # 2. Store Inbound Message
        detected_intent = await prompt_service.detect_intent(msg_body)
        sentiment_data = await prompt_service.analyze_sentiment(msg_body)

        await store_message(
            business_id=business_id,
            user_id=user_id,
            text=msg_body,
            sender="customer",
            platform=channel,
            intent=detected_intent,
            sentiment=sentiment_data.get("sentiment", "neutral"),
            external_account_id=event.external_account_id,
            external_user_id=user_id,
            external_message_id=event.event_id,
            customer_name=event.customer_name
        )

        # 2.1 Automatically capture/link CRM Lead for this contact
        lead_id = await get_lead_by_contact(business_id, external_user_id=user_id)
        if not lead_id:
            lead_data = {
                "name": event.customer_name or f"{channel.title()} User ({user_id[-6:]})",
                "contact": user_id,
                "source": channel,
                "conversation_id": convo_id,
                "external_identities": {channel: user_id},
                "status": "new",
                "last_interaction_at": datetime.utcnow()
            }
            if channel == "whatsapp":
                lead_data["phone"] = user_id
            await save_lead(business_id, lead_data)
        else:
            async with AsyncSessionLocal() as session:
                lead = await session.get(Lead, lead_id)
                if lead:
                    ext_ids = dict(lead.external_identities or {})
                    if channel not in ext_ids or ext_ids[channel] != user_id:
                        ext_ids[channel] = user_id
                        lead.external_identities = ext_ids
                        await session.commit()

        # 3. Check Auto-Escalation Keywords & Critical Complaints
        biz_profile = await get_business_profile(business_id)
        auto_escalate = biz_profile.get("auto_escalate_on_keyword", False)
        handover_keywords = ["human", "agent", "support", "representative", "person", "talk to someone", "speak to someone"]
        keyword_match = any(kw in msg_body.lower() for kw in handover_keywords)
        
        sentiment_str = str(sentiment_data.get("sentiment", "")).lower()
        intent_str = str(detected_intent or "").lower()
        is_critical_complaint = (
            sentiment_str in ["negative", "very_negative", "critical"]
            and any(kw in msg_body.lower() for kw in ["scam", "fraud", "police", "court", "lawyer", "refund", "stole", "thief", "fake", "report", "sue", "complaint"])
        ) or any(k in intent_str for k in ["complaint", "escalat", "urgent"]) or any(kw in msg_body.lower() for kw in ["scam", "fraud", "police", "court", "lawyer", "report this page"])

        if (auto_escalate and keyword_match) or is_critical_complaint or keyword_match:
            await set_conversation_mode(business_id, user_id, mode="human", status="waiting", department="support")
            transfer_text = "I'm transferring you to a human agent now. Please wait..."
            await self.send_outbound_reply(channel, business_id, user_id, transfer_text)
            await notification_service.notify_agent_and_owner(
                business_id=business_id,
                title="🚨 Urgent Escalation / Human Agent Requested",
                message=msg_body,
                customer_identifier=event.customer_name or user_id,
                department="support",
                conversation_id=convo_id,
                url="/dashboard/conversations"
            )
            return {"status": "processed", "event_id": event.event_id}

        # 4. Workflow Engine Trigger
        trigger_cmd = {
            "from_number": user_id,
            "user_id": user_id,
            "message_body": msg_body,
            "platform": channel,
            "channel": channel,
            "business_id": business_id,
            "intent": detected_intent,
            "sentiment": sentiment_data.get("sentiment", "neutral"),
            "sentiment_score": sentiment_data.get("score", 0.5),
            "keywords": [kw for kw in handover_keywords if kw in msg_body.lower()]
        }

        executions, takes_over_chat = await workflow_engine.trigger_workflow(business_id, "message_created", trigger_cmd)
        await workflow_engine.trigger_workflow(business_id, f"{channel}_message", trigger_cmd)

        if executions and takes_over_chat:
            logger.info(f"[OmnichannelEngine] Workflow took over conversation for {convo_id}. Skipping default AI.")
            return {"status": "processed", "event_id": event.event_id}

        # 5. Fetch Conversation History (last 5 messages)
        raw_history = await get_chat_history(business_id, user_id, limit=5)
        formatted_history = []
        for msg in raw_history:
            role = "user" if msg['sender'] == 'customer' else "assistant"
            formatted_history.append({"role": role, "content": msg['text']})

        # 6. Generate AI Response
        ai_reply = await generate_response(msg_body, formatted_history, user_id, business_id=business_id)

        # 7. Action Parsers
        # Lead Capture Action
        lead_match = re.search(r'\[ACTION: LEAD_CAPTURE \| (?P<json>.*?)\]', ai_reply)
        if lead_match:
            try:
                lead_data = json.loads(lead_match.group('json'))
                lead_data["source"] = channel
                await save_lead(business_id, lead_data)
            except Exception as e:
                logger.error(f"Error parsing lead capture: {e}")

        # Hotel Reservation Action
        hotel_res_match = re.search(r'\[ACTION:\s*HOTEL_RESERVATION\s*\|\s*(?P<json>\{.*?\})\]', ai_reply, re.IGNORECASE | re.DOTALL)
        if hotel_res_match:
            try:
                res_json_str = hotel_res_match.group('json').strip()
                res_json_str = re.sub(r'^```(?:json)?\s*', '', res_json_str)
                res_json_str = re.sub(r'\s*```$', '', res_json_str).strip()
                reservation_data = json.loads(res_json_str)
                from services.hotel_reservation_service import hotel_reservation_service
                await hotel_reservation_service.create_reservation_from_ai(
                    business_id=business_id,
                    reservation_data=reservation_data,
                    customer_phone=user_id,
                    platform=channel
                )
            except Exception as res_err:
                logger.error(f"Error parsing hotel reservation action: {res_err}")

        # Analysis Tags
        analysis_match = re.search(r'\[ANALYSIS:\s*(?P<intent>.*?)\s*\|\s*(?P<sentiment>.*?)\s*\]', ai_reply, re.IGNORECASE)
        final_intent = detected_intent
        final_sentiment = sentiment_data.get("sentiment", "neutral")
        if analysis_match:
            final_intent = analysis_match.group('intent').strip().lower()
            final_sentiment = analysis_match.group('sentiment').strip()

        # Clean tags from outbound text
        ai_reply = re.sub(r'\[ACTION:.*?\]', '', ai_reply, flags=re.DOTALL).strip()
        ai_reply = re.sub(r'\[ANALYSIS:.*?\]', '', ai_reply, flags=re.DOTALL).strip()

        # 8. Store Outbound Agent Message
        await store_message(
            business_id=business_id,
            user_id=user_id,
            text=ai_reply,
            sender="agent",
            platform=channel,
            intent=final_intent,
            sentiment=final_sentiment,
            external_account_id=event.external_account_id,
            external_user_id=user_id
        )

        # 9. Deliver Outbound Response via Channel Adapter
        await self.send_outbound_reply(channel, business_id, user_id, ai_reply)
        return {"status": "processed", "event_id": event.event_id}

    async def send_outbound_reply(self, channel: str, business_id: str, recipient_id: str, text: str, metadata: dict = None) -> bool:
        """
        Dispatches outbound text to the respective platform adapter.
        """
        logger.info(f"[OmnichannelEngine] Dispatching outbound reply on {channel} to {recipient_id}")
        if channel == "whatsapp":
            return await whatsapp_adapter.send_outbound(business_id, recipient_id, text, metadata=metadata)
        elif channel == "messenger":
            return await messenger_adapter.send_outbound(business_id, recipient_id, text, metadata=metadata)
        elif channel == "instagram":
            return await instagram_adapter.send_outbound(business_id, recipient_id, text, metadata=metadata)
        elif channel in ["facebook_comment", "instagram_comment"]:
            return await comment_adapter.send_outbound(business_id, recipient_id, text, metadata=metadata)
        else:
            logger.warning(f"[OmnichannelEngine] Unknown channel '{channel}' for outbound send.")
            return False


omnichannel_engine = OmnichannelEngine()
