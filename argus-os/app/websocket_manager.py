import asyncio
import json
import logging
from typing import Optional, Set
from fastapi import WebSocket
from app.core.redis import redis_client

logger = logging.getLogger("app.websocket")

class WebSocketManager:
    """Manages active local WebSocket connections and bridges them with a Redis PubSub broker."""
    
    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        self.redis_channel = "surveillance_alerts"
        self._pubsub_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket) -> None:
        """Accepts a connection and registers it in the local active connections pool."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(
            f"New WebSocket client connected. Active connections on this instance: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Deregisters a closed/disconnected client from the pool."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(
                f"WebSocket client disconnected. Remaining active connections: {len(self.active_connections)}"
            )

    async def publish_event(self, event_data: dict) -> None:
        """Publishes a new alert to the global Redis PubSub network for distribution."""
        try:
            message_str = json.dumps(event_data)
            await redis_client.publish(self.redis_channel, message_str)
            logger.info(f"Successfully published alert to Redis PubSub channel: {self.redis_channel}")
        except Exception as e:
            logger.error(f"Failed to publish alert to Redis: {e}")

    async def _local_broadcast(self, message: str) -> None:
        """Pushes a message to all locally connected client WebSockets."""
        if not self.active_connections:
            return
            
        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Error sending message to client: {e}")
                disconnected.append(connection)
                
        # Safely clean up dead sockets
        for connection in disconnected:
            self.disconnect(connection)

    async def start_pubsub_listener(self) -> None:
        """Spawns the background task that listens to Redis updates."""
        self._pubsub_task = asyncio.create_task(self._pubsub_loop())
        logger.info("Initialized global Redis PubSub listening thread.")

    async def stop_pubsub_listener(self) -> None:
        """Cancels and cleans up the background Redis listener task."""
        if self._pubsub_task:
            self._pubsub_task.cancel()
            try:
                await self._pubsub_task
            except asyncio.CancelledError:
                pass
            logger.info("Terminated global Redis PubSub listening thread.")

    async def _pubsub_loop(self) -> None:
        """Subscriber loop listening for real-time alerts published to Redis."""
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(self.redis_channel)
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    await self._local_broadcast(data)
        except asyncio.CancelledError:
            logger.info("PubSub listener task cancelled successfully.")
        except Exception as e:
            logger.error(f"Error in Redis PubSub subscription listener: {e}")
        finally:
            await pubsub.unsubscribe(self.redis_channel)

manager = WebSocketManager()
