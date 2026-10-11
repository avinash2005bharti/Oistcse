from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.get("/v1/health")
async def health_check():
    """Health check endpoint for the FastAPI AI Service."""
    return {
        "status": "ok",
        "service": "campusflow-ai-service",
        "version": "2.0.0",
        "text_model": settings.get_text_model(),
        "vision_model": settings.get_vision_model(),
        "erp_api_url": settings.ERP_API_BASE_URL
    }
