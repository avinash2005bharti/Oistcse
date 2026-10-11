from typing import Optional
from pydantic import BaseModel, Field
from app.tools.base import tool, ToolContext


class EmptyInput(BaseModel):
    pass


class LeaveDecisionInput(BaseModel):
    leaveId: str = Field(..., description="Unique ID of the student leave request")
    note: Optional[str] = Field(default=None, description="Optional TG review note or condition")


class DefaulterQueryInput(BaseModel):
    threshold: float = Field(default=75.0, description="Attendance threshold percentage (default 75%)")


# 1. Read: Mentees List
@tool(
    name="get_mentees_list",
    permission="MENTEE_MONITOR",
    write=False,
    schema=EmptyInput
)
async def get_mentees_list(ctx: ToolContext, args: EmptyInput):
    """List all students assigned to me as their Tutor Guardian (TG)."""
    try:
        resp = await ctx.erp.get("/students/mentees")
        return resp.json() if resp.status_code == 200 else {"mentees": []}
    except Exception as e:
        return {"error": f"Failed to retrieve mentees: {str(e)}"}


# 2. Read: Students Below 75% Attendance (Defaulters)
@tool(
    name="get_low_attendance_students",
    permission="ATTENDANCE_VIEW_ALL",
    write=False,
    schema=DefaulterQueryInput
)
async def get_low_attendance_students(ctx: ToolContext, args: DefaulterQueryInput):
    """Retrieve students whose cumulative attendance is below the specified threshold."""
    try:
        resp = await ctx.erp.get(f"/attendance/defaulters?threshold={args.threshold}")
        return resp.json() if resp.status_code == 200 else {"defaulters": []}
    except Exception as e:
        return {"error": f"Failed to retrieve attendance defaulters: {str(e)}"}


# 3. Read: Pending Student Leave Requests
@tool(
    name="get_pending_student_leaves",
    permission="LEAVE_REVIEW_TG",
    write=False,
    schema=EmptyInput
)
async def get_pending_student_leaves(ctx: ToolContext, args: EmptyInput):
    """Retrieve student leave applications awaiting Tutor Guardian review."""
    try:
        resp = await ctx.erp.get("/leaves/pending-tg")
        return resp.json() if resp.status_code == 200 else {"leaves": []}
    except Exception as e:
        return {"error": f"Failed to retrieve pending leaves: {str(e)}"}


# 4. Write: Approve Student Leave as TG (Human-in-the-loop proposal)
@tool(
    name="approve_leave_tg",
    permission="LEAVE_REVIEW_TG",
    write=True,
    schema=LeaveDecisionInput
)
async def approve_leave_tg(ctx: ToolContext, args: LeaveDecisionInput):
    """Forward approval of a student leave application to HOD."""
    payload = {"status": "APPROVED", "note": args.note}
    resp = await ctx.erp.post(f"/leaves/{args.leaveId}/tg-review", json=payload)
    return resp.json() if resp.is_success else {"error": resp.text}


# 5. Write: Reject Student Leave as TG (Human-in-the-loop proposal)
@tool(
    name="reject_leave_tg",
    permission="LEAVE_REVIEW_TG",
    write=True,
    schema=LeaveDecisionInput
)
async def reject_leave_tg(ctx: ToolContext, args: LeaveDecisionInput):
    """Decline a student leave request with an explanatory note."""
    payload = {"status": "REJECTED", "note": args.note or "Disapproved by Tutor Guardian."}
    resp = await ctx.erp.post(f"/leaves/{args.leaveId}/tg-review", json=payload)
    return resp.json() if resp.is_success else {"error": resp.text}
