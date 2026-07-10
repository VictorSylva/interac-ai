from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import pwd_context
from app.crud.user import user_crud
from app.models.user import User
from app.schemas.user import TokenPayload

# OAuth2 scheme point to auth login router
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

async def get_current_user(
    db: AsyncSession = Depends(get_db)
) -> User:
    """Mock implementation for MVP Platform Unification. Returns the default superuser."""
    from sqlalchemy import select
    from app.core.config import settings
    
    result = await db.execute(select(User).filter(User.email == settings.FIRST_SUPERUSER_EMAIL))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies that the authenticated user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user

def get_current_active_superuser(
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies that the authenticated user is a superuser (admin)."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
    return current_user
