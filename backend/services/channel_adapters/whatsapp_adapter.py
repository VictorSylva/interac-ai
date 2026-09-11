"""
InteracAI WhatsApp Channel Adapter.
Wraps Meta WhatsApp Cloud API while maintaining 100% backward compatibility with existing services.
"""

import logging
import re
from typing import Optional, Dict, Any, List
from .base import BaseChannelAdapter, CanonicalEvent, verify_meta_hmac_sha256
from services.db_service import get_business_id_by_phone_id, resolve_business_id
from services.whatsapp_service import send_whatsapp_message, normalize_phone_number
import os

logger = logging.getLogger(__name__)


class WhatsAppChannelAdapter(BaseChannelAdapter):
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
            entry_list = raw_json.get("entry", [])
            for entry in entry_list:
                changes = entry.get("changes", [])
                for change in changes:
                    value = change.get("value", {})
                    if "messages" not in value:
                        continue

                    metadata = value.get("metadata", {})
                    phone_id = metadata.get("phone_number_id", "")
                    
                    # Resolve business_id
                    business_id = await get_business_id_by_phone_id(phone_id)
                    if not business_id:
                        fallback_bid = os.getenv("PRIMARY_BUSINESS_ID", "groupcopac@gmail.com")
                        business_id = await resolve_business_id(fallback_bid)

                    contacts = value.get("contacts", [])
                    contact_map = {c.get("wa_id"): c.get("profile", {}).get("name") for c in contacts}

                    for msg in value.get("messages", []):
                        from_number = msg.get("from", "")
                        msg_id = msg.get("id", f"wa_{from_number}_{msg.get('timestamp', '')}")
                        msg_type = msg.get("type", "text")
                        
                        # Extract text
                        body = ""
                        if msg_type == "text":
                            body = msg.get("text", {}).get("body", "")
                        elif msg_type == "button":
                            body = msg.get("button", {}).get("text", "")
                        elif msg_type == "interactive":
                            interactive = msg.get("interactive", {})
                            body = interactive.get("button_reply", {}).get("title") or interactive.get("list_reply", {}).get("title", "")
                        elif msg_type in ["image", "video", "audio", "document"]:
                            body = msg.get(msg_type, {}).get("caption", f"[{msg_type.upper()} ATTACHMENT]")

                        cust_name = contact_map.get(from_number, from_number)

                        event = CanonicalEvent(
                            event_id=msg_id,
                            business_id=business_id,
                            channel="whatsapp",
                            event_type="message",
                            direction="inbound",
                            external_account_id=phone_id,
                            external_user_id=from_number,
                            customer_name=cust_name,
                            content=body,
                            timestamp=msg.get("timestamp", ""),
                            raw_payload=msg
                        )
                        events.append(event)
        except Exception as e:
            logger.error(f"[WhatsAppAdapter] Error parsing payload: {e}")

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
        Dispatches outbound message via existing send_whatsapp_message function.
        """
        clean_recipient = normalize_phone_number(recipient_id)
        return await send_whatsapp_message(to_number=clean_recipient, text=content, business_id=business_id)


whatsapp_adapter = WhatsAppChannelAdapter()
