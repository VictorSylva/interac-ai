from sqlalchemy import Boolean, Column, Integer, String
from app.models.base import Base

class User(Base):
    """Database model representing a platform user."""
    __tablename__ = "argus_users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="agent")

    @property
    def hashed_password(self):
        return self.password_hash

    @property
    def is_active(self):
        return True

    @property
    def is_superuser(self):
        return self.role == "owner"
