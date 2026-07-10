import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # business_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # user_id -> business_id (to keep track of which business an agent belongs to)
        self.agent_to_business: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, business_id: str):
        await websocket.accept()
        if business_id not in self.active_connections:
            self.active_connections[business_id] = set()
        self.active_connections[business_id].add(websocket)
        self.agent_to_business[websocket] = business_id
        logger.info(f"New agent WebSocket connection for Business {business_id}. Total: {len(self.active_connections[business_id])}")

    def disconnect(self, websocket: WebSocket):
        business_id = self.agent_to_business.get(websocket)
        if business_id and business_id in self.active_connections:
            self.active_connections[business_id].remove(websocket)
            if not self.active_connections[business_id]:
                del self.active_connections[business_id]
        if websocket in self.agent_to_business:
            del self.agent_to_business[websocket]
        logger.info(f"Agent WebSocket disconnected from Business {business_id}")

    async def broadcast_to_business(self, business_id: str, message: dict):
        if business_id in self.active_connections:
            # Create a list to avoid "Set size changed during iteration" if someone disconnects
            connections = list(self.active_connections[business_id])
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to WebSocket: {e}")
                    # Auto-cleanup if send fails
                    self.disconnect(connection)

socket_manager = ConnectionManager()
