from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

# Import all tools to trigger registration in GLOBAL_TOOL_REGISTRY
import app.tools.student_tools
import app.tools.teacher_tools
import app.tools.tg_tools
import app.tools.hod_tools
import app.tools.admin_tools
import app.tools.document_tools

from app.api.health import router as health_router
from app.api.chat import router as chat_router
from app.api.confirm import router as confirm_router
from app.config import settings
from app.agents.factory import agent_factory

app = FastAPI(
    title="CampusFlow ERP Multi-Agent AI Service",
    description="Production-grade Role-Based AI Agents running on Groq (GPT-OSS 120B + 27B Vision Model) with delegated JWT identity, human-in-the-loop proposals, and streaming realtime events.",
    version="2.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(confirm_router)


@app.on_event("startup")
async def startup_event():
    logger.info("[AI Service] CampusFlow AI Agent Microservice initialized successfully.")
    logger.info(f"[AI Service] Using Text Model: {settings.get_text_model()}")
    logger.info(f"[AI Service] Using Vision Model: {settings.get_vision_model()}")
    logger.info(f"[AI Service] ERP Base API: {settings.ERP_API_BASE_URL}")


# Root endpoint
@app.get("/")
async def root():
    return {
        "service": "CampusFlow ERP Multi-Agent AI Service",
        "status": "online",
        "documentation": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
