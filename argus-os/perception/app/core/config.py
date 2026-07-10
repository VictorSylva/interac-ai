import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Surveillance Camera Services"
    API_V1_STR: str = "/api/v1"

    # Backend Endpoint Configurations
    BACKEND_API_URL: str = "http://backend:8000/api/v1"

    # Backend Authentication (Self-identity for event post authentication)
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str

    # Local Directory to write snapshots and clips
    STORAGE_DIR: str = "/var/lib/surveillance"

    # Event buffers
    PRE_EVENT_DURATION_SECONDS: int = 5
    POST_EVENT_DURATION_SECONDS: int = 5

    # CPU Optimization Settings
    USE_MOCK_INFERENCE: bool = True
    AI_FRAME_SKIP: int = 3

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()

# Ensure storage subdirectories exist for snapshots and clips
os.makedirs(os.path.join(settings.STORAGE_DIR, "snapshots"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "clips"), exist_ok=True)
