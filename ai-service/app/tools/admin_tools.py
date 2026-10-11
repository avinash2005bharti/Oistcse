from typing import Optional
from pydantic import BaseModel, Field
from app.tools.base import tool, ToolContext


class EmptyInput(BaseModel):
    pass


class DeactivateUserInput(BaseModel):
    userId: str = Field(..., description="ID of the user to deactivate")
    reason: str = Field(..., description="Reason for account deactivation")


# 1. Read: System Users
@tool(
    name="get_system_users",
    permission="USER_READ",
    write=False,
    schema=EmptyInput
)
async def get_system_users(ctx: ToolContext, args: EmptyInput):
    """Retrieve ERP accounts list with roles and active statuses."""
    try:
        resp = await ctx.erp.get("/admin/users")
        return resp.json() if resp.status_code == 200 else {"users": []}
    except Exception as e:
        return {"error": f"Failed to retrieve user list: {str(e)}"}


# 2. Read: Audit Logs
@tool(
    name="get_audit_logs",
    permission="USER_READ",
    write=False,
    schema=EmptyInput
)
async def get_audit_logs(ctx: ToolContext, args: EmptyInput):
    """Retrieve recent institutional security and audit trail logs."""
    try:
        resp = await ctx.erp.get("/admin/audit-logs")
        return resp.json() if resp.status_code == 200 else {"logs": []}
    except Exception as e:
        return {"error": f"Failed to retrieve audit logs: {str(e)}"}


# 3. Write: Deactivate Account (Human-in-the-loop proposal)
@tool(
    name="deactivate_user",
    permission="USER_DELETE",
    write=True,
    schema=DeactivateUserInput
)
async def deactivate_user(ctx: ToolContext, args: DeactivateUserInput):
    """Deactivate an ERP user account. Critical write action requiring explicit confirmation."""
    payload = {"userId": args.userId, "reason": args.reason}
    resp = await ctx.erp.post("/admin/users/deactivate", json=payload)
    return resp.json() if resp.is_success else {"error": resp.text}
