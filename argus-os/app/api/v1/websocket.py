import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket_manager import manager

router = APIRouter()
logger = logging.getLogger("app.websocket_route")

@router.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket) -> None:
    """Real-time WebSocket endpoint that receives live security threat broadcasts."""
    await manager.connect(websocket)
    try:
        # Keep connection open. The client only needs to receive broadcasts,
        # but we keep this loop to check if client has disconnected.
        while True:
            # Wait for any heartbeat or message from the client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Unhandled WebSocket error: {e}")
        manager.disconnect(websocket)
