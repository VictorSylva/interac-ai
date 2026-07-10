from .base_config import BaseConfig

class DevConfig(BaseConfig):
    ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    ENABLE_DEV_TOOLS: bool = True
