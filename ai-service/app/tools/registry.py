from typing import List, Dict, Any, Optional
from app.tools.base import GLOBAL_TOOL_REGISTRY, ToolDefinition


def pydantic_to_openai_schema(name: str, description: str, model_cls) -> Dict[str, Any]:
    """Generates standard OpenAI function schema from Pydantic model."""
    if model_cls:
        schema = model_cls.model_json_schema()
        # Clean title & descriptions for Groq compatibility
        parameters = {
            "type": "object",
            "properties": schema.get("properties", {}),
            "required": schema.get("required", [])
        }
    else:
        parameters = {
            "type": "object",
            "properties": {},
            "required": []
        }

    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description or f"Execute {name}",
            "parameters": parameters
        }
    }


def get_tools_for(
    allowed_tool_names: List[str],
    user_permissions: List[str]
) -> List[Dict[str, Any]]:
    """
    Filters registered tools:
    1. Must be in the role's allowed_tool_names list.
    2. If tool has a required permission, user must possess it.
    Returns list of OpenAI-formatted function schemas.
    """
    user_perms_set = set(user_permissions or [])
    filtered_tools: List[Dict[str, Any]] = []

    for name in allowed_tool_names:
        tool_def: Optional[ToolDefinition] = GLOBAL_TOOL_REGISTRY.get(name)
        if not tool_def:
            continue

        # Check required permission
        if tool_def.permission and tool_def.permission not in user_perms_set:
            continue

        schema = pydantic_to_openai_schema(
            name=tool_def.name,
            description=tool_def.description,
            model_cls=tool_def.schema
        )
        filtered_tools.append(schema)

    return filtered_tools


def get_tool_definition(name: str) -> Optional[ToolDefinition]:
    """Retrieves tool metadata definition by name."""
    return GLOBAL_TOOL_REGISTRY.get(name)
