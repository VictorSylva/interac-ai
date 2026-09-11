"""
InteracAI Canonical Channel Adapter Base Interface & Canonical Models.
Defines normalized message/event representations and standard adapter contracts.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime
import hmac
import hashlib
import logging

logger = logging.getLogger(__name__)


class CanonicalEvent(BaseModel):
    """
    Normalized internal event representation for all omnichannel messages,
    comments, reactions, and social signals.
    """
    event_id: str                              # Unique message/comment ID (wamid, mid, comment_id)
    business_id: str                           # Resolved internal Business UUID
    channel: str                               # whatsapp | messenger | instagram | facebook_comment | instagram_comment | web
    event_type: str = "message"                # message | comment | reaction
    direction: str = "inbound"                 # inbound | outbound
    
    external_account_id: str                   # Phone Number ID / Page ID / IG Business Account ID
    external_user_id: str                      # Phone number / PSID / IGSID
    customer_name: Optional[str] = None        # Name from profile or username
    
    content: str = ""                          # Text message or comment body
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    attachments: List[Dict[str, Any]] = []     # Media attachments (images, audio, video)
    
    reply_to_id: Optional[str] = None          # If replying to a specific message ID
    source_post_id: Optional[str] = None       # For social comments
    source_comment_id: Optional[str] = None    # For comment-to-DM or comment replies
    
    # Metadata for routing & auditing
    raw_payload: Dict[str, Any] = {}
    is_private_reply_eligible: bool = False    # Meta 7-day rule flag for comments
    is_echo: bool = False

    def __init__(self, **data):
        if "text" in data and "content" not in data:
            data["content"] = data.pop("text")
        if "sender_id" in data and "external_user_id" not in data:
            data["external_user_id"] = data.pop("sender_id")
        if "recipient_id" in data and "external_account_id" not in data:
            data["external_account_id"] = data.pop("recipient_id")
        if "sender_name" in data and "customer_name" not in data:
            data["customer_name"] = data.pop("sender_name")
        if "external_message_id" in data and "event_id" not in data:
            data["event_id"] = data.pop("external_message_id")
        if "business_id" not in data:
            data["business_id"] = ""
        super().__init__(**data)

    @property
    def text(self) -> str:
        return self.content

    @property
    def sender_id(self) -> str:
        return self.external_user_id

    @property
    def recipient_id(self) -> str:
        return self.external_account_id

    @property
    def sender_name(self) -> Optional[str]:
        return self.customer_name

    @property
    def external_message_id(self) -> str:
        return self.event_id


class BaseChannelAdapter(ABC):
    """
    Contract for every platform adapter in InteracAI.
    """
    @abstractmethod
    def verify_webhook(self, mode: str, verify_token: str, challenge: str, expected_token: str) -> Optional[int]:
        """
        Validates the GET subscription handshake challenge.
        Returns the integer challenge if valid, None otherwise.
        """
        pass

    @abstractmethod
    def validate_signature(self, raw_body: bytes, signature_header: Optional[str], app_secret: str) -> bool:
        """
        Validates HMAC-SHA256 (X-Hub-Signature-256) signature against the tenant App Secret.
        """
        pass

    @abstractmethod
    async def parse_inbound_payload(self, raw_json: Dict[str, Any]) -> List[CanonicalEvent]:
        """
        Parses raw platform JSON into a list of normalized CanonicalEvents.
        """
        pass

    @abstractmethod
    async def send_outbound(
        self,
        business_id: str,
        recipient_id: str,
        content: str,
        reply_to_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Sends an outbound text/response through the platform API.
        """
        pass


def verify_meta_hmac_sha256(raw_body: bytes, signature_header: Optional[str], app_secret: Optional[str]) -> bool:
    """
    Cryptographically validates Meta's X-Hub-Signature-256 header.
    Format: 'sha256=<hex>'
    """
    if not app_secret:
        # If no secret configured, allow local dev pass-through
        return True

    if not signature_header:
        logger.warning("[Meta Signature] Missing signature_header for validation when app_secret is configured.")
        return False

    try:
        parts = signature_header.split("=")
        if len(parts) != 2 or parts[0] != "sha256":
            logger.warning(f"[Meta Signature] Invalid header format: {signature_header}")
            return False
            
        expected_sig = parts[1]
        calculated = hmac.new(
            app_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        
        is_valid = hmac.compare_digest(expected_sig, calculated)
        if not is_valid:
            logger.warning("[Meta Signature] HMAC-SHA256 signature mismatch.")
        return is_valid
    except Exception as e:
        logger.error(f"[Meta Signature] Error validating signature: {e}")
        return False
