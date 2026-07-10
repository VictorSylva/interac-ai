from fastapi import APIRouter
from app.api.v1 import auth, cameras, events, websocket, entities, intelligence

api_router = APIRouter()

# Authentication routes
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])

# Camera management routes
api_router.include_router(cameras.router, prefix="/cameras", tags=["cameras"])

# Surveillance events routes
api_router.include_router(events.router, prefix="/events", tags=["events"])

# WebSocket live alerts routes
api_router.include_router(websocket.router, tags=["websockets"])

# Entity Graph routes
api_router.include_router(entities.router, prefix="/entities", tags=["entities"])

# Intelligence Analytics routes
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])

