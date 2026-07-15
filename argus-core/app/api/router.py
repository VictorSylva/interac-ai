from fastapi import APIRouter
from app.api.v1 import observations, world_model, context, timeline, investigations, copilot

api_router = APIRouter()

# Register v1 routes
api_router.include_router(observations.router, prefix="/observations", tags=["observations"])
api_router.include_router(world_model.router, prefix="/world-model", tags=["world-model"])
api_router.include_router(context.router, prefix="/context", tags=["context"])
api_router.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
api_router.include_router(investigations.router, prefix="/investigations", tags=["investigations"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
