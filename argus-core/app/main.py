import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings

# Setup logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan hook to configure startup and shutdown database tasks."""
    # STARTUP
    logger.info("Starting up ARGUS Core Intelligence Service...")
    
    # 1. Database table initialization
    from app.models.base import Base
    from app.models.observation import Observation
    from app.models.graph import Entity, Relationship, RiskAssessment
    from app.models.investigation import Investigation
    from app.core.database import engine
    from sqlalchemy import text
    
    logger.info("Checking database structures and initializing tables...")
    async with engine.begin() as conn:
        # Recreate observations and graph tables to ensure all new columns align
        await conn.execute(text("DROP TABLE IF EXISTS observations;"))
        await conn.run_sync(Base.metadata.create_all)
        # Verify and apply schema extension in case table was already created by argus-os
        await conn.execute(text("ALTER TABLE entities ADD COLUMN IF NOT EXISTS external_ref_id VARCHAR;"))
    logger.info("Database schemas verified and alterations applied.")
    
    # 2. Redis Connection verification
    from app.core.redis import check_redis_connection
    redis_alive = await check_redis_connection()
    if redis_alive:
        logger.info("Redis PubSub connection successfully verified.")
    else:
        logger.warning("Redis is currently offline or unreachable. Observations will not be broadcast.")

    yield
    
    # SHUTDOWN
    logger.info("Cleaning up ARGUS Core resources...")
    from app.core.redis import redis_client
    await redis_client.close()
    logger.info("ARGUS Core teardown finalized.")

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Standard CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def health_check():
    """General health metrics endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "api_prefix": settings.API_V1_STR,
    }
