from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import SessionLocal

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provides an asynchronous database session for requests."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
