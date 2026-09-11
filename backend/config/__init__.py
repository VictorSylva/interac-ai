import os
import logging
from dotenv import load_dotenv
from .dev_config import DevConfig
from .prod_config import ProdConfig

logger = logging.getLogger(__name__)

def load_config():
    # 1. Determine environment
    env = os.getenv("ENV", "development").lower()
    
    # 2. Load appropriate .env file
    if env == "production":
        env_file = ".env.production"
    elif env == "staging":
        env_file = ".env.staging"
    else:
        env_file = ".env.local"
    
    if os.path.exists(env_file):
        load_dotenv(env_file)
        logger.info(f"Loaded environment variables from {env_file}")
    elif os.path.exists(".env.development"):
        load_dotenv(".env.development")
        logger.info("Loaded environment variables from .env.development")
    elif os.path.exists(".env"):
        load_dotenv(".env")
        logger.info("Loaded environment variables from .env")
    else:
        logger.warning(f"No environment file found ({env_file} or .env.development or .env)")

    # 3. Create config object based on ENV
    config_dict = {
        key: os.getenv(key) 
        for key in [
            "ENV", "DEBUG", "LOG_LEVEL", "PORT", "HOST", 
            "DATABASE_URL", "REDIS_URL", "OPENROUTER_API_KEY", 
            "OPENROUTER_MODEL", "OPENROUTER_REFERER", "OPENROUTER_TITLE",
            "GEMINI_API_KEY", "GEMINI_MODEL", "WHATSAPP_VERIFY_TOKEN",
            "WHATSAPP_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "SECRET_KEY",
            "PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY", "FRONTEND_URL",
            "COST_PER_TOKEN", "ARGUS_CORE_URL", "RESEND_API_KEY", "DEFAULT_FROM_EMAIL"
        ]
        if os.getenv(key) is not None
    }

    # Handle ALLOWED_ORIGINS list
    allowed_origins = os.getenv("ALLOWED_ORIGINS")
    if allowed_origins:
        config_dict["ALLOWED_ORIGINS"] = [origin.strip().rstrip("/") for origin in allowed_origins.split(",")]
    else:
        # Default fallback list prioritizing Namecheap custom domain and Firebase preview
        config_dict["ALLOWED_ORIGINS"] = [
            "https://interacai.com", 
            "https://www.interacai.com",
            "https://interac-ai.web.app",
            "https://interacai-prod.firebaseapp.com",
            "http://localhost:3000"
        ]
        
    # Dynamically append FRONTEND_URL to ALLOWED_ORIGINS to prevent CORS issues
    frontend_url = config_dict.get("FRONTEND_URL")
    if frontend_url:
        frontend_url = frontend_url.strip().rstrip("/")
        config_dict["FRONTEND_URL"] = frontend_url
        if frontend_url not in config_dict["ALLOWED_ORIGINS"]:
            config_dict["ALLOWED_ORIGINS"].append(frontend_url)
    # Handle simple boolean conversions if provided via env
    for bool_key in ["DEBUG", "ENABLE_DEV_TOOLS", "STRICT_PROD_MODE"]:
        val = os.getenv(bool_key)
        if val is not None:
            config_dict[bool_key] = val.lower() in ("true", "1", "yes")

    # Safety Fallback for FRONTEND_URL in staging/production
    if env in ["staging", "production"] and (not config_dict.get("FRONTEND_URL") or "localhost" in config_dict.get("FRONTEND_URL")):
        config_dict["FRONTEND_URL"] = "https://interacai.com"
        logger.warning(f"FRONTEND_URL was missing or local in {env} mode. Falling back to {config_dict['FRONTEND_URL']}")

    try:
        if env in ["production", "staging"]:
            config = ProdConfig(**config_dict)
            if env == "production":
                config.validate_production()
            else:
                config.ENV = "staging"
                config.DEBUG = True # Allow debug in staging if needed
        elif env == "development":
            config = DevConfig(**config_dict)
        else:
            raise ValueError(f"Unknown environment: {env}. Must be 'development', 'staging', or 'production'.")
            
        return config
    except Exception as e:
        logger.error(f"Configuration failed for environment '{env}': {e}")
        # Re-raise to prevent startup on misconfiguration
        raise 

# Singleton instance
config = load_config()
