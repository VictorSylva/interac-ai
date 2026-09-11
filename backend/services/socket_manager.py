import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # business_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> Set[str] of registered business IDs/aliases
        self.websocket_to_businesses: Dict[WebSocket, Set[str]] = {}

    async def connect(self, websocket: WebSocket, business_id: str):
        await websocket.accept()
        keys_to_register = {business_id}
        try:
            from services.db_service import resolve_business_id
            real_id = await resolve_business_id(business_id)
            if real_id:
                keys_to_register.add(real_id)
        except Exception as e:
            logger.warning(f"Could not resolve additional business_id in socket connect: {e}")

        self.websocket_to_businesses[websocket] = keys_to_register
        for k in keys_to_register:
            if k not in self.active_connections:
                self.active_connections[k] = set()
            self.active_connections[k].add(websocket)
        logger.info(f"New agent WebSocket connection for {keys_to_register}. Total sockets: {len(self.websocket_to_businesses)}")

    def disconnect(self, websocket: WebSocket):
        keys = self.websocket_to_businesses.pop(websocket, set())
        for k in keys:
            if k in self.active_connections:
                self.active_connections[k].discard(websocket)
                if not self.active_connections[k]:
                    del self.active_connections[k]
        logger.info(f"Agent WebSocket disconnected from {keys}")

    async def broadcast_to_business(self, business_id: str, message: dict):
        targets = {business_id}
        try:
            from services.db_service import resolve_business_id
            real_id = await resolve_business_id(business_id)
            if real_id:
                targets.add(real_id)
        except Exception:
            pass

        sent_sockets = set()
        for target in targets:
            if target in self.active_connections:
                for connection in list(self.active_connections[target]):
                    if connection not in sent_sockets:
                        sent_sockets.add(connection)
                        try:
                            await connection.send_json(message)
                        except Exception as e:
                            logger.error(f"Error broadcasting to WebSocket: {e}")
                            self.disconnect(connection)

socket_manager = ConnectionManager()

