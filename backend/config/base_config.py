import os
from typing import Optional, List
from pydantic import BaseModel, Field

class BaseConfig(BaseModel):
    ENV: str = Field(default="development")
    DEBUG: bool = Field(default=True)
    LOG_LEVEL: str = Field(default="DEBUG")
    
    # Server Settings
    PORT: int = Field(default=8000)
    HOST: str = Field(default="0.0.0.0")
    
    # Database Settings
    DATABASE_URL: str
    REDIS_URL: Optional[str] = None
    ARGUS_CORE_URL: str = Field(default="http://argus_core:8003")
    
    # AI Provider Settings
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = Field(default="deepseek/deepseek-chat")
    OPENROUTER_REFERER: str = Field(default="https://interact-ai.com")
    OPENROUTER_TITLE: str = Field(default="Interact AI Platform")
    
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = Field(default="gemini-pro")
    
    # WhatsApp Settings
    WHATSAPP_VERIFY_TOKEN: Optional[str] = None
    WHATSAPP_API_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    
    # Security & CORS
    SECRET_KEY: str = Field(default="insecure-default-key-change-me")
    ALLOWED_ORIGINS: List[str] = Field(default=["https://interacai.com", "http://localhost:3000"])
    FRONTEND_URL: str = Field(default="http://localhost:3000")
    
    # Paystack Settings
    PAYSTACK_SECRET_KEY: Optional[str] = None
    PAYSTACK_PUBLIC_KEY: Optional[str] = None
    
    # Feature Flags
    ENABLE_DEV_TOOLS: bool = Field(default=True)
    STRICT_PROD_MODE: bool = Field(default=False)
    
    # Billing Settings
    COST_PER_TOKEN: float = Field(default=0.001) # Default cost per token in NGN or USD
    
    class Config:
        extra = "ignore"
