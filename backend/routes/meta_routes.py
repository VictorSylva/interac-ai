"""
InteracAI Meta Integration Routes.
Exposes unified Meta Webhook endpoints (Messenger, Instagram, Comments) and configuration APIs.
"""

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
import os
import logging
from pydantic import BaseModel
from typing import Optional, Dict, Any

from services.channel_adapters.messenger_adapter import messenger_adapter
from services.channel_adapters.instagram_adapter import instagram_adapter
from services.channel_adapters.comment_adapter import comment_adapter
from services.omnichannel_engine import omnichannel_engine
from services.db_service import get_meta_config, update_meta_config, resolve_business_id
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", os.getenv("WHATSAPP_VERIFY_TOKEN", "interact_secret_token"))


class MetaConfigRequest(BaseModel):
    business_id: str
    facebook_page_id: Optional[str] = None
    facebook_page_name: Optional[str] = None
    facebook_page_access_token: Optional[str] = None
    instagram_account_id: Optional[str] = None
    instagram_username: Optional[str] = None
    app_id: Optional[str] = None
    app_secret: Optional[str] = None
    verify_token: Optional[str] = None
    messenger_active: Optional[bool] = None
    instagram_dm_active: Optional[bool] = None
    facebook_comments_active: Optional[bool] = None
    instagram_comments_active: Optional[bool] = None


@router.get("/meta/webhook")
async def verify_meta_webhook(request: Request):
    """
    Unified Meta Webhook verification handshake for Facebook Page, Messenger, and Instagram.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode and token:
        if mode == "subscribe" and (token == META_VERIFY_TOKEN or token == os.getenv("WHATSAPP_VERIFY_TOKEN", "interact_secret_token")):
            logger.info("[Meta Webhook] Webhook handshake verified successfully.")
            return int(challenge)
        else:
            logger.warning(f"[Meta Webhook] Verification failed. Token: {token}")
            raise HTTPException(status_code=403, detail="Verification failed")

    return {"status": "error", "message": "Missing parameters"}


@router.post("/meta/webhook")
async def receive_meta_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Inbound Meta Webhook endpoint for Facebook Messenger, Instagram DMs, and Comments.
    Returns HTTP 200 immediately to satisfy Meta's 3-second SLA, then processes in background.
    """
    try:
        raw_body = await request.body()
        data = await request.json()
        obj_type = data.get("object")

        logger.info(f"[Meta Webhook] Inbound event received for object: {obj_type}")

        # Parse events using appropriate adapter
        events = []
        if obj_type == "page":
            # Can be Messenger or Page Feed Comments
            # First check Messenger
            msg_events = await messenger_adapter.parse_inbound_payload(data)
            events.extend(msg_events)
            
            # Also check for Page Feed comments
            comment_events = await comment_adapter.parse_inbound_payload(data)
            events.extend(comment_events)

        elif obj_type == "instagram":
            # Can be Instagram DM or Instagram Media Comments
            ig_dm_events = await instagram_adapter.parse_inbound_payload(data)
            events.extend(ig_dm_events)

            ig_comment_events = await comment_adapter.parse_inbound_payload(data)
            events.extend(ig_comment_events)

        # Dispatch each parsed CanonicalEvent to omnichannel_engine in background
        for event in events:
            background_tasks.add_task(omnichannel_engine.process_event, event)

        return {"status": "accepted_for_processing", "events_count": len(events)}
    except Exception as e:
        logger.error(f"[Meta Webhook] Error accepting webhook: {e}")
        return {"status": "error"}


# -------------------------------------------------------------
# META CONFIGURATION & MANAGEMENT ENDPOINTS
# -------------------------------------------------------------

@router.get("/api/integrations/meta/config")
async def get_meta_config_endpoint(business_id: str):
    """Fetches business-specific Meta settings (tokens masked)."""
    bid = await resolve_business_id(business_id)
    config = await get_meta_config(bid)
    if not config:
        return {"status": "not_configured", "config": None}
    
    # Mask tokens for frontend security
    safe_config = dict(config)
    if safe_config.get("facebook_page_access_token"):
        safe_config["facebook_page_access_token"] = "••••••••••••••••"
    if safe_config.get("app_secret"):
        safe_config["app_secret"] = "••••••••••••••••"
        
    return {"status": "success", "config": safe_config}


@router.post("/api/integrations/meta/config")
async def update_meta_config_endpoint(req: MetaConfigRequest):
    """Updates business-specific Meta settings and encrypts sensitive tokens."""
    bid = await resolve_business_id(req.business_id)
    data = req.dict(exclude_unset=True)
    data.pop("business_id", None)
    
    # Don't overwrite existing token with masked placeholder
    if data.get("facebook_page_access_token") == "••••••••••••••••":
        data.pop("facebook_page_access_token")
    if data.get("app_secret") == "••••••••••••••••":
        data.pop("app_secret")

    success = await update_meta_config(bid, data)
    return {"status": "success" if success else "failed", "success": success}


@router.post("/api/integrations/meta/test-connection")
async def test_meta_connection(business_id: str):
    """
    Performs a live validation against Meta Graph API to verify Page Access Token
    and fetch Page name and connected Instagram account ID.
    """
    bid = await resolve_business_id(business_id)
    config = await get_meta_config(bid)

    if not config or not config.get("facebook_page_access_token"):
        raise HTTPException(status_code=400, detail="Meta configuration or Page Access Token is missing.")

    page_token = config.get("facebook_page_access_token")
    page_id = config.get("facebook_page_id")

    url = f"https://graph.facebook.com/v19.0/me?fields=id,name,instagram_business_account&access_token={page_token}"

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, timeout=10.0)
            if res.status_code == 200:
                data = res.json()
                detected_page_id = data.get("id")
                detected_page_name = data.get("name")
                ig_info = data.get("instagram_business_account", {})
                detected_ig_id = ig_info.get("id")

                update_payload = {
                    "webhook_verified": True,
                    "facebook_page_id": detected_page_id or page_id,
                    "facebook_page_name": detected_page_name,
                    "connection_error": None
                }
                if detected_ig_id:
                    update_payload["instagram_account_id"] = detected_ig_id

                await update_meta_config(bid, update_payload)

                return {
                    "status": "success",
                    "page_id": detected_page_id,
                    "page_name": detected_page_name,
                    "instagram_account_id": detected_ig_id,
                    "message": "Connection verified with Meta Graph API!"
                }
            else:
                err_text = res.text
                await update_meta_config(bid, {"connection_error": err_text})
                raise HTTPException(status_code=400, detail=f"Meta verification failed: {err_text}")
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"[Meta Test] Network error validating Meta credentials: {e}")
        raise HTTPException(status_code=400, detail=str(e))
