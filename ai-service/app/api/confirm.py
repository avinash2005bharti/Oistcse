import time
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_user_context
from app.llm.schemas import ProposalConfirmRequest
from app.memory.pending import pending_memory
from app.memory.session import session_memory
from app.tools.registry import get_tool_definition
from app.tools.base import ToolContext
from app.tools.erp_client import create_erp_client
from app.security.audit import record_tool_audit

router = APIRouter(prefix="/v1/agent", tags=["Confirm"])


@router.post("/confirm")
async def confirm_proposal_endpoint(
    request: ProposalConfirmRequest,
    user_context: Dict[str, Any] = Depends(get_user_context)
):
    """
    Executes or cancels a human-in-the-loop write proposal.
    Verifies proposal ownership, merges any user edits, and runs action with user's JWT.
    """
    user_id = user_context["userId"]
    role = user_context["role"]
    raw_token = user_context.get("raw_token", "")

    # 1. Retrieve proposal from memory
    proposal = await pending_memory.get_proposal(request.proposalId)
    if not proposal:
        raise HTTPException(
            status_code=404,
            detail="Proposal not found or has expired (10-minute validity limit)."
        )

    # 2. Verify ownership (§9 Security)
    if proposal.get("userId") != user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Cannot confirm a proposal belonging to another user."
        )

    tool_name = proposal.get("toolName", "")
    args = proposal.get("args", {})

    # Apply any edits provided by user
    if request.edits:
        args.update(request.edits)

    # If rejected by user
    if not request.approved:
        await pending_memory.delete_proposal(request.proposalId)
        await session_memory.append_message(
            user_id,
            request.sessionId,
            {"role": "assistant", "content": f"The proposal for `{tool_name}` was declined."}
        )
        return {
            "status": "rejected",
            "message": f"Proposal for `{tool_name}` was cancelled by user.",
            "proposalId": request.proposalId
        }

    # 3. Execute approved tool action
    tool_def = get_tool_definition(tool_name)
    if not tool_def:
        raise HTTPException(
            status_code=400,
            detail=f"Tool definition for `{tool_name}` is not registered."
        )

    erp_client = create_erp_client(raw_token)
    ctx = ToolContext(user=user_context, erp=erp_client)
    t0 = time.time()

    try:
        if tool_def.schema:
            validated_args = tool_def.schema(**args)
            result = await tool_def.func(ctx, validated_args)
        else:
            result = await tool_def.func(ctx, None)

        duration_ms = (time.time() - t0) * 1000.0
        await record_tool_audit(user_id, role, tool_name, args, "CONFIRMED_SUCCESS", duration_ms)
        await pending_memory.delete_proposal(request.proposalId)

        # Append confirmation outcome to session memory
        await session_memory.append_message(
            user_id,
            request.sessionId,
            {"role": "assistant", "content": f"The action `{tool_name}` was confirmed and executed successfully: {result}"}
        )

        return {
            "status": "executed",
            "tool": tool_name,
            "result": result,
            "proposalId": request.proposalId
        }

    except Exception as e:
        duration_ms = (time.time() - t0) * 1000.0
        await record_tool_audit(user_id, role, tool_name, args, "CONFIRMED_ERROR", duration_ms)
        raise HTTPException(
            status_code=500,
            detail=f"Execution of confirmed tool `{tool_name}` failed: {str(e)}"
        )
    finally:
        await erp_client.aclose()
