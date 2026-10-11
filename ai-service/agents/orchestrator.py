"""
CampusFlow Central Multi-Agent Orchestrator (Section 12, 13, 24, 25).
Connects user requests to autonomous operational agents that execute real backend operations
via the ReAct Execution Loop and Central Tool Registry.
"""

import time
from typing import Dict, Any, List, Optional
from loguru import logger

from agents.agent_definition import AgentFactory, AgentDefinition
from agents.react_agent_loop import react_agent_runner
from tools.tool_registry import agent_tool_registry

from memory.mongo_memory import mongo_memory
from memory.langchain_memory import langchain_memory
from rag.qdrant_manager import qdrant_manager


class CentralAgentOrchestrator:
    """
    Central AI Multi-Agent Orchestrator.
    Architecture:
    User -> Authentication -> Dynamic Agent Creation -> Understand & Plan -> Tool Selection
    -> Real Backend Execution (HTTP / Core Services) -> Observe Result -> Verify -> Grounded Response.
    """

    def __init__(self):
        self.tool_registry = agent_tool_registry
        self.react_runner = react_agent_runner
        self.langchain = langchain_memory
        self.qdrant = qdrant_manager
        self.mongo = mongo_memory

    def orchestrate(
        self,
        prompt: str,
        user_id: str,
        role: str,
        conversation_id: str,
        target_agent: Optional[str] = None,
        context_history: Optional[List[Dict[str, str]]] = None,
        user_context: Optional[Dict[str, Any]] = None,
        file_id: Optional[str] = None,
        attachment: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes Central Operational Agent Orchestration Pipeline.
        """
        start_time = time.time()
        effective_user_ctx = dict(user_context or {})
        authenticated_user_id = str(effective_user_ctx.get("id") or effective_user_ctx.get("userId") or "")
        role_clean = str(effective_user_ctx.get("role") or "").lower()
        user_perms = effective_user_ctx.get("permissions")
        if (
            not authenticated_user_id
            or not role_clean
            or not isinstance(user_perms, list)
            or authenticated_user_id != str(user_id)
            or role_clean.upper() != str(role).upper()
        ):
            return {
                "success": False,
                "answer": "I could not verify your authenticated CampusFlow identity and permissions. Please sign in again.",
                "detected_intent": "AUTHENTICATION_REQUIRED",
                "agent_used": "AgentRuntime",
                "actions_taken": [],
                "tool_calls": [],
                "steps": []
            }

        logger.info(
            f"[Orchestrator] Dispatching query from {effective_user_ctx.get('name')} "
            f"({role_clean.upper()}): '{prompt[:60]}...' [Conv: {conversation_id}]"
        )

        # ---------------------------------------------------------------------
        # 1. DYNAMIC AGENT CREATION BASED ON ROLE & CAPABILITIES
        # ---------------------------------------------------------------------
        agent_def: AgentDefinition = AgentFactory.create_agent_for_user(
            user_role=role_clean,
            user_permissions=user_perms
        )

        logger.info(
            f"[Orchestrator] Assembled Agent '{agent_def.name}' with "
            f"{len(agent_def.allowed_tools)} permitted tools"
        )

        # ---------------------------------------------------------------------
        # 2. AUTONOMOUS AGENT RUNTIME
        # ---------------------------------------------------------------------
        try:
            result = self.react_runner.run(
                prompt=prompt,
                user_context=effective_user_ctx,
                conversation_id=conversation_id,
                agent_def=agent_def,
                context_history=context_history,
                file_id=file_id,
                attachment=attachment
            )
            return result
        except Exception as exec_err:
            logger.error(f"[Orchestrator] Execution Loop Error: {exec_err}")
            duration_ms = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "answer": f"⚠️ An execution error occurred while processing your request: {str(exec_err)}. Please try again or rephrase.",
                "detected_intent": "EXECUTION_ERROR",
                "agent_used": agent_def.name,
                "actions_taken": [],
                "tool_calls": [],
                "steps": [f"Execution error: {str(exec_err)}"],
                "execution_duration_ms": duration_ms
            }


central_orchestrator = CentralAgentOrchestrator()
