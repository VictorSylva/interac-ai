from typing import Any, Dict, Optional, Union
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password

class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    """Repository class managing User persistence and credentials operations."""

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Query a user by their registered email address."""
        query = select(User).filter(User.email == email)
        result = await db.execute(query)
        return result.scalars().first()

    async def authenticate(
        self, db: AsyncSession, email: str, password: str
    ) -> Optional[User]:
        """Authenticate user credentials using bcrypt checks."""
        user = await self.get_by_email(db, email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def create(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        """Create a user with an encrypted/hashed password."""
        db_obj = User(
            email=obj_in.email,
            hashed_password=get_password_hash(obj_in.password),
            is_active=True,
            is_superuser=False,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: User, obj_in: Union[UserUpdate, Dict[str, Any]]
    ) -> User:
        """Updates user details, auto-hashing the password if modified."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
            
        if "password" in update_data and update_data["password"]:
            update_data["hashed_password"] = get_password_hash(update_data["password"])
            del update_data["password"]
            
        return await super().update(db, db_obj=db_obj, obj_in=update_data)

user_crud = CRUDUser(User)
