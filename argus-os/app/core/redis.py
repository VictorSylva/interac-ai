import redis.asyncio as aioredis
from app.core.config import settings

# Global async Redis client pool with string decoding enabled
redis_client: aioredis.Redis = aioredis.from_url(
    settings.REDIS_URI,
    encoding="utf-8",
    decode_responses=True
)

async def get_redis() -> aioredis.Redis:
    """Dependency injection helper to obtain Redis client."""
    return redis_client
