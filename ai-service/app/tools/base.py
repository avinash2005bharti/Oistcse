import functools
from typing import Dict, Any, Optional, Type, Callable
from pydantic import BaseModel
import httpx
from loguru import logger


class ToolContext:
    """
    Context injected into every tool execution.
    Contains user identity, pre-configured ERP HTTP client with user's JWT, and logger.
    """
    def __init__(
        self,
        user: Dict[str, Any],
        erp: httpx.AsyncClient,
        tool_logger=None
    ):
        self.user = user
        self.user_id = user.get("userId", "")
        self.role = user.get("role", "")
        self.permissions = user.get("permissions", [])
        self.tenant_id = user.get("tenantId", "")
        self.erp = erp
        self.logger = tool_logger or logger


class ToolDefinition:
    """Metadata describing an executable agent tool."""
    def __init__(
        self,
        name: str,
        func: Callable,
        permission: Optional[str] = None,
        write: bool = False,
        schema: Optional[Type[BaseModel]] = None,
        description: Optional[str] = None
    ):
        self.name = name
        self.func = func
        self.permission = permission
        self.write = write
        self.schema = schema
        self.description = description or (func.__doc__ or "").strip()


# Global registry of all declared tools
GLOBAL_TOOL_REGISTRY: Dict[str, ToolDefinition] = {}


def tool(
    name: str,
    permission: Optional[str] = None,
    write: bool = False,
    schema: Optional[Type[BaseModel]] = None
):
    """
    Decorator declaring a tool in the global registry.
    name: unique tool name
    permission: required user permission string (or None if public for role)
    write: True if this is a mutating write action requiring proposal confirmation
    schema: Pydantic input argument schema
    """
    def decorator(func: Callable):
        tool_def = ToolDefinition(
            name=name,
            func=func,
            permission=permission,
            write=write,
            schema=schema
        )
        GLOBAL_TOOL_REGISTRY[name] = tool_def

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)

        return wrapper

    return decorator
