import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("app.core.redis")

# Initialize Redis client using settings
redis_client = aioredis.from_url(
    settings.REDIS_URI,
    decode_responses=True
)

async def check_redis_connection() -> bool:
    """Verifies that Redis is reachable."""
    try:
        await redis_client.ping()
        return True
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        return False
