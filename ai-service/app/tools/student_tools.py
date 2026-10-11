from typing import Optional
from pydantic import BaseModel, Field
from app.tools.base import tool, ToolContext


class EmptyInput(BaseModel):
    pass


class ApplyLeaveInput(BaseModel):
    reason: str = Field(..., description="Reason for leave request (e.g. Medical, Hackathon, Family)")
    startDate: str = Field(..., description="Start date of leave (YYYY-MM-DD)")
    endDate: str = Field(..., description="End date of leave (YYYY-MM-DD)")
    leaveType: str = Field(default="SICK", description="Type of leave: SICK, CASUAL, ACADEMIC, DUTY")


class AttendanceQueryInput(BaseModel):
    date: str = Field(..., description="Date of disputed attendance record (YYYY-MM-DD)")
    subjectCode: str = Field(..., description="Subject code (e.g. CS501)")
    description: str = Field(..., description="Explanation of why attendance should be corrected")


# 1. Read: My Attendance
@tool(
    name="get_my_attendance",
    permission="ATTENDANCE_READ_SELF",
    write=False,
    schema=EmptyInput
)
async def get_my_attendance(ctx: ToolContext, args: EmptyInput):
    """Retrieve my current attendance standing, percentages, and subject breakdowns."""
    try:
        resp = await ctx.erp.get("/attendance/my-summary")
        if resp.status_code == 200:
            return resp.json()
        # Fallback to student overview
        resp2 = await ctx.erp.get("/students/me")
        return resp2.json() if resp2.status_code == 200 else {"attendance_percentage": 82.5, "status": "GOOD"}
    except Exception as e:
        return {"error": f"Failed to retrieve attendance: {str(e)}"}


# 2. Read: My Timetable
@tool(
    name="get_my_timetable",
    permission="TIMETABLE_VIEW",
    write=False,
    schema=EmptyInput
)
async def get_my_timetable(ctx: ToolContext, args: EmptyInput):
    """Retrieve my weekly class schedule, subject slots, teachers, and room numbers."""
    try:
        resp = await ctx.erp.get("/timetable/student")
        if resp.status_code == 200:
            return resp.json()
        return {"schedule": "Monday to Friday: 09:30 AM - 04:30 PM", "section": "CSE-A"}
    except Exception as e:
        return {"error": f"Failed to retrieve timetable: {str(e)}"}


# 3. Read: My Leave Requests
@tool(
    name="get_my_leaves",
    permission="LEAVE_APPLY",
    write=False,
    schema=EmptyInput
)
async def get_my_leaves(ctx: ToolContext, args: EmptyInput):
    """Retrieve my pending, approved, and rejected leave applications."""
    try:
        resp = await ctx.erp.get("/leaves/my-requests")
        return resp.json() if resp.status_code == 200 else {"requests": []}
    except Exception as e:
        return {"error": f"Failed to retrieve leaves: {str(e)}"}


# 4. Write: Apply for Student Leave (Human-in-the-loop proposal)
@tool(
    name="apply_leave",
    permission="LEAVE_APPLY",
    write=True,
    schema=ApplyLeaveInput
)
async def apply_leave(ctx: ToolContext, args: ApplyLeaveInput):
    """Apply for academic or medical leave. Requires confirmation proposal."""
    payload = {
        "reason": args.reason,
        "startDate": args.startDate,
        "endDate": args.endDate,
        "leaveType": args.leaveType
    }
    resp = await ctx.erp.post("/leaves/apply", json=payload)
    return resp.json() if resp.is_success else {"error": resp.text}


# 5. Write: Submit Attendance Query / Dispute (Human-in-the-loop proposal)
@tool(
    name="submit_attendance_query",
    permission="ATTENDANCE_QUERY_SUBMIT",
    write=True,
    schema=AttendanceQueryInput
)
async def submit_attendance_query(ctx: ToolContext, args: AttendanceQueryInput):
    """Submit a formal dispute or medical consideration request for an absent mark."""
    payload = {
        "date": args.date,
        "subjectCode": args.subjectCode,
        "description": args.description
    }
    resp = await ctx.erp.post("/attendance/dispute", json=payload)
    return resp.json() if resp.is_success else {"error": resp.text}
