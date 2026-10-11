from typing import Dict, Any, List, Optional
from loguru import logger
from app.llm.groq_client import groq_client


class AgentRouter:
    """
    Classifies user intent for multi-module or cross-domain questions (§4.5 & §10 Phase 6).
    Keeps write actions strictly isolated to authenticated role agents.
    """

    async def classify_intent(self, text: str, user_role: str) -> Dict[str, Any]:
        prompt = (
            f"Given the user query: \"{text}\" from a user with role \"{user_role}\", "
            "determine the primary module intent (ATTENDANCE, TIMETABLE, LEAVE, FACULTY, GENERAL, DOCUMENT) "
            "and whether this spans multiple departmental domains. "
            "Return JSON with keys 'primary_module' (string), 'is_multi_module' (boolean), 'confidence' (float)."
        )
        try:
            res = await groq_client.chat(
                [{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            import json
            return json.loads(res["content"])
        except Exception as e:
            logger.warning(f"[AgentRouter] Intent classification fallback: {e}")
            return {"primary_module": "GENERAL", "is_multi_module": False, "confidence": 0.5}


agent_router = AgentRouter()
