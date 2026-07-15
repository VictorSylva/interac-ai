import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.websocket_manager import manager

logger = logging.getLogger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles global application startup and shutdown lifespan hooks."""
    # STARTUP
    setup_logging()
    logger.info("Starting up AI Surveillance backend platform...")
    
    # 1. Spin up background Redis PubSub listener for WebSockets
    await manager.start_pubsub_listener()
    
    # 2. Dynamic Table Creation on first boot
    from app.models.base import Base
    from app.models.user import User
    from app.models.camera import Camera
    from app.models.event import Event
    from app.models.graph_models import Entity, Observation, Relationship, RiskAssessment
    from app.core.database import engine, SessionLocal
    
    logger.info("Checking database structures and initializing tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schemas verified.")

    # 3. Auto-seed Admin User
    async with SessionLocal() as db:
        admin_email = settings.FIRST_SUPERUSER_EMAIL
        admin_password = settings.FIRST_SUPERUSER_PASSWORD
        
        # Check if default admin exists
        from sqlalchemy import select
        result = await db.execute(select(User).filter(User.email == admin_email))
        admin_user = result.scalars().first()
        
        if not admin_user:
            logger.info(f"Admin user not found. Seeding default superuser: {admin_email}")
            from app.core.security import get_password_hash
            import uuid
            db_admin = User(
                id=str(uuid.uuid4()),
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                role="owner"
            )
            db.add(db_admin)
            await db.commit()
            logger.info("Default administrator seeded successfully.")
        else:
            logger.info("Administrator user already present, skipping database seeding.")

        # (Removed Mock Camera Seeding)

    yield

    # SHUTDOWN
    logger.info("Shutting down backend and cleaning up resources...")
    
    # 1. Stop WebSocket PubSub worker task
    await manager.stop_pubsub_listener()
    
    # 2. Clean up Redis connection pool
    from app.core.redis import redis_client
    await redis_client.close()
    
    logger.info("FastAPI backend teardown finalized successfully.")

# Create FastAPI app with customized configurations
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Standard CORS Middleware for cross-origin frontend dashboard integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
from fastapi.staticfiles import StaticFiles

# Register central routers
app.include_router(api_router, prefix=settings.API_V1_STR)

# Ensure static directories exist inside shared volume before mounting
os.makedirs("/var/lib/surveillance/snapshots", exist_ok=True)
os.makedirs("/var/lib/surveillance/clips", exist_ok=True)

# Mount static asset server to serve snapshots and clips to the frontend
app.mount("/static", StaticFiles(directory="/var/lib/surveillance"), name="static")

@app.get("/")
async def health_check():
    """General health metrics endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "api_prefix": settings.API_V1_STR,
    }
