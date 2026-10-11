import asyncio
import json
import time
import uuid
from typing import Dict, Any, List, Optional, AsyncGenerator
from loguru import logger

from app.config import settings
from app.llm.groq_client import groq_client
from app.llm.schemas import TokenUsage, StreamEvent
from app.agents.factory import agent_factory, RoleAgent
from app.tools.registry import get_tools_for, get_tool_definition
from app.tools.base import ToolContext
from app.tools.erp_client import create_erp_client
from app.memory.session import session_memory
from app.memory.pending import pending_memory
from app.security.audit import record_tool_audit


async def run_agent_loop(
    user_context: Dict[str, Any],
    session_id: str,
    user_text: str,
    document_context: str = ""
) -> AsyncGenerator[str, None]:
    """
    Core agent execution loop implementing §4.4 and §6 realtime contract.
    Streams NDJSON events line-by-line:
      {"type":"start", "agent":"..."}
      {"type":"tool", "name":"...", "status":"..."}
      {"type":"proposal", "proposalId":"...", "action":"...", "summary":"...", "payload":{...}}
      {"type":"token", "delta":"..."}
      {"type":"done", "usage":{...}}
      {"type":"error", "message":"..."}
    """
    user_id = user_context["userId"]
    role = user_context["role"]
    permissions = user_context.get("permissions", [])
    raw_token = user_context.get("raw_token", "")

    # 1. Resolve role agent
    agent: Optional[RoleAgent] = agent_factory.get_agent(role)
    if not agent:
        yield json.dumps({"type": "error", "message": f"No agent configured for role '{role}'."}) + "\n"
        return

    # Emit agent start event
    yield json.dumps({"type": "start", "agent": agent.role, "display_name": agent.display_name}) + "\n"

    # 2. Filter allowed tools by user's actual permissions
    tools_schema = get_tools_for(agent.tools, permissions)

    # 3. Load conversation history
    history = await session_memory.get_messages(user_id, session_id, limit=8)

    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": agent.system_prompt}
    ]
    for h in history:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

    # Prepare user query with untrusted document text attached
    current_content = user_text
    if document_context:
        current_content += f"\n\n[ATTACHED DOCUMENTS (UNTRUSTED DATA)]:\n{document_context}"

    messages.append({"role": "user", "content": current_content})

    # Save user turn to session history
    await session_memory.append_message(user_id, session_id, {"role": "user", "content": user_text})

    # Initialize ERP delegated client
    erp_client = create_erp_client(raw_token)
    ctx = ToolContext(user=user_context, erp=erp_client)

    max_steps = settings.MAX_AGENT_STEPS
    step_count = 0
    total_usage = TokenUsage()
    assistant_final_response = ""

    try:
        while step_count < max_steps:
            step_count += 1
            has_tool_call = False
            pending_tool_calls: List[Dict[str, Any]] = []

            # Call text model with streaming generator
            async for chunk in groq_client.chat_stream(messages, tools=tools_schema):
                chunk_type = chunk.get("type")

                if chunk_type == "token":
                    delta = chunk.get("delta", "")
                    assistant_final_response += delta
                    yield json.dumps({"type": "token", "delta": delta}) + "\n"

                elif chunk_type == "tool_call":
                    has_tool_call = True
                    pending_tool_calls.append(chunk["tool_call"])

                elif chunk_type == "usage":
                    u = chunk.get("usage")
                    if u:
                        total_usage.prompt_tokens += u.prompt_tokens
                        total_usage.completion_tokens += u.completion_tokens
                        total_usage.total_tokens += u.total_tokens

            # If no tools called, we're done
            if not has_tool_call or not pending_tool_calls:
                break

            # Process tool calls
            for tc in pending_tool_calls:
                tool_name = tc.get("name", "")
                args = tc.get("arguments", {})
                call_id = tc.get("id", f"call_{uuid.uuid4().hex[:8]}")

                tool_def = get_tool_definition(tool_name)
                if not tool_def:
                    yield json.dumps({"type": "tool", "name": tool_name, "status": "error"}) + "\n"
                    messages.append({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "name": tool_name,
                        "content": json.dumps({"error": f"Tool '{tool_name}' is not recognized."})
                    })
                    continue

                # Check write action: generate proposal and halt
                if tool_def.write:
                    proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
                    proposal_summary = f"{tool_def.description or tool_name} with parameters: {json.dumps(args)}"

                    await pending_memory.save_proposal(proposal_id, {
                        "userId": user_id,
                        "sessionId": session_id,
                        "toolName": tool_name,
                        "args": args,
                        "summary": proposal_summary
                    })

                    yield json.dumps({
                        "type": "proposal",
                        "proposalId": proposal_id,
                        "action": tool_name,
                        "summary": proposal_summary,
                        "payload": args
                    }) + "\n"

                    # End turn awaiting human-in-the-loop confirmation
                    assistant_final_response += f"\n\n[Action Proposal Generated for `{tool_name}`: Awaiting your confirmation.]"
                    await session_memory.append_message(
                        user_id,
                        session_id,
                        {"role": "assistant", "content": assistant_final_response}
                    )
                    yield json.dumps({"type": "done", "usage": total_usage.model_dump()}) + "\n"
                    return

                # Read action: Execute immediately via ERP API with user's JWT
                yield json.dumps({"type": "tool", "name": tool_name, "status": "running"}) + "\n"
                t0 = time.time()
                try:
                    # Validate arguments against Pydantic schema if provided
                    if tool_def.schema:
                        valid_args = tool_def.schema(**args)
                        result = await tool_def.func(ctx, valid_args)
                    else:
                        result = await tool_def.func(ctx, None)

                    duration_ms = (time.time() - t0) * 1000.0
                    yield json.dumps({"type": "tool", "name": tool_name, "status": "done"}) + "\n"
                    await record_tool_audit(user_id, role, tool_name, args, "SUCCESS", duration_ms)

                except Exception as tool_err:
                    duration_ms = (time.time() - t0) * 1000.0
                    logger.error(f"[Tool Execution Failed] {tool_name}: {tool_err}")
                    result = {"error": f"Tool execution failed: {str(tool_err)}"}
                    yield json.dumps({"type": "tool", "name": tool_name, "status": "error"}) + "\n"
                    await record_tool_audit(user_id, role, tool_name, args, "ERROR", duration_ms)

                # Trim result to prevent token explosion
                serialized_result = json.dumps(result)[:2500]

                # Append assistant tool_call message and tool response message
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": call_id,
                        "type": "function",
                        "function": {"name": tool_name, "arguments": json.dumps(args)}
                    }]
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "name": tool_name,
                    "content": serialized_result
                })

        # Save assistant message to session history
        if assistant_final_response:
            await session_memory.append_message(
                user_id,
                session_id,
                {"role": "assistant", "content": assistant_final_response}
            )

        yield json.dumps({"type": "done", "usage": total_usage.model_dump()}) + "\n"

    except Exception as run_err:
        logger.error(f"[Agent Runner Loop Error]: {run_err}")
        yield json.dumps({"type": "error", "message": f"Agent error: {str(run_err)}"}) + "\n"
    finally:
        await erp_client.aclose()
