import os
import hmac
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from loguru import logger
from dotenv import load_dotenv

# Load Environment Variables
load_dotenv()

from agents.orchestrator import central_orchestrator
from scheduler.optimizer import scheduler_optimizer
from scheduler.absence_adjuster import absence_adjuster
from tools.postgres_tools import postgres_tools
from tools.file_generator import timetable_file_generator
from rag.document_processor import document_processor
from rag.qdrant_manager import qdrant_manager
from memory.mongo_memory import mongo_memory
from memory.langchain_memory import langchain_memory
from llm.provider import llm_provider
from file_processing.file_type_router import file_type_router
from file_processing.imagekit_client import imagekit_client

INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")


def _verified_agent_user(req: "AuthenticatedAgentRequest", internal_secret: Optional[str]) -> Dict[str, Any]:
    if not INTERNAL_API_SECRET or not internal_secret or not hmac.compare_digest(INTERNAL_API_SECRET, internal_secret):
        raise HTTPException(status_code=401, detail="Authenticated Node.js gateway required.")

    identity = req.user
    if not isinstance(identity, dict):
        raise HTTPException(status_code=401, detail="Verified user context is required.")

    user_id = str(identity.get("id") or identity.get("userId") or "")
    role = str(identity.get("role") or "")
    permissions = identity.get("permissions")
    if (
        not user_id
        or user_id != str(req.user_id or "")
        or not role
        or not isinstance(permissions, list)
        or role.upper() != str(req.role or "").upper()
    ):
        raise HTTPException(status_code=403, detail="Authenticated identity context is incomplete or inconsistent.")
    return identity


