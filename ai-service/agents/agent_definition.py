"""
CampusFlow Data-Driven Agent Definition Model (Section 12, 23, 24).
Agents are constructed from capabilities, permissions, tools, and execution policies,
NOT static chatbot prompts.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class PlanningPolicy(BaseModel):
    max_steps: int = Field(default=10, description="Maximum tool-decision iterations")
    temperature: float = Field(default=0.2, description="Model generation temperature for deterministic planning")
    allow_multi_step: bool = Field(default=True, description="Whether agent can chain multiple tool calls")


class VerificationPolicy(BaseModel):
    require_grounding: bool = Field(default=True, description="Response must be strictly grounded in tool observation")
    no_fake_success: bool = Field(default=True, description="Never claim action succeeded unless tool executed without error")
    verify_output_schema: bool = Field(default=True, description="Verify tool returned valid structure")


class MemoryPolicy(BaseModel):
    stm_enabled: bool = Field(default=True, description="MongoDB Short-Term Conversational Memory active")
    ltm_enabled: bool = Field(default=True, description="Qdrant Long-Term Vector Memory active")
    extract_facts: bool = Field(default=True, description="Automatically extract long-term user facts and constraints")


class AgentDefinition(BaseModel):
    """
    Data-Driven Declarative Agent Specification.
    """
    model_config = {"protected_namespaces": ()}

    name: str
    agent_id: str = ""
    role: str
    description: str
    goal: str = ""
    system_instructions: str
    allowed_tools: List[str] = Field(default_factory=list)
    model_name: str = Field(default="llama-3.3-70b-versatile")
    planning_policy: PlanningPolicy = Field(default_factory=PlanningPolicy)
    verification_policy: VerificationPolicy = Field(default_factory=VerificationPolicy)
    memory_policy: MemoryPolicy = Field(default_factory=MemoryPolicy)


# Pre-configured authoritative role-based agent definitions
ROLE_AGENT_DEFINITIONS: Dict[str, AgentDefinition] = {
    "STUDENT": AgentDefinition(
        name="StudentOperatorAgent",
        role="STUDENT",
        description="Autonomous CampusFlow Operator for Students. Operates attendance lookups, personal schedules, leaves, and attendance queries.",
        system_instructions=(
            "You are the Student Autonomous Operator for CampusFlow.\n"
            "Your objective is to EXECUTE actions on behalf of the student by invoking available tools.\n"
            "OPERATIONAL GUIDELINES:\n"
            "1. When the student asks about attendance, call `get_student_attendance` to retrieve the authentic ledger records.\n"
            "2. When the student wants to apply for leave, call `apply_leave` with their reason and dates.\n"
            "3. When the student disputes an absence, call `submit_attendance_query`.\n"
            "4. When the student asks for their class schedule, call `get_student_schedule`.\n"
            "5. GROUNDING RULE: Never state that an action was performed or attendance was fetched unless you observed successful tool results.\n"
            "6. SECURITY RULE: Never attempt administrative or faculty operations."
        ),
        allowed_tools=[
            "get_student_attendance", "get_student_schedule", "apply_leave",
            "submit_attendance_query", "get_student", "get_subjects",
            "get_rooms", "check_room_availability", "get_teachers",
            "get_teacher", "get_teacher_availability", "get_teachers_on_leave",
            "export_timetable_excel", "export_timetable_pdf", "inspect_attached_file"
        ]
    ),

    "TEACHER": AgentDefinition(
        name="TeacherOperatorAgent",
        role="TEACHER",
        description="Autonomous CampusFlow Operator for Faculty. Operates lecture attendance marking, teaching schedules, workload tracking, and faculty leave.",
        system_instructions=(
            "You are the Teacher Autonomous Operator for CampusFlow.\n"
            "Your objective is to EXECUTE teaching operations, record attendance, and manage faculty tasks.\n"
            "OPERATIONAL GUIDELINES:\n"
            "1. To mark attendance for a student, call `mark_attendance`.\n"
            "2. To record attendance for an entire class, call `bulk_mark_attendance`.\n"
            "3. When asked for today's classes or schedule, call `get_teacher_schedule`.\n"
            "4. To apply for personal faculty leave, call `apply_leave` or `mark_teacher_leave`.\n"
            "5. To check room vacancy, call `check_room_availability`.\n"
            "6. GROUNDING RULE: Always base your confirmation and counts on actual tool output data."
        ),
        allowed_tools=[
            "mark_attendance", "bulk_mark_attendance", "get_teacher_schedule",
            "get_students", "get_student", "apply_leave", "mark_teacher_leave",
            "get_teacher_workload", "get_teacher_availability", "get_teachers_on_leave",
            "get_timetable", "get_subjects", "get_rooms", "check_room_availability",
            "export_timetable_excel", "export_timetable_pdf", "get_teachers", "get_teacher",
            "inspect_attached_file"
        ]
    ),

    "TG": AgentDefinition(
        name="TgOperatorAgent",
        role="TG",
        description="Autonomous CampusFlow Operator for Tutor Guardians. Operates mentee monitoring, attendance shortage review, student leave clearance, and dispute resolution.",
        system_instructions=(
            "You are the Tutor Guardian (TG) Autonomous Operator for CampusFlow.\n"
            "Your objective is to monitor assigned mentees, resolve student disputes, and review leave applications.\n"
            "OPERATIONAL GUIDELINES:\n"
            "1. To view assigned mentees and their current attendance records, call `get_mentees`.\n"
            "2. To review or recommend a student attendance query, call `review_attendance_query` with action='RECOMMEND'.\n"
            "3. To review/recommend a student leave application, call `approve_leave` or `reject_leave`.\n"
            "4. To inspect a student's record, call `get_student` or `get_student_attendance`.\n"
            "5. GROUNDING RULE: Never state that a student's shortage was reviewed without calling `get_mentees`."
        ),
        allowed_tools=[
            "get_mentees", "review_attendance_query", "approve_leave", "reject_leave",
            "get_student", "get_student_attendance", "get_students", "apply_leave",
            "get_teacher_schedule", "get_teacher_workload", "get_teachers_on_leave",
            "get_timetable", "get_subjects", "get_rooms", "check_room_availability",
            "export_timetable_excel", "export_timetable_pdf", "get_teachers", "get_teacher",
            "inspect_attached_file"
        ]
    ),

    "HOD": AgentDefinition(
        name="HodOperatorAgent",
        role="HOD",
        description="Autonomous CampusFlow Operator for Head of Department. Operates department analytics, timetable generation/publishing, teacher assignments, and final leave clearance.",
        system_instructions=(
            "You are the Head of Department (HOD) Autonomous Operator for CampusFlow.\n"
            "Operate only within the department and resources authorized by the authenticated backend identity.\n"
            "OPERATIONAL GUIDELINES:\n"
            "1. To generate a departmental timetable, call `generate_timetable`.\n"
            "2. To review teachers on leave today, call `get_teachers_on_leave`.\n"
            "3. To grant final digital approval for leave, call `approve_leave`.\n"
            "4. To clear an attendance query and correct student attendance records in PostgreSQL, call `review_attendance_query` with action='APPROVE'.\n"
            "5. To appoint a Tutor Guardian, call `appoint_tg`.\n"
            "6. To add a faculty member, call `create_teacher`.\n"
            "7. To export workload or attendance reports, call `generate_workload_report` or `generate_attendance_report`.\n"
            "8. GROUNDING RULE: Only report operations as approved or generated if the corresponding tool execution returned success=true."
        ),
        allowed_tools=[
            "get_department_analytics", "generate_timetable", "get_timetable",
            "get_teachers_on_leave", "approve_leave", "reject_leave",
            "review_attendance_query", "appoint_tg", "create_teacher", "update_teacher",
            "deactivate_teacher", "get_teachers", "get_teacher", "get_teacher_workload",
            "create_student", "deactivate_student", "get_students", "get_student",
            "get_student_attendance", "create_subject", "delete_subject", "get_subjects",
            "create_classroom", "get_rooms", "check_room_availability",
            "generate_workload_report", "generate_attendance_report",
            "export_timetable_excel", "export_timetable_pdf", "inspect_attached_file"
        ]
    ),

    "ADMIN": AgentDefinition(
        name="AdminOperatorAgent",
        role="ADMIN",
        description="Superuser Autonomous CampusFlow Operator. Has unrestricted access across all tools, user management, and institutional system configurations.",
        system_instructions=(
            "You are the System Administrator Autonomous Operator for CampusFlow.\n"
            "You have full operational access across users, teachers, students, classrooms, subjects, timetables, and reports.\n"
            "OPERATIONAL GUIDELINES:\n"
            "1. Manage user accounts via `get_users`, `create_teacher`, `create_student`, `deactivate_teacher`.\n"
            "2. Manage classrooms via `create_classroom` and `get_rooms`.\n"
            "3. Manage subjects via `create_subject` and `delete_subject`.\n"
            "4. Manage departmental reports via `get_department_analytics` and `generate_workload_report`.\n"
            "5. CONFIRMATION RULE: Destructive actions like `deactivate_teacher`, `deactivate_student`, `delete_subject` REQUIRE confirmation from the user before executing."
        ),
        allowed_tools=[
            "get_users", "get_department_analytics", "create_teacher", "update_teacher",
            "deactivate_teacher", "create_student", "deactivate_student",
            "create_classroom", "get_rooms", "check_room_availability",
            "create_subject", "delete_subject", "get_subjects",
            "generate_timetable", "get_timetable", "export_timetable_excel", "export_timetable_pdf",
            "generate_workload_report", "generate_attendance_report",
            "get_teachers", "get_teacher", "get_students", "get_student",
            "get_student_attendance", "approve_leave", "reject_leave", "get_teachers_on_leave"
        ]
    )
}


class AgentFactory:
    """
    Dynamically loads and configures an Agent based on authenticated user credentials.
    """

    @staticmethod
    def create_agent_for_user(user_role: str, user_permissions: Optional[List[str]] = None) -> AgentDefinition:
        role_key = (user_role or "student").upper()
        if role_key in ["FACULTY", "PROFESSOR"]:
            role_key = "TEACHER"

        base_def = ROLE_AGENT_DEFINITIONS.get(role_key)
        if base_def is None:
            raise ValueError(f"Unsupported authenticated CampusFlow role: {role_key or '(missing)'}")

        # Dynamically refine allowed tools by the user's specific permissions
        from tools.tool_registry import agent_tool_registry
        permitted_tools = agent_tool_registry.get_tools_for_user(role_key, user_permissions)
        permitted_tool_names = [t.name for t in permitted_tools]

        effective_tools = [t for t in base_def.allowed_tools if t in permitted_tool_names]
        if "search_knowledge" in permitted_tool_names:
            effective_tools.append("search_knowledge")
        if role_key == "ADMIN":
            effective_tools = permitted_tool_names

        # Return customized agent instance
        return AgentDefinition(
            name=base_def.name,
            agent_id=base_def.name.lower().replace("operatoragent", "-operator"),
            role=base_def.role,
            description=base_def.description,
            goal=base_def.description,
            system_instructions=base_def.system_instructions,
            allowed_tools=effective_tools,
            model_name=base_def.model_name,
            planning_policy=base_def.planning_policy,
            verification_policy=base_def.verification_policy,
            memory_policy=base_def.memory_policy
        )
