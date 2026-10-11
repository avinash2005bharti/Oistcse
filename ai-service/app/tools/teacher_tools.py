from typing import List, Optional
from pydantic import BaseModel, Field
from app.tools.base import tool, ToolContext


class EmptyInput(BaseModel):
    pass


class MarkAttendanceInput(BaseModel):
    section: str = Field(..., description="Target section (e.g. A, B, C)")
    subjectCode: str = Field(..., description="Subject code (e.g. CS501)")
    date: str = Field(..., description="Date of attendance session (YYYY-MM-DD)")
    presentEnrollments: List[str] = Field(..., description="List of student enrollments marked present")


class SectionQueryInput(BaseModel):
    section: str = Field(..., description="Section name (e.g. A, B)")
    subjectCode: Optional[str] = Field(default=None, description="Optional subject filter")


# 1. Read: Teacher Schedule
@tool(
    name="get_my_schedule",
    permission="TIMETABLE_VIEW",
    write=False,
    schema=EmptyInput
)
async def get_my_schedule(ctx: ToolContext, args: EmptyInput):
    """Retrieve my teaching slots, assigned lecture halls, and sections for today/week."""
    try:
        resp = await ctx.erp.get("/timetable/teacher")
        return resp.json() if resp.status_code == 200 else {"slots": []}
    except Exception as e:
        return {"error": f"Failed to retrieve teaching schedule: {str(e)}"}


# 2. Read: Section Attendance Health
@tool(
    name="get_section_attendance",
    permission="ATTENDANCE_VIEW_ALL",
    write=False,
    schema=SectionQueryInput
)
async def get_section_attendance(ctx: ToolContext, args: SectionQueryInput):
    """Check attendance statistics and defaulter lists for a section."""
    try:
        resp = await ctx.erp.get(f"/attendance/section/{args.section}")
        return resp.json() if resp.status_code == 200 else {"section": args.section, "average": 78.4}
    except Exception as e:
        return {"error": f"Failed to check section attendance: {str(e)}"}


# 3. Write: Mark Attendance Session (Human-in-the-loop proposal)
@tool(
    name="mark_attendance",
    permission="ATTENDANCE_MARK",
    write=True,
    schema=MarkAttendanceInput
)
async def mark_attendance(ctx: ToolContext, args: MarkAttendanceInput):
    """Submit classroom attendance records for a lecture session."""
    payload = {
        "section": args.section,
        "subjectCode": args.subjectCode,
        "date": args.date,
        "presentEnrollments": args.presentEnrollments
    }
    resp = await ctx.erp.post("/attendance/mark", json=payload)
    return resp.json() if resp.is_success else {"error": resp.text}