app = FastAPI(
    title="CSE Department AI Agentic Microservice",
    description="Cloud-Ready Multi-Agent Microservice powering AI Timetable Generation, Intelligent Teacher Scheduling, Qdrant Vector LTM/RAG, and MongoDB STM for the Computer Science & Engineering Department.",
    version="2.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Role-Based AI Agent Routers (implementation.md)
try:
    from app.api.health import router as role_health_router
    from app.api.chat import router as role_chat_router
    from app.api.confirm import router as role_confirm_router
    app.include_router(role_health_router)
    app.include_router(role_chat_router)
    app.include_router(role_confirm_router)
except Exception as e:
    logger.warning(f"[Main Router Mount Note] {e}")

# ----------------- Request Models -----------------
class AuthenticatedAgentRequest(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
    user: Optional[Dict[str, Any]] = None


class ChatRequest(AuthenticatedAgentRequest):
    user_id: Optional[str] = Field(default=None, description="ID of the authenticated user")
    role: Optional[str] = Field(default=None, description="Authenticated user role")
    prompt: Optional[str] = Field(default=None, description="User query text")
    message: Optional[str] = Field(default=None, description="Alternative field for user query text")
    conversation_id: Optional[str] = Field(default=None, description="Unique conversation thread ID")
    conversationId: Optional[str] = Field(default=None, description="Alternative field for conversation ID")
    agent: Optional[str] = Field(default=None, description="Specific targeted agent (e.g. 'timetable')")
    context_history: Optional[List[Dict[str, str]]] = Field(default=None, description="Recent conversation turns")
    file_id: Optional[str] = Field(default=None, description="Uploaded file identifier")
    attachment: Optional[Dict[str, Any]] = Field(default=None, description="Attached file metadata")

class GenerateTimetableRequest(AuthenticatedAgentRequest):
    department: Optional[str] = Field(default=None)
    year: str = Field(default="3rd Year")
    semester: int = Field(default=5)
    section: str = Field(default="A")
    academic_year: str = Field(default="2026-27")
    working_days: Optional[List[str]] = Field(default_factory=list)
    breaks: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    custom_constraints: Optional[List[str]] = Field(default_factory=list)
    custom_subjects: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    period_timings: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    start_time: Optional[str] = Field(default="09:00 AM")
    period_duration_minutes: Optional[int] = Field(default=50)
    periods_per_day: Optional[int] = Field(default=7)
    created_by: Optional[str] = None

class AnalyzeAbsenceRequest(AuthenticatedAgentRequest):
    teacher_name: str = Field(..., description="Name or partial name of absent teacher")
    date: Optional[str] = Field(default=None, description="Date in YYYY-MM-DD format")
    day: Optional[str] = Field(default=None, description="Day name, e.g. Monday")
    department: Optional[str] = None

class ApplySubstitutionRequest(AuthenticatedAgentRequest):
    absence_data: Dict[str, Any] = Field(..., description="Substitution proposal payload generated by /analyze")
    department: Optional[str] = None
    confirmed: bool = False

class ExportTimetableRequest(AuthenticatedAgentRequest):
    department: Optional[str] = None
    year: str = Field(default="3rd Year")
    semester: int = Field(default=5)
    section: str = Field(default="A")
    academic_year: str = Field(default="2026-27")
    version: int = Field(default=1)

class IndexDocumentRequest(AuthenticatedAgentRequest):
    noteId: Optional[int] = None
    filePath: str = Field(..., description="Absolute path to the uploaded document on disk")
    fileName: Optional[str] = None
    title: str = Field(..., description="Title of the academic document")
    category: str = Field(default="Notes")
    subjectId: Optional[int] = None
    year: Optional[str] = None
    semester: Optional[int] = None

class RAGSearchRequest(AuthenticatedAgentRequest):
    query: str = Field(..., description="Semantic search query")
    department: Optional[str] = None
    collection: Optional[str] = Field(default=None)
    top_k: int = Field(default=4)

class FileProcessRequest(AuthenticatedAgentRequest):
    file_id: str = Field(..., description="MongoDB FileDocument ID")
    file_url: str = Field(..., description="ImageKit URL or local URL")
    filename: str = Field(..., description="Original filename")
    mime_type: str = Field(default="", description="MIME type")
    file_type: str = Field(default="", description="Detected file type")
    conversation_id: Optional[str] = Field(default=None)
    department_id: Optional[str] = Field(default=None)
    department_code: Optional[str] = Field(default=None)
    local_path: Optional[str] = Field(default=None, description="Local path to file if available")

# ----------------- Routes -----------------

@app.get("/")
def root():
    return {
        "service": "CSE Department AI Agentic Microservice",
        "department": "Computer Science & Engineering",
        "status": "Online",
        "docs": "/docs",
        "vector_engine": "Qdrant Cloud / Embedded (768 Dimensions)",
        "short_term_memory": "LangChain STM (MongoChatMessageHistory + LangChainShortTermMemory)",
        "long_term_memory": "LangChain LTM (Qdrant erp_long_term_memory + MongoDB users_memory + LangChainLTMRetriever)",
        "document_rag": "Qdrant (erp_documents)",
        "scheduling_engine": "Deterministic Constraint Optimization Engine (CSP)",
        "academic_source_of_truth": "PostgreSQL"
    }

@app.get("/health")
def health_check():
    db_type, conn = postgres_tools._get_connection()
    pg_active = conn is not None
    if conn:
        try:
            conn.close()
        except Exception:
            pass

    return {
        "status": "UP",
        "service": "FastAPI AI Microservice",
        "qdrant_status": "Ready",
        "qdrant_collections": ["erp_long_term_memory", "erp_documents", "Notes", "Circulars"],
        "mongo_status": "Ready" if mongo_memory.client else "Cache Mode",
        "langchain_memory_status": "Ready",
        "postgresql_status": f"Ready ({db_type})" if pg_active else "Unavailable",
        "database": "postgresql",
        "llm_provider": llm_provider.__class__.__name__,
        "llm_configured": llm_provider.is_configured(),
        "active_agents": [
            "ERPAssistantAgent",
            "TimetableAgent",
            "TeacherSchedulingAgent",
            "TeacherAbsenceAgent",
            "AttendanceAgent",
            "LeaveManagementAgent",
            "AcademicInformationAgent",
            "RAGAgent",
            "ReportingAgent",
            "FileGenerationAgent",
            "MemoryAgent"
        ]
    }

@app.get("/ai/memory/user/{user_id}")
def get_user_memory_api(
    user_id: str,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret"),
    authenticated_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
    authenticated_department: Optional[str] = Header(default=None, alias="x-user-department")
):
    """
    Retrieves a user's complete LangChain Long-Term Memory (LTM) and profile facts.
    """
    if not INTERNAL_API_SECRET or not internal_secret or not hmac.compare_digest(INTERNAL_API_SECRET, internal_secret):
        raise HTTPException(status_code=401, detail="Authenticated Node.js gateway required.")
    if authenticated_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access to another user's memory is denied.")
    if not authenticated_department:
        raise HTTPException(status_code=403, detail="A verified department scope is required.")
    profile = langchain_memory.ltm.get_user_profile(user_id)
    mongo_facts = langchain_memory.ltm.get_user_facts(user_id)
    ltm_docs = langchain_memory.ltm.retrieve_relevant_facts(
        query="academic interests, preferences, and performance constraints",
        user_id=user_id,
        department=authenticated_department,
        top_k=10
    )
    semantic_facts = [d.page_content for d in ltm_docs]
    all_facts = list(dict.fromkeys(semantic_facts + mongo_facts))

    return {
        "user_id": user_id,
        "department": authenticated_department,
        "profile": profile,
        "long_term_facts": all_facts,
        "semantic_documents_count": len(ltm_docs)
    }

@app.get("/ai/memory/session/{session_id}")
def get_session_memory_api(
    session_id: str,
    user_id: str,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret"),
    authenticated_user_id: Optional[str] = Header(default=None, alias="x-user-id")
):
    """
    Retrieves the active LangChain Short-Term Memory (STM) state for a conversation session.
    """
    if not INTERNAL_API_SECRET or not internal_secret or not hmac.compare_digest(INTERNAL_API_SECRET, internal_secret):
        raise HTTPException(status_code=401, detail="Authenticated Node.js gateway required.")
    if authenticated_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access to another user's session is denied.")
    stm = langchain_memory.get_stm(session_id=session_id, user_id=user_id)
    messages = stm.get_messages(limit=20)
    task_context = stm.get_task_context()
    recent_constraints = stm.get_recent_constraints()
    pending_approval = stm.get_pending_approval()
    summary = stm.get_session_summary()

    return {
        "session_id": session_id,
        "user_id": user_id,
        "message_count": len(messages),
        "history_preview": stm.get_history_as_string(limit=6),
        "task_context": task_context,
        "recent_constraints": recent_constraints,
        "pending_approval": pending_approval,
        "session_summary": summary
    }

@app.get("/health/db")
def health_db():
    db_type, conn = postgres_tools._get_connection()
    active = conn is not None
    if conn:
        try:
            conn.close()
        except Exception:
            pass
    return {
        "status": "UP" if active else "DOWN",
        "database": "postgresql",
        "dialect": db_type,
        "mongo_connected": mongo_memory.client is not None
    }

@app.get("/health/qdrant")
def health_qdrant():
    try:
        collections = [c.name for c in qdrant_manager.client.get_collections().collections]
        return {"status": "UP", "engine": "Qdrant", "collections": collections}
    except Exception as e:
        return {"status": "DEGRADED", "error": str(e), "engine": "Qdrant"}

@app.get("/health/ai")
def health_ai():
    return {
        "status": "UP",
        "llm_provider": llm_provider.__class__.__name__,
        "llm_configured": llm_provider.is_configured(),
        "embedding_provider": "LocalDenseEmbedding (768-dim L2 Normalized)",
        "orchestrator": "CentralAgentOrchestrator"
    }

@app.post("/ai/chat")
def chat_endpoint(req: ChatRequest, internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")):
    """
    Central Multi-Agent Chat Entrypoint.
    Executes CentralAgentOrchestrator pipeline (Intent Detection -> Selective Agent Selection -> Tool Execution).
    """
    try:
        verified_user = _verified_agent_user(req, internal_secret)
        user_id = str(verified_user["id"])
        user_role = str(verified_user["role"]).lower()
        query_text = (req.prompt or req.message or "").strip()
        conv_id = req.conversation_id or req.conversationId or f"conv_{int(datetime.utcnow().timestamp())}"
        target_agent = (req.agent or "").lower()

        if not query_text:
            raise HTTPException(status_code=400, detail="A message or prompt text is required.")

        # Save user message to MongoDB STM
        mongo_memory.save_message(
            conversation_id=conv_id,
            user_id=user_id,
            role=user_role,
            sender="user",
            content=query_text
        )

        # Resolve attached file ID
        resolved_file_id = req.file_id
        if not resolved_file_id and isinstance(req.attachment, dict):
            resolved_file_id = req.attachment.get("id") or req.attachment.get("_id") or req.attachment.get("file_id")

        # Execute autonomous agent orchestration
        result = central_orchestrator.orchestrate(
            prompt=query_text,
            user_id=user_id,
            role=user_role,
            conversation_id=conv_id,
            target_agent=target_agent,
            context_history=req.context_history,
            user_context=verified_user,
            file_id=resolved_file_id,
            attachment=req.attachment
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Chat Endpoint Error]: {e}")
        raise HTTPException(status_code=500, detail=f"AI Agent execution error: {str(e)}")

@app.post("/ai/chat/stream")
def chat_stream_endpoint(req: ChatRequest, internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")):
    """SSE adapter for the same authenticated operational runtime used by /ai/chat."""
    from fastapi.responses import StreamingResponse

    result = chat_endpoint(req, internal_secret)

    def event_stream():
        for call in result.get("tool_calls", []):
            yield "data: " + json.dumps({
                "type": "tool_result",
                "tool": call.get("tool"),
                "success": call.get("success") is True
            }) + "\n\n"
        final_event = {
            "type": "final",
            "success": result.get("success") is True,
            "answer": result.get("answer", ""),
            "agent_used": result.get("agent_used"),
            "actions_taken": result.get("actions_taken", []),
            "requires_confirmation": result.get("requires_confirmation", False),
            "confirmation_prompt": result.get("confirmation_prompt")
        }
        yield "data: " + json.dumps(final_event, default=str) + "\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ----------------- Dedicated Timetable & Scheduler API -----------------

@app.post("/ai/timetable/generate")
async def generate_timetable_api(
    req: GenerateTimetableRequest,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")
):
    """
    Deterministic Timetable Generator Endpoint:
    Queries authoritative PostgreSQL tables -> executes CSP constraint optimizer -> saves new version in PostgreSQL -> outputs XLSX & PDF.
    """
    verified_user = _verified_agent_user(req, internal_secret)
    role = str(verified_user.get("role") or "").upper()
    if role not in {"HOD", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only an HOD or administrator may generate a timetable.")
    department = req.department or verified_user.get("departmentCode")
    if not department:
        raise HTTPException(status_code=400, detail="A department is required to generate a timetable.")
    if role == "HOD" and str(department).casefold() != str(verified_user.get("departmentCode") or "").casefold():
        raise HTTPException(status_code=403, detail="An HOD may only generate timetables for their department.")

    try:
        subjects = postgres_tools.get_all_subjects(semester=req.semester, department=department)
        faculty_list = postgres_tools.get_all_faculty(department=department)
        rooms = postgres_tools.get_all_rooms(department=department)

        opt_res = scheduler_optimizer.generate_timetable(
            department=department,
            year=req.year,
            semester=req.semester,
            section=req.section,
            subjects=subjects,
            faculty_list=faculty_list,
            rooms=rooms,
            custom_constraints=req.custom_constraints,
            custom_subjects=req.custom_subjects,
            period_timings=req.period_timings,
            start_time=req.start_time,
            period_duration_minutes=req.period_duration_minutes,
            periods_per_day=req.periods_per_day,
            working_days=req.working_days
        )

        slots = opt_res.get("timetable_slots", [])
        metrics = opt_res.get("metrics", {})
        conflicts = opt_res.get("conflicts", [])
        if conflicts:
            raise HTTPException(
                status_code=422,
                detail={"message": "The optimizer found timetable conflicts; no timetable was saved.", "conflicts": conflicts}
            )
        if not slots:
            raise HTTPException(status_code=422, detail="The optimizer returned no timetable slots; nothing was saved.")

        # Save to PostgreSQL
        master_id = postgres_tools.save_new_timetable_version(
            department=department,
            year=req.year,
            semester=req.semester,
            section=req.section,
            academic_year=req.academic_year,
            slots=slots,
            stats=metrics,
            created_by=verified_user.get("name") or verified_user["id"]
        )
        if not master_id:
            raise HTTPException(status_code=500, detail="The timetable transaction could not be committed.")

        master_row = postgres_tools.get_timetable_master(
            req.semester,
            req.section,
            department,
            req.academic_year
        )
        if not master_row or str(master_row.get("id")) != str(master_id):
            raise HTTPException(status_code=500, detail="The saved timetable version could not be verified.")
        version_num = master_row.get("version", 1) if master_row else 1
        saved_slots = postgres_tools.get_timetable(
            semester=req.semester,
            section=req.section,
            department=department,
            academic_year=req.academic_year,
            version=version_num
        )
        if (
            len(saved_slots) != len(slots)
            or not postgres_tools.timetable_version_matches(master_id, slots)
        ):
            raise HTTPException(status_code=500, detail="The saved timetable did not match the generated result.")

        excel_info = timetable_file_generator.generate_excel(
            department, req.year, req.semester, req.section, req.academic_year, version_num, saved_slots, metrics
        )
        pdf_info = timetable_file_generator.generate_pdf(
            department, req.year, req.semester, req.section, req.academic_year, version_num, saved_slots, metrics
        )

        return {
            "success": True,
            "master_id": master_id,
            "version": version_num,
            "department": department,
            "year": req.year,
            "semester": req.semester,
            "section": req.section,
            "slots_count": len(saved_slots),
            "metrics": metrics,
            "conflicts": conflicts,
            "files": {
                "excel": excel_info,
                "pdf": pdf_info
            },
            "slots": saved_slots
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Generate Timetable API Error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/teacher-scheduler/analyze")
async def analyze_absence_api(
    req: AnalyzeAbsenceRequest,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")
):
    """
    Teacher Absence & Substitution Analysis Endpoint:
    Finds affected classes for absent faculty and ranks feasible substitutes deterministically.
    """
    verified_user = _verified_agent_user(req, internal_secret)
    role = str(verified_user.get("role") or "").upper()
    department = req.department or verified_user.get("departmentCode")
    if not req.confirmed:
        raise HTTPException(status_code=409, detail="Explicit confirmation is required before applying substitutions.")
    if role not in {"HOD", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only an HOD or administrator may analyze department substitutions.")
    if not department:
        raise HTTPException(status_code=400, detail="A department scope is required.")
    if role == "HOD" and str(department).casefold() != str(verified_user.get("departmentCode") or "").casefold():
        raise HTTPException(status_code=403, detail="An HOD may only analyze substitutions for their department.")
    try:
        res = absence_adjuster.analyze_and_propose(
            teacher_query=req.teacher_name,
            date_str=req.date,
            day_name=req.day,
            department=department
        )
        if isinstance(res, dict):
            res["department"] = department
        return res
    except Exception as e:
        logger.error(f"[Analyze Absence API Error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/teacher-scheduler/apply")
async def apply_substitutions_api(
    req: ApplySubstitutionRequest,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")
):
    """
    Applies approved substitution proposals transactionally into PostgreSQL.
    """
    verified_user = _verified_agent_user(req, internal_secret)
    role = str(verified_user.get("role") or "").upper()
    department = req.department or verified_user.get("departmentCode")
    if role not in {"HOD", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only an HOD or administrator may apply substitution changes.")
    if not department:
        raise HTTPException(status_code=400, detail="A department scope is required.")
    if role == "HOD" and str(department).casefold() != str(verified_user.get("departmentCode") or "").casefold():
        raise HTTPException(status_code=403, detail="An HOD may only apply substitutions for their department.")
    if str(req.absence_data.get("department") or "").casefold() != str(department).casefold():
        raise HTTPException(status_code=403, detail="The substitution proposal does not match the authorized department.")
    try:
        res = absence_adjuster.execute_approved_substitutions(
            absence_data=req.absence_data,
            approved_by=str(verified_user.get("name") or verified_user["id"]),
            department=department
        )
        return res
    except Exception as e:
        logger.error(f"[Apply Substitutions API Error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/timetable/export/excel")
async def export_excel_api(
    req: ExportTimetableRequest,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")
):
    verified_user = _verified_agent_user(req, internal_secret)
    role = str(verified_user.get("role") or "").upper()
    if role not in {"HOD", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only department administrators may use this legacy export endpoint.")
    if role == "HOD" and str(req.department or "").casefold() != str(verified_user.get("departmentCode") or "").casefold():
        raise HTTPException(status_code=403, detail="An HOD may only export their department's timetable.")
    if not req.department:
        raise HTTPException(status_code=400, detail="A department is required for timetable export.")
    slots = postgres_tools.get_timetable(
        year=req.year,
        semester=req.semester,
        section=req.section,
        department=req.department,
        academic_year=req.academic_year,
        version=req.version
    )
    res = timetable_file_generator.generate_excel(
        req.department, req.year, req.semester, req.section, req.academic_year, req.version, slots
    )
    return {"success": True, **res}

@app.post("/ai/timetable/export/pdf")
async def export_pdf_api(
    req: ExportTimetableRequest,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")
):
    verified_user = _verified_agent_user(req, internal_secret)
    role = str(verified_user.get("role") or "").upper()
    if role not in {"HOD", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only department administrators may use this legacy export endpoint.")
    if role == "HOD" and str(req.department or "").casefold() != str(verified_user.get("departmentCode") or "").casefold():
        raise HTTPException(status_code=403, detail="An HOD may only export their department's timetable.")
    if not req.department:
        raise HTTPException(status_code=400, detail="A department is required for timetable export.")
    slots = postgres_tools.get_timetable(
        year=req.year,
        semester=req.semester,
        section=req.section,
        department=req.department,
        academic_year=req.academic_year,
        version=req.version
    )
    res = timetable_file_generator.generate_pdf(
        req.department, req.year, req.semester, req.section, req.academic_year, req.version, slots
    )
    return {"success": True, **res}

# ----------------- Document RAG Indexing & Retrieval -----------------

@app.post("/ai/rag/index")
async def index_document_endpoint(
    req: IndexDocumentRequest,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")
):
    """
    Ingests document into Qdrant erp_documents with department isolation.
    """
    verified_user = _verified_agent_user(req, internal_secret)
    department = str(verified_user.get("departmentCode") or "")
    if str(verified_user.get("role") or "").upper() not in {"TEACHER", "TG", "HOD", "ADMIN"}:
        raise HTTPException(status_code=403, detail="The authenticated role cannot index institutional documents.")
    if not department:
        raise HTTPException(status_code=403, detail="A verified department scope is required.")
    try:
        if not os.path.exists(req.filePath):
            raise HTTPException(status_code=404, detail=f"File not found on server: {req.filePath}")

        raw_text = document_processor.extract_text(req.filePath)
        if not raw_text or not raw_text.strip():
            raise HTTPException(status_code=422, detail="The uploaded document contains no extractable text.")

        metadata = {
            "title": req.title,
            "category": req.category,
            "note_id": req.noteId,
            "file_name": req.fileName or os.path.basename(req.filePath),
            "subject_id": req.subjectId,
            "year": req.year,
            "semester": req.semester,
            "department": department
        }
        chunks = document_processor.chunk_text(raw_text, metadata=metadata)
        count = qdrant_manager.index_document_chunks(collection_name="erp_documents", chunks=chunks)

        return {
            "success": True,
            "message": f"Successfully indexed {count} chunks into Qdrant 'erp_documents'.",
            "chunksIndexed": count,
            "collection": "erp_documents",
            "title": req.title
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[RAG Index Error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/rag/search")
async def rag_search_endpoint(
    req: RAGSearchRequest,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")
):
    """
    Performs hybrid retrieval against Qdrant erp_documents with department isolation.
    """
    verified_user = _verified_agent_user(req, internal_secret)
    department = str(verified_user.get("departmentCode") or "")
    if not department:
        raise HTTPException(status_code=403, detail="A verified department scope is required.")
    try:
        results = qdrant_manager.search_rag(
            query=req.query,
            department=department,
            category=req.collection,
            top_k=req.top_k
        )
        return {
            "success": True,
            "query": req.query,
            "department": department,
            "results": results
        }
    except Exception as e:
        logger.error(f"[RAG Search Error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ----------------- Universal File Processing Pipeline -----------------

@app.post("/ai/files/process")
async def process_file_endpoint(
    req: FileProcessRequest,
    background_tasks: BackgroundTasks,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret")
):
    """
    Universal File Processing Pipeline entry point.
    Receives file metadata from Node.js backend, processes asynchronously.
    """
    verified_user = _verified_agent_user(req, internal_secret)
    if str(req.user_id) != str(verified_user["id"]) or str(req.role).upper() != str(verified_user["role"]).upper():
        raise HTTPException(status_code=403, detail="File-processing identity does not match the authenticated user.")
    if str(req.department_id or "") != str(verified_user.get("departmentId") or ""):
        raise HTTPException(status_code=403, detail="File-processing department scope does not match the authenticated user.")
    if str(req.department_code or "").casefold() != str(verified_user.get("departmentCode") or "").casefold():
        raise HTTPException(status_code=403, detail="File-processing department code does not match the authenticated user.")
    try:
        logger.info(f"[File Process] Received: {req.filename} (type={req.file_type}, id={req.file_id})")

        # Process in background to not block the response
        background_tasks.add_task(
            _background_process_file,
            file_id=req.file_id,
            file_url=req.file_url,
            filename=req.filename,
            mime_type=req.mime_type,
            file_type=req.file_type,
            user_id=req.user_id,
            conversation_id=req.conversation_id,
            department_id=req.department_id,
            department_code=req.department_code,
            role=req.role,
            local_path=req.local_path
        )

        return {
            "success": True,
            "message": f"File '{req.filename}' queued for processing.",
            "file_id": req.file_id,
            "status": "processing"
        }
    except Exception as e:
        logger.error(f"[File Process Error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _background_process_file(
    file_id: str,
    file_url: str,
    filename: str,
    mime_type: str,
    file_type: str,
    user_id: str,
    conversation_id: str,
    department_id: str,
    department_code: str,
    role: str,
    local_path: Optional[str] = None
):
    """Background task for file processing."""
    try:
        result = await file_type_router.process_file(
            file_id=file_id,
            file_url=file_url,
            filename=filename,
            mime_type=mime_type,
            file_type=file_type,
            user_id=user_id,
            conversation_id=conversation_id or "",
            department_id=department_id or "",
            department_code=department_code or "",
            role=role,
            local_path=local_path
        )
        logger.info(f"[File Process] Completed: {filename} -> {result.get('chunks_indexed', 0)} chunks indexed")
    except Exception as e:
        logger.error(f"[File Process Background Error] {filename}: {e}")


@app.get("/ai/files/{file_id}/content")
async def get_file_content(
    file_id: str,
    internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret"),
    authenticated_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
    authenticated_department: Optional[str] = Header(default=None, alias="x-user-department")
):
    """
    if not INTERNAL_API_SECRET or not internal_secret or not hmac.compare_digest(INTERNAL_API_SECRET, internal_secret):
        raise HTTPException(status_code=401, detail="Authenticated Node.js gateway required.")
    if not authenticated_user_id or not authenticated_department:
        raise HTTPException(status_code=401, detail="Authenticated user and department context are required.")
    Get processed/normalized content for a file.
    Useful for agents that need to reason over file content.
    """
    try:
        # Search Qdrant for chunks belonging to this document
        results = qdrant_manager.search_rag(
            query="document content",
            department=authenticated_department,
            top_k=20
        )

        # Filter results for this specific document
        doc_chunks = []
        for r in results:
            meta = r.get("metadata", {})
            if meta.get("document_id") == file_id and meta.get("user_id") == authenticated_user_id:
                doc_chunks.append({
                    "content": r.get("snippet", ""),
                    "section": meta.get("section", "General"),
                    "page": meta.get("page"),
                    "chunk_id": meta.get("chunk_id", 0)
                })

        return {
            "success": True,
            "file_id": file_id,
            "chunks": doc_chunks,
            "chunk_count": len(doc_chunks)
        }
    except Exception as e:
        logger.error(f"[File Content Error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
