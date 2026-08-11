import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from sqlalchemy.pool import NullPool

from config import config
import logging

logger = logging.getLogger(__name__)

DATABASE_URL = config.DATABASE_URL

# Safety Guard: Prevent production from using local DB, and dev from using prod-like DB
def validate_db_env():
    is_prod = config.ENV == "production"
    is_local_db = "localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL
    
    if is_prod and is_local_db:
        logger.error("CRITICAL: Production environment detected with LOCAL database URL. Aborting for safety.")
        raise ValueError("Production cannot use localhost database.")
    
    if not is_prod and not is_local_db and config.STRICT_PROD_MODE:
         # Optional: Add warnings if dev is using what looks like a remote/prod DB
         logger.warning(f"Development environment using remote database: {DATABASE_URL.split('@')[-1]}")

validate_db_env()

# Ensure the URL is correctly formatted for asyncpg if provided via env
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

import sys
from sqlalchemy.pool import NullPool

# Use NullPool to avoid issues with Celery prefork pool and separate event loops.
# For FastAPI/Uvicorn, use standard connection pooling to reuse database connections.
is_celery_worker = any("celery" in arg for arg in sys.argv)

if is_celery_worker:
    engine = create_async_engine(DATABASE_URL, echo=config.DEBUG, poolclass=NullPool)
else:
    engine = create_async_engine(
        DATABASE_URL,
        echo=config.DEBUG,
        pool_size=4,
        max_overflow=2,
        pool_recycle=1800
    )


AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
