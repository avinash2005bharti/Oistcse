import os
from typing import Dict, Any, List, Optional
import yaml
from loguru import logger

AGENTS_DIR = os.path.dirname(__file__)
REGISTRY_PATH = os.path.join(AGENTS_DIR, "registry.yaml")
PROMPTS_DIR = os.path.join(AGENTS_DIR, "prompts")


class RoleAgent:
    """Configured role-specific agent runtime specification."""
    def __init__(
        self,
        role: str,
        display_name: str,
        tools: List[str],
        system_prompt: str
    ):
        self.role = role
        self.display_name = display_name
        self.tools = tools
        self.system_prompt = system_prompt


class AgentFactory:
    """Loads agent definitions dynamically from registry.yaml and prompt files."""

    def __init__(self):
        self._agents: Dict[str, RoleAgent] = {}
        self._load_registry()

    def _read_prompt(self, filename: str) -> str:
        filepath = os.path.join(AGENTS_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                return f.read().strip()
        return ""

    def _load_registry(self):
        if not os.path.exists(REGISTRY_PATH):
            logger.error(f"[AgentFactory] Registry not found at {REGISTRY_PATH}")
            return

        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        base_prompt = self._read_prompt("prompts/base.md")
        raw_agents = data.get("agents", {})

        # Resolve inheritance and prompts
        for role, conf in raw_agents.items():
            display_name = conf.get("display_name", role.title())
            inherits = conf.get("inherits", [])
            tools = list(conf.get("tools", []))

            # Inherit parent tools
            for parent_role in inherits:
                parent_conf = raw_agents.get(parent_role, {})
                parent_tools = parent_conf.get("tools", [])
                for pt in parent_tools:
                    if pt not in tools:
                        tools.append(pt)

            prompt_file = conf.get("prompt_file", f"prompts/{role}.md")
            role_prompt = self._read_prompt(prompt_file)
            full_prompt = f"{base_prompt}\n\nROLE-SPECIFIC INSTRUCTIONS ({display_name}):\n{role_prompt}"

            self._agents[role.lower()] = RoleAgent(
                role=role.lower(),
                display_name=display_name,
                tools=tools,
                system_prompt=full_prompt
            )

        logger.info(f"[AgentFactory] Loaded {len(self._agents)} role agents from registry.yaml")

    def get_agent(self, role: str) -> Optional[RoleAgent]:
        """Retrieves RoleAgent specification for the user's role (defaults to student)."""
        normalized_role = (role or "student").lower()
        if normalized_role in self._agents:
            return self._agents[normalized_role]
        # Role mapping fallbacks
        if "teach" in normalized_role or "faculty" in normalized_role:
            return self._agents.get("teacher")
        if "admin" in normalized_role:
            return self._agents.get("admin")
        if "hod" in normalized_role:
            return self._agents.get("hod")
        if "tg" in normalized_role:
            return self._agents.get("tg")
        return self._agents.get("student")


agent_factory = AgentFactory()
