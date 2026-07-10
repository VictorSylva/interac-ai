from .base_config import BaseConfig
import logging

class ProdConfig(BaseConfig):
    ENV: str = "production"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    ENABLE_DEV_TOOLS: bool = False
    STRICT_PROD_MODE: bool = True
    
    # Validation for production
    def validate_production(self):
        if not self.OPENROUTER_API_KEY and not self.GEMINI_API_KEY:
            raise ValueError("Production requires at least one AI provider API key.")
        
        if self.SECRET_KEY == "insecure-default-key-change-me":
            logging.warning("SECRET_KEY is using insecure default in production!")
            
        if "localhost" in self.DATABASE_URL or "127.0.0.1" in self.DATABASE_URL:
            raise ValueError("Production environment cannot use a local database URL.")
