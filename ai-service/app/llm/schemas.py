from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class FileUrlItem(BaseModel):
    url: str
    fileId: Optional[str] = None
    name: Optional[str] = None
    mime: Optional[str] = None


class ChatRequest(BaseModel):
    sessionId: str = Field(..., description="Unique conversational session ID")
    text: str = Field(..., description="User query prompt text")
    fileUrls: Optional[List[FileUrlItem]] = Field(default=None, description="Optional ImageKit file items")
    feature: Optional[str] = Field(default=None, description="Contextual feature screen")


class ProposalConfirmRequest(BaseModel):
    sessionId: str = Field(..., description="Session ID matching the proposal")
    proposalId: str = Field(..., description="Unique ID of the write proposal")
    approved: bool = Field(..., description="True to execute, False to reject")
    edits: Optional[Dict[str, Any]] = Field(default=None, description="Optional parameter edits")


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class StreamEvent(BaseModel):
    type: str  # "start", "token", "tool", "proposal", "done", "error"
    delta: Optional[str] = None
    agent: Optional[str] = None
    name: Optional[str] = None
    status: Optional[str] = None
    proposalId: Optional[str] = None
    action: Optional[str] = None
    summary: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    usage: Optional[TokenUsage] = None
    code: Optional[str] = None
    message: Optional[str] = None
