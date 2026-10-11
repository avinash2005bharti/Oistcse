import datetime
import json
import os
from typing import Dict, Any, Optional
from loguru import logger
from app.security.guard import redact_pii

AUDIT_LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tool_audit.jsonl")


async def record_tool_audit(
    user_id: str,
    role: str,
    tool_name: str,
    args: Dict[str, Any],
    result_status: str,
    duration_ms: float,
    erp_client: Optional[Any] = None
):
    """
    Persists immutable audit log entry for every tool execution.
    Pends PII-redacted record to local JSONL and attempts ERP backend audit if available.
    """
    entry = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "userId": user_id,
        "role": role,
        "tool": tool_name,
        "args": redact_pii(args),
        "status": result_status,
        "durationMs": duration_ms
    }

    try:
        with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        logger.error(f"[Audit Log Error] Failed to write to JSONL: {e}")

    logger.info(f"[Tool Audit] {role} #{user_id} executed `{tool_name}`: {result_status} ({duration_ms}ms)")
