"""
InteracAI Facebook Messenger Channel Adapter.
Handles inbound Messenger events and outbound Page responses via Meta Graph API.
"""

import logging
import httpx
import os
from typing import Optional, Dict, Any, List
from .base import BaseChannelAdapter, CanonicalEvent, verify_meta_hmac_sha256
from services.db_service import get_business_id_by_meta_page_id, get_meta_config, resolve_business_id

logger = logging.getLogger(__name__)


class MessengerChannelAdapter(BaseChannelAdapter):
    def verify_webhook(self, mode: str, verify_token: str, challenge: str, expected_token: str) -> Optional[int]:
        if mode == "subscribe" and verify_token == expected_token:
            try:
                return int(challenge)
            except ValueError:
                return None
        return None

    def validate_signature(self, raw_body: bytes, signature_header: Optional[str], app_secret: str) -> bool:
        return verify_meta_hmac_sha256(raw_body, signature_header, app_secret)

    async def parse_inbound_payload(self, raw_json: Dict[str, Any]) -> List[CanonicalEvent]:
        events = []
        try:
            if raw_json.get("object") != "page":
                return events

            for entry in raw_json.get("entry", []):
                page_id = str(entry.get("id", ""))
                business_id = await get_business_id_by_meta_page_id(page_id)
                if not business_id:
                    fallback_bid = os.getenv("PRIMARY_BUSINESS_ID", "groupcopac@gmail.com")
                    business_id = await resolve_business_id(fallback_bid)

                for msg_event in entry.get("messaging", []):
                    msg_obj = msg_event.get("message", {})
                    is_echo = bool(msg_obj.get("is_echo"))
                    
                    if is_echo:
                        customer_id = str(msg_event.get("recipient", {}).get("id", ""))
                        page_sender_id = str(msg_event.get("sender", {}).get("id", ""))
                        mid = msg_obj.get("mid", f"echo_{customer_id}_{msg_event.get('timestamp')}")
                        text = msg_obj.get("text", "")
                        
                        event = CanonicalEvent(
                            event_id=mid,
                            business_id=business_id,
                            channel="messenger",
                            event_type="message",
                            direction="outbound",
                            external_account_id=page_sender_id or page_id,
                            external_user_id=customer_id,
                            customer_name=f"Facebook User ({customer_id[-6:]})",
                            content=text,
                            timestamp=str(msg_event.get("timestamp", "")),
                            is_echo=True,
                            raw_payload=msg_event
                        )
                        events.append(event)
                        continue

                    sender_id = str(msg_event.get("sender", {}).get("id", ""))
                    mid = msg_obj.get("mid", f"mid_{sender_id}_{msg_event.get('timestamp')}")
                    text = msg_obj.get("text", "")

                    if not text and "attachments" in msg_obj:
                        text = "[Attachment Received]"

                    event = CanonicalEvent(
                        event_id=mid,
                        business_id=business_id,
                        channel="messenger",
                        event_type="message",
                        direction="inbound",
                        external_account_id=page_id,
                        external_user_id=sender_id,
                        customer_name=f"Facebook User ({sender_id[-6:]})",
                        content=text,
                        timestamp=str(msg_event.get("timestamp", "")),
                        is_echo=False,
                        raw_payload=msg_event
                    )
                    events.append(event)
        except Exception as e:
            logger.error(f"[MessengerAdapter] Error parsing payload: {e}")

        return events

    async def send_outbound(
        self,
        business_id: str,
        recipient_id: str,
        content: str,
        reply_to_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Sends an outbound message to a Facebook Messenger user (PSID).
        """
        meta_config = await get_meta_config(business_id)
        if not meta_config:
            logger.error(f"[MessengerAdapter] Meta config not found for business {business_id}")
            return False

        page_id = meta_config.get("facebook_page_id")
        page_token = meta_config.get("facebook_page_access_token")

        if not page_id or not page_token:
            logger.error(f"[MessengerAdapter] Missing page_id or page_token for business {business_id}")
            return False

        url = f"https://graph.facebook.com/v19.0/{page_id}/messages"
        headers = {
            "Authorization": f"Bearer {page_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "recipient": {"id": recipient_id},
            "messaging_type": "RESPONSE",
            "message": {"text": content}
        }

        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, headers=headers, json=payload, timeout=10.0)
                if res.status_code in [200, 201]:
                    logger.info(f"[MessengerAdapter] Successfully delivered message to PSID {recipient_id}")
                    # Deduct tokens
                    try:
                        from services.token_service import token_service, TOKEN_COSTS
                        await token_service.deduct_tokens(business_id, TOKEN_COSTS.get("whatsapp_outbound", 1), "messenger_outbound")
                    except Exception:
                        pass
                    return True
                else:
                    logger.error(f"[MessengerAdapter] Send failed: {res.status_code} | {res.text}")
                    return False
        except Exception as e:
            logger.error(f"[MessengerAdapter] Network error calling Meta API: {e}")
            return False


messenger_adapter = MessengerChannelAdapter()
