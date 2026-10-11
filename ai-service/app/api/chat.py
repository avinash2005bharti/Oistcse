import json
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.deps import get_user_context, verify_service_key
from app.llm.schemas import ChatRequest
from app.documents.pipeline import process_attached_files
from app.agents.runner import run_agent_loop

router = APIRouter(prefix="/v1/agent", tags=["Chat"])


@router.post("/chat")
async def chat_stream_endpoint(
    request: ChatRequest,
    user_context: Dict[str, Any] = Depends(get_user_context)
):
    """
    Streams NDJSON events for agent reasoning, tool execution, and proposals.
    Requires X-Service-Key and delegated Authorization: Bearer <user_jwt>.
    """
    # 1. Process untrusted attachments if present
    document_context = await process_attached_files(request.fileUrls)

    # 2. Return streaming response of NDJSON events
    return StreamingResponse(
        run_agent_loop(
            user_context=user_context,
            session_id=request.sessionId,
            user_text=request.text,
            document_context=document_context
        ),
        media_type="application/x-ndjson"
    )


class LegacyChatPayload(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = "student"
    prompt: Optional[str] = None
    message: Optional[str] = None
    conversation_id: Optional[str] = None
    conversationId: Optional[str] = None
    agent: Optional[str] = None
    user: Optional[Dict[str, Any]] = None
    file_id: Optional[str] = None
    attachment: Optional[Dict[str, Any]] = None


@router.post("/ai/chat")
async def legacy_chat_endpoint(
    payload: LegacyChatPayload,
    x_internal_secret: str = Depends(verify_service_key)
):
    """
    Backward-compatible synchronous chat endpoint for legacy callers.
    Gathers tokens and tool calls from the role agent loop and returns unified JSON.
    """
    user_info = payload.user or {}
    user_id = str(payload.user_id or user_info.get("id") or user_info.get("userId") or "user_default")
    role = str(payload.role or user_info.get("role") or "STUDENT").upper()
    session_id = payload.conversation_id or payload.conversationId or f"conv_{user_id}"
    text = (payload.prompt or payload.message or "").strip()

    user_context = {
        "userId": user_id,
        "role": role,
        "permissions": user_info.get("permissions", []),
        "tenantId": user_info.get("departmentId", "CSE"),
        "raw_token": user_info.get("rawToken", "")
    }

    full_answer = []
    actions_taken = []
    requires_confirmation = False
    confirmation_prompt = None
    action_to_confirm = None

    async for event_line in run_agent_loop(user_context=user_context, session_id=session_id, user_text=text):
        try:
            event = json.loads(event_line.strip())
            ev_type = event.get("type")
            if ev_type == "token":
                full_answer.append(event.get("delta", ""))
            elif ev_type == "tool":
                actions_taken.append(event.get("name"))
            elif ev_type == "proposal":
                requires_confirmation = True
                confirmation_prompt = event.get("summary")
                action_to_confirm = {
                    "tool": event.get("action"),
                    "proposalId": event.get("proposalId"),
                    "args": event.get("payload")
                }
        except Exception:
            pass

    final_text = "".join(full_answer).strip() or "Your request has been processed by CampusFlow AI."

    return {
        "success": True,
        "answer": final_text,
        "response": final_text,
        "agent_used": role.lower(),
        "detected_intent": "ROLE_AGENT_QUERY",
        "actions_taken": list(set(actions_taken)),
        "requires_confirmation": requires_confirmation,
        "confirmation_prompt": confirmation_prompt,
        "action_to_confirm": action_to_confirm,
        "steps": actions_taken
    }
