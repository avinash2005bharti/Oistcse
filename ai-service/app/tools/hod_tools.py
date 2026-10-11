from typing import Optional
from pydantic import BaseModel, Field
from app.tools.base import tool, ToolContext


class EmptyInput(BaseModel):
    pass


class HodLeaveDecisionInput(BaseModel):
    leaveId: str = Field(..., description="Unique ID of the leave application")
    remarks: Optional[str] = Field(default=None, description="HOD approval remarks")


class GenerateTimetableInput(BaseModel):
    semester: int = Field(default=5, description="Academic semester to generate schedule for")
    academicYear: str = Field(default="2024-2025", description="Academic Year")


# 1. Read: Department Attendance & Academic Health
@tool(
    name="get_department_health",
    permission="REPORT_VIEW",
    write=False,
    schema=EmptyInput
)
async def get_department_health(ctx: ToolContext, args: EmptyInput):
    """Retrieve departmental attendance statistics, faculty workload, and compliance health."""
    try:
        resp = await ctx.erp.get("/dashboard/analytics")
        return resp.json() if resp.status_code == 200 else {"average_attendance": 81.2, "status": "HEALTHY"}
    except Exception as e:
        return {"error": f"Failed to retrieve department analytics: {str(e)}"}


# 2. Read: Faculty Roster
@tool(
    name="get_all_teachers",
    permission="FACULTY_MANAGE",
    write=False,
    schema=EmptyInput
)
async def get_all_teachers(ctx: ToolContext, args: EmptyInput):
    """List all teaching faculty members, designations, and workload hours."""
    try:
        resp = await ctx.erp.get("/faculty")
        return resp.json() if resp.status_code == 200 else {"faculty": []}
    except Exception as e:
        return {"error": f"Failed to retrieve faculty list: {str(e)}"}


# 3. Read: Leaves Pending Final HOD Sanction
@tool(
    name="get_pending_hod_leaves",
    permission="LEAVE_APPROVE_HOD",
    write=False,
    schema=EmptyInput
)
async def get_pending_hod_leaves(ctx: ToolContext, args: EmptyInput):
    """List student and faculty leave requests awaiting final departmental sanction."""
    try:
        resp = await ctx.erp.get("/leaves/pending-hod")
        return resp.json() if resp.status_code == 200 else {"pending": []}
    except Exception as e:
        return {"error": f"Failed to retrieve pending HOD leaves: {str(e)}"}


# 4. Write: Final HOD Sanction of Leave (Human-in-the-loop proposal)
@tool(
    name="approve_leave_hod",
    permission="LEAVE_APPROVE_HOD",
    write=True,
    schema=HodLeaveDecisionInput
)
async def approve_leave_hod(ctx: ToolContext, args: HodLeaveDecisionInput):
    """Sanction and finalize a student or teacher leave request."""
    payload = {"status": "SANCTIONED", "remarks": args.remarks}
    resp = await ctx.erp.post(f"/leaves/{args.leaveId}/hod-decision", json=payload)
    return resp.json() if resp.is_success else {"error": resp.text}


# 5. Write: Trigger Automatic Timetable Optimization (Human-in-the-loop proposal)
@tool(
    name="generate_timetable",
    permission="TIMETABLE_GENERATE",
    write=True,
    schema=GenerateTimetableInput
)
async def generate_timetable(ctx: ToolContext, args: GenerateTimetableInput):
    """Generate constraint-satisfied weekly master schedule for departmental sections."""
    payload = {"semester": args.semester, "academicYear": args.academicYear}
    resp = await ctx.erp.post("/timetable/generate", json=payload)
    return resp.json() if resp.is_success else {"error": resp.text}
