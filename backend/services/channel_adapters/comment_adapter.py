"""
InteracAI Social Comment Adapter.
Handles Facebook Page post comments, Instagram media comments, public replies, and Comment-to-DM workflows.
"""

import logging
import httpx
import os
from typing import Optional, Dict, Any, List
from .base import BaseChannelAdapter, CanonicalEvent, verify_meta_hmac_sha256
from services.db_service import (
    get_business_id_by_meta_page_id,
    get_business_id_by_instagram_id,
    get_meta_config,
    resolve_business_id
)

logger = logging.getLogger(__name__)


class CommentAdapter(BaseChannelAdapter):
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
        obj_type = raw_json.get("object")

        # 1. Facebook Page Comments (from 'feed' webhook)
        if obj_type == "page":
            for entry in raw_json.get("entry", []):
                page_id = str(entry.get("id", ""))
                business_id = await get_business_id_by_meta_page_id(page_id)
                if not business_id:
                    fallback_bid = os.getenv("PRIMARY_BUSINESS_ID", "groupcopac@gmail.com")
                    business_id = await resolve_business_id(fallback_bid)

                for change in entry.get("changes", []):
                    if change.get("field") == "feed":
                        val = change.get("value", {})
                        if val.get("item") == "comment" and val.get("verb") in ["add", None]:
                            comment_id = str(val.get("comment_id", ""))
                            post_id = str(val.get("post_id", ""))
                            from_obj = val.get("from", {}) if isinstance(val.get("from"), dict) else {}
                            sender_id = str(from_obj.get("id") or val.get("sender_id", ""))
                            sender_name = from_obj.get("name") or val.get("sender_name") or f"Facebook User ({sender_id[-6:]})"
                            msg_text = val.get("message", "")

                            # Skip if sender is the page itself (prevent bot reply loop)
                            if sender_id == page_id:
                                continue

                            event = CanonicalEvent(
                                event_id=comment_id,
                                business_id=business_id,
                                channel="facebook_comment",
                                event_type="comment",
                                direction="inbound",
                                external_account_id=page_id,
                                external_user_id=sender_id,
                                customer_name=sender_name,
                                content=msg_text,
                                timestamp=str(val.get("created_time", "")),
                                source_post_id=post_id,
                                source_comment_id=comment_id,
                                is_private_reply_eligible=True,
                                raw_payload=val
                            )
                            events.append(event)

        # 2. Instagram Media Comments (from 'comments' webhook)
        elif obj_type == "instagram":
            for entry in raw_json.get("entry", []):
                ig_account_id = str(entry.get("id", ""))
                business_id = await get_business_id_by_instagram_id(ig_account_id)
                if not business_id:
                    fallback_bid = os.getenv("PRIMARY_BUSINESS_ID", "groupcopac@gmail.com")
                    business_id = await resolve_business_id(fallback_bid)

                for change in entry.get("changes", []):
                    if change.get("field") == "comments":
                        val = change.get("value", {})
                        comment_id = str(val.get("id", ""))
                        text = val.get("text", "")
                        from_user = val.get("from", {})
                        sender_id = str(from_user.get("id", ""))
                        username = from_user.get("username", f"ig_user_{sender_id[-6:]}")
                        media = val.get("media", {})
                        media_id = str(media.get("id", ""))

                        # Skip if sender is the IG business account itself
                        if sender_id == ig_account_id:
                            continue

                        event = CanonicalEvent(
                            event_id=comment_id,
                            business_id=business_id,
                            channel="instagram_comment",
                            event_type="comment",
                            direction="inbound",
                            external_account_id=ig_account_id,
                            external_user_id=sender_id,
                            customer_name=f"@{username}" if not username.startswith("@") else username,
                            content=text,
                            timestamp="",
                            source_post_id=media_id,
                            source_comment_id=comment_id,
                            is_private_reply_eligible=True,
                            raw_payload=val
                        )
                        events.append(event)

        return events

    async def send_public_reply(
        self,
        business_id: str,
        channel: str,
        comment_id: str,
        text: str
    ) -> bool:
        """
        Posts a public reply directly to a Facebook or Instagram comment.
        """
        meta_config = await get_meta_config(business_id)
        if not meta_config:
            return False

        page_token = meta_config.get("facebook_page_access_token")
        if not page_token:
            return False

        # Endpoint varies slightly for Facebook vs Instagram
        if channel == "facebook_comment":
            url = f"https://graph.facebook.com/v19.0/{comment_id}/comments"
        else:
            url = f"https://graph.facebook.com/v19.0/{comment_id}/replies"

        headers = {
            "Authorization": f"Bearer {page_token}",
            "Content-Type": "application/json"
        }
        payload = {"message": text}

        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, headers=headers, json=payload, timeout=10.0)
                return res.status_code in [200, 201]
        except Exception as e:
            logger.error(f"[CommentAdapter] Error posting public reply to comment {comment_id}: {e}")
            return False

    async def send_private_reply(
        self,
        business_id: str,
        comment_id: str,
        text: str
    ) -> bool:
        """
        Sends a private message to the commenter via Meta's official Comment-to-DM endpoint.
        Must be within 7 days of comment creation. Max 1 private reply per comment.
        """
        meta_config = await get_meta_config(business_id)
        if not meta_config:
            return False

        page_id = meta_config.get("facebook_page_id")
        page_token = meta_config.get("facebook_page_access_token")
        if not page_id or not page_token:
            return False

        url = f"https://graph.facebook.com/v19.0/{page_id}/messages"
        headers = {
            "Authorization": f"Bearer {page_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "recipient": {
                "comment_id": comment_id
            },
            "message": {
                "text": text
            }
        }

        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, headers=headers, json=payload, timeout=10.0)
                if res.status_code in [200, 201]:
                    logger.info(f"[CommentAdapter] Private reply sent for comment {comment_id}")
                    return True
                else:
                    logger.error(f"[CommentAdapter] Private reply failed: {res.status_code} | {res.text}")
                    return False
        except Exception as e:
            logger.error(f"[CommentAdapter] Network error sending private reply: {e}")
            return False

    async def send_outbound(
        self,
        business_id: str,
        recipient_id: str,
        content: str,
        reply_to_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Default outbound routing: if source_comment_id is specified in metadata, sends private reply.
        """
        if metadata and metadata.get("source_comment_id"):
            return await self.send_private_reply(business_id, metadata["source_comment_id"], content)
        elif reply_to_id:
            channel = (metadata or {}).get("channel", "facebook_comment")
            return await self.send_public_reply(business_id, channel, reply_to_id, content)
        return False


comment_adapter = CommentAdapter()
