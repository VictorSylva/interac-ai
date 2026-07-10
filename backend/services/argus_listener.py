import logging
import asyncio
import redis.asyncio as aioredis
from config import config
from services.socket_manager import socket_manager
import json

logger = logging.getLogger(__name__)

class ArgusListener:
    def __init__(self):
        self.redis_url = config.REDIS_URL or "redis://localhost:6379/0"
        self.channel_name = "surveillance_alerts"
        self.redis_client = None
        self.task = None

    async def start(self):
        logger.info("Starting ARGUS OS Redis listener...")
        self.redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
        self.task = asyncio.create_task(self._listen())

    async def _listen(self):
        pubsub = self.redis_client.pubsub()
        await pubsub.subscribe(self.channel_name)
        logger.info(f"Subscribed to ARGUS OS channel: {self.channel_name}")
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    logger.info(f"[ARGUS EVENT] Received: {data}")
                    await self._broadcast_to_ui(data)
        except asyncio.CancelledError:
            logger.info("ArgusListener task cancelled.")
        except Exception as e:
            logger.error(f"Error in ArgusListener: {e}")
    
    async def _broadcast_to_ui(self, raw_data: str):
        try:
            event_obj = json.loads(raw_data)
            payload = json.dumps({
                "type": "intelligence_event",
                "data": event_obj
            })
            for biz_id, sockets in socket_manager.active_connections.items():
                for ws in sockets:
                    try:
                        logger.info(f"[WS BROADCAST] Sending payload to ws for biz {biz_id}")
                        await ws.send_text(payload)
                    except Exception as e:
                        logger.error(f"Failed to send to UI websocket: {e}")
            
            # Dispatch to Workflow Engine
            from services.workflow_engine import workflow_engine
            from database.session import AsyncSessionLocal
            from sqlalchemy import select
            from database.models.workflow import Workflow
            
            async with AsyncSessionLocal() as session:
                stmt = select(Workflow.business_id).where(
                    Workflow.is_active == True,
                    Workflow.trigger_type == "intelligence_event"
                ).distinct()
                result = await session.execute(stmt)
                business_ids = result.scalars().all()
                
                for biz_id in business_ids:
                    logger.info(f"[ArgusListener] Triggering intelligence workflow for {biz_id}")
                    await workflow_engine.trigger_workflow(biz_id, "intelligence_event", event_obj)
                    
        except Exception as e:
            logger.error(f"Failed to parse or broadcast ARGUS event: {e}")

    async def stop(self):
        if self.task:
            self.task.cancel()
        if self.redis_client:
            await self.redis_client.close()

argus_listener = ArgusListener()
