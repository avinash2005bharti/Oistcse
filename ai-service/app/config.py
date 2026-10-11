import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """
    Configuration settings for the FastAPI AI Service.
    Loads from .env with fallback to system environment variables.
    """
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Groq Models
    GROQ_API_KEY: str = Field(default="", description="API key for Groq Cloud")
    GROQ_TEXT_MODEL: str = Field(
        default="openai/gpt-oss-120b",
        description="Text reasoning/tool calling model (GPT-OSS 120B)"
    )
    GROQ_VISION_MODEL: str = Field(
        default="qwen/qwen3.8-27b",
        description="Vision model for document and image processing (27B vision)"
    )

    # Service-to-Service Authentication
    AI_SERVICE_KEY: str = Field(
        default="dev_internal_microservice_secret_key_123",
        description="Shared secret key between Node gateway and FastAPI"
    )
    INTERNAL_API_SECRET: Optional[str] = Field(default=None)

    # JWT Authentication (mirrors ERP Node gateway)
    JWT_SECRET: str = Field(
        default="6LP4FBmCAQIy9KCbpbaTwLIGZC55bMeNiBFB2rW9GtMwLSgIbwJipqbw77i",
        description="JWT secret used to decode forwarded user tokens"
    )

    # ERP API base URL for delegated tool execution
    ERP_API_BASE_URL: str = Field(
        default="http://localhost:5000/api",
        description="Base REST URL for calling ERP endpoints"
    )

    # ImageKit CDN
    IMAGEKIT_PUBLIC_KEY: Optional[str] = Field(default=None)
    IMAGEKIT_PRIVATE_KEY: Optional[str] = Field(default=None)
    IMAGEKIT_URL_ENDPOINT: Optional[str] = Field(default=None)

    # Memory & Infra
    REDIS_URL: str = Field(
        default="redis://localhost:6379",
        description="Redis connection URL for sessions and pending action proposals"
    )
    MAX_AGENT_STEPS: int = Field(default=6, description="Max tool execution iterations per turn")
    PORT: int = Field(default=8000, description="FastAPI server port")

    def get_service_key(self) -> str:
        """Returns AI_SERVICE_KEY or fallback INTERNAL_API_SECRET."""
        return self.AI_SERVICE_KEY or self.INTERNAL_API_SECRET or ""

    def get_text_model(self) -> str:
        """Returns text model identifier."""
        return os.getenv("GROQ_TEXT_MODEL") or os.getenv("GROQ_REASONING_MODEL") or self.GROQ_TEXT_MODEL

    def get_vision_model(self) -> str:
        """Returns vision model identifier."""
        return os.getenv("GROQ_VISION_MODEL") or self.GROQ_VISION_MODEL


settings = Settings()
