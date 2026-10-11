"""
CampusFlow Centralized Agent Tool Registry
Single Source of Truth for Autonomous Operational AI Tools.
Strictly enforces:
- JSON Schema for input/output parameters
- Role-Based Access Control (RBAC)
- Resource-Level Authorization & Scope
- Confirmation for Destructive Actions
- Audit Logging to MongoDB
- Zero-Duplication Execution Gateway (calls Core Backend Services)
"""

import os
import json
import time
from typing import Dict, Any, List, Optional, Callable
from pydantic import BaseModel, Field
from loguru import logger
import requests
from dotenv import load_dotenv

load_dotenv()

from memory.mongo_memory import mongo_memory

NODE_BACKEND_URL = os.getenv("BACKEND_URL") or os.getenv("NODE_BACKEND_URL") or (
    "https://oistcse-server.onrender.com" if (os.getenv("RENDER") or os.getenv("ENVIRONMENT") == "production") else "http://localhost:5000"
)
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")


class ToolParameter(BaseModel):
    name: str
    type: str
    description: str
    required: bool = False
    default: Optional[Any] = None


class ToolDefinition(BaseModel):
    name: str
    description: str
    purpose: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    required_permissions: List[str] = Field(default_factory=list)
    allowed_roles: List[str] = Field(default_factory=list)
    requires_confirmation: bool = False
    is_destructive: bool = False
    operation: str = "read"
    backend_action: str


class ToolAuthorizationError(PermissionError):
    """A tool request was rejected before dispatch to the backend."""


class AgentToolRegistry:
    """
    Centralized Registry of all operational tools across CampusFlow.
    """

    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}
        self._register_all_tools()

    def register(self, tool: ToolDefinition):
        read_actions = {
            "getTeachers", "getTeacher", "getTeacherWorkload", "getTeacherAvailability",
            "getTeachersOnLeave", "getStudents", "getStudent", "getStudentAttendance",
            "getTimetable", "getStudentSchedule", "getTeacherSchedule", "getSubjects",
            "getRooms", "checkRoomAvailability", "getMentees", "getDepartmentAnalytics",
            "getUsers", "searchKnowledge", "exportTimetableExcel", "exportTimetablePDF",
            "generateWorkloadReport", "generateAttendanceReport", "inspectAttachedFile"
        }
        tool.operation = "read" if tool.backend_action in read_actions else "write"
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)

    def get_all_tools(self) -> List[ToolDefinition]:
        return list(self._tools.values())

    def get_tools_for_user(self, user_role: str, user_permissions: Optional[List[str]] = None) -> List[ToolDefinition]:
        """
        Dynamically returns only tools the authenticated user is authorized to execute.
        Enforces server-side RBAC.
        """
        role_upper = (user_role or "").upper()
        if role_upper in {"FACULTY", "PROFESSOR"}:
            role_upper = "TEACHER"
        perms = {str(permission).upper() for permission in (user_permissions or [])}
        is_admin = role_upper == "ADMIN"

        accessible_tools = []
        for tool in self._tools.values():
            # Role check
            if "ALL" not in tool.allowed_roles and role_upper not in tool.allowed_roles:
                continue

            # Permission check (if specific permissions required)
            if tool.required_permissions and not is_admin:
                has_perm = any(req_p.upper() in perms for req_p in tool.required_permissions)
                if not has_perm:
                    continue

            accessible_tools.append(tool)

        return accessible_tools

    def to_openai_tools(self, tool_definitions: List[ToolDefinition]) -> List[Dict[str, Any]]:
        """
        Converts tool definitions into the OpenAI/Groq function calling format.
        """
        formatted = []
        for t in tool_definitions:
            formatted.append({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema
                }
            })
        return formatted

    def execute_tool(self, tool_name: str, arguments: Dict[str, Any], user_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Autonomous Tool Execution Gateway.
        1. Verifies server-side authorization.
        2. Enforces confirmation for destructive actions.
        3. Invokes the existing Node core operation via the authenticated gateway.
        4. Returns failures as observations; it never bypasses backend services.
        """
        start_time = time.time()
        tool = self._tools.get(tool_name)
        if not tool:
            raise ToolAuthorizationError(f"Tool '{tool_name}' is not registered.")
        if not isinstance(arguments, dict):
            return {"success": False, "error": "INVALID_TOOL_ARGUMENTS", "message": "Tool arguments must be a JSON object."}

        schema = tool.input_schema
        required = schema.get("required", [])
        properties = schema.get("properties", {})
        missing = [key for key in required if key not in arguments]
        if missing:
            return {
                "success": False,
                "error": "INVALID_TOOL_ARGUMENTS",
                "message": f"Missing required tool arguments: {', '.join(missing)}."
            }
        for key, value in arguments.items():
            expected_type = properties.get(key, {}).get("type")
            valid_types = {
                "string": lambda item: isinstance(item, str),
                "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
                "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
                "boolean": lambda item: isinstance(item, bool),
                "array": lambda item: isinstance(item, list),
                "object": lambda item: isinstance(item, dict)
            }
            if expected_type in valid_types and not valid_types[expected_type](value):
                return {
                    "success": False,
                    "error": "INVALID_TOOL_ARGUMENTS",
                    "message": f"Argument '{key}' must be of type {expected_type}."
                }
            enum = properties.get(key, {}).get("enum")
            if enum and value not in enum:
                return {
                    "success": False,
                    "error": "INVALID_TOOL_ARGUMENTS",
                    "message": f"Argument '{key}' must be one of {enum}."
                }

        user_role = str(user_context.get("role") or "").upper()
        if user_role in {"FACULTY", "PROFESSOR"}:
            user_role = "TEACHER"
        raw_user_id = user_context.get("id") or user_context.get("userId") or user_context.get("user_id")
        user_id = str(raw_user_id) if raw_user_id else ""
        if not user_id or not user_role or not isinstance(user_context.get("permissions"), list):
            raise ToolAuthorizationError("A verified user identity, role, and permission list are required.")
        user_perms = {str(permission).upper() for permission in user_context["permissions"]}

        # 1. Authorization check
        if "ALL" not in tool.allowed_roles and user_role not in tool.allowed_roles:
            raise ToolAuthorizationError(f"Role '{user_role}' cannot execute '{tool_name}'.")

        if tool.required_permissions and user_role != "ADMIN":
            has_perm = any(permission.upper() in user_perms for permission in tool.required_permissions)
            if not has_perm:
                raise ToolAuthorizationError(
                    f"Missing permission for '{tool_name}'; requires one of {tool.required_permissions}."
                )

        # 2. Confirmation check for destructive actions
        is_confirmed = False
        if tool.requires_confirmation:
            target_desc = arguments.get("name") or arguments.get("code") or arguments.get("roomNumber") or "the selected resource"
            return {
                "success": False,
                "requires_confirmation": True,
                "confirmation_prompt": f"⚠️ **Confirmation Required:** Are you sure you want to execute `{tool_name}` on **{target_desc}**? This action cannot be undone.",
                "action_to_confirm": {
                    "tool": tool.backend_action,
                    "tool_name": tool.name,
                    "args": {**arguments, "confirmed": True},
                    "userId": user_id
                }
            }

        if tool.backend_action == "searchKnowledge":
            from agents.rag_agent import rag_agent

            query = arguments["query"]
            department = user_context.get("departmentCode")
            if not department:
                raise ToolAuthorizationError("The authenticated user's department scope is required for knowledge search.")
            try:
                retrieval = rag_agent.retrieve_context(
                    query=query,
                    collection=arguments.get("category"),
                    department=str(department),
                    top_k=arguments.get("top_k", 4),
                )
                execution_result = {
                    "success": True,
                    "data": {
                        "citations": retrieval["citations"],
                        "context": retrieval["formatted_context"],
                    },
                }
            except Exception as retrieval_error:
                logger.exception(f"[ToolRegistry] Knowledge retrieval failed: {retrieval_error}")
                execution_result = {
                    "success": False,
                    "error": "KNOWLEDGE_SEARCH_FAILED",
                    "message": "The institutional knowledge search could not be completed.",
                }
        if tool.backend_action == "inspectAttachedFile":
            file_id = arguments.get("file_id")
            fname_arg = arguments.get("filename") or arguments.get("name")
            conv_id = user_context.get("conversationId") or ""
            raw_uid = user_context.get("id") or user_context.get("userId") or user_context.get("user_id")
            doc = None
            try:
                import re
                from bson import ObjectId
                # 1. Lookup by ID if valid
                if file_id and mongo_memory.db is not None:
                    if ObjectId.is_valid(file_id):
                        doc = mongo_memory.db.file_documents.find_one({"_id": ObjectId(file_id)})
                    if not doc:
                        doc = mongo_memory.db.file_documents.find_one({"_id": str(file_id)})

                # 2. Lookup by filename / originalName regex
                query_name = fname_arg or (file_id if file_id and not ObjectId.is_valid(file_id) else None)
                if not doc and query_name and mongo_memory.db is not None:
                    doc = mongo_memory.db.file_documents.find_one(
                        {"$or": [
                            {"filename": {"$regex": re.escape(str(query_name)), "$options": "i"}},
                            {"originalName": {"$regex": re.escape(str(query_name)), "$options": "i"}}
                        ], "isDeleted": {"$ne": True}},
                        sort=[("_id", -1)]
                    )

                # 3. Lookup by conversationId
                if not doc and conv_id and mongo_memory.db is not None:
                    doc = mongo_memory.db.file_documents.find_one(
                        {"conversationId": conv_id, "isDeleted": {"$ne": True}},
                        sort=[("_id", -1)]
                    )

                # 4. Lookup latest file by user ID
                if not doc and raw_uid and mongo_memory.db is not None:
                    doc = mongo_memory.db.file_documents.find_one(
                        {"userId": str(raw_uid), "isDeleted": {"$ne": True}},
                        sort=[("_id", -1)]
                    )

                # 5. Fallback to most recent file in system
                if not doc and mongo_memory.db is not None:
                    doc = mongo_memory.db.file_documents.find_one(
                        {"isDeleted": {"$ne": True}},
                        sort=[("_id", -1)]
                    )
            except Exception as e:
                logger.error(f"[ToolRegistry] Error fetching attached file document: {e}")

            if not doc:
                execution_result = {
                    "success": False,
                    "error": "FILE_NOT_FOUND",
                    "message": "No attached file or document found for this reference. Please attach or specify a file name."
                }
            else:
                extracted = doc.get("extractedContent") or {}
                ftype = str(doc.get("fileType", "")).lower()
                mime = str(doc.get("mimeType", "")).lower()
                storage_url = doc.get("storageUrl") or ""

                # On-demand extraction if summary and text are missing
                if not extracted.get("summary") and not extracted.get("fullText"):
                    try:
                        if ftype in ("jpg", "jpeg", "png", "webp") or "image" in mime:
                            from file_processing.image_pipeline import image_pipeline
                            norm = image_pipeline.process(
                                image_url=storage_url,
                                filename=doc.get("filename", ""),
                                document_id=str(doc.get("_id", ""))
                            )
                            if norm:
                                extracted = {
                                    "summary": norm.summary or (norm.visual_analyses[0].description if norm.visual_analyses else ""),
                                    "textPreview": (norm.text or "")[:400],
                                    "fullText": norm.text or "",
                                    "tables": norm.tables or [],
                                    "structuredData": norm.structured_data or {},
                                    "hasVisualContent": True
                                }
                                doc["extractedContent"] = extracted
                                if mongo_memory.db is not None:
                                    mongo_memory.db.file_documents.update_one(
                                        {"_id": doc["_id"]},
                                        {"$set": {"processingStatus": "completed", "extractedContent": extracted}}
                                    )
                        elif ftype == "pdf" or "pdf" in mime:
                            from file_processing.pdf_pipeline import pdf_pipeline
                            norm = pdf_pipeline.process(
                                file_url=storage_url,
                                filename=doc.get("filename", ""),
                                document_id=str(doc.get("_id", ""))
                            )
                            if norm and norm.text:
                                extracted = {
                                    "summary": norm.summary or f"PDF document '{doc.get('filename')}'.",
                                    "textPreview": (norm.text or "")[:400],
                                    "fullText": norm.text or "",
                                    "tables": norm.tables or [],
                                    "structuredData": norm.structured_data or {},
                                    "hasVisualContent": norm.has_visual_content
                                }
                                doc["extractedContent"] = extracted
                                if mongo_memory.db is not None:
                                    mongo_memory.db.file_documents.update_one(
                                        {"_id": doc["_id"]},
                                        {"$set": {"processingStatus": "completed", "extractedContent": extracted}}
                                    )
                    except Exception as extract_err:
                        logger.warning(f"[ToolRegistry] On-demand extraction warning: {extract_err}")

                execution_result = {
                    "success": True,
                    "document_id": str(doc.get("_id", "")),
                    "filename": doc.get("filename") or doc.get("originalName"),
                    "file_type": doc.get("fileType"),
                    "mime_type": doc.get("mimeType"),
                    "storage_url": doc.get("storageUrl"),
                    "processing_status": doc.get("processingStatus"),
                    "summary": extracted.get("summary") or "No text summary available.",
                    "full_text": extracted.get("fullText") or extracted.get("textPreview") or "",
                    "tables": extracted.get("tables") or [],
                    "structured_data": extracted.get("structuredData") or {}
                }
            duration_ms = int((time.time() - start_time) * 1000)
            try:
                mongo_memory.log_agent_execution(
                    agent_name=f"ToolExecutor:{tool_name}",
                    user_id=user_id,
                    action=tool.backend_action,
                    input_data={"arguments": arguments, "department": department},
                    output_data={"success": execution_result["success"]},
                    duration_ms=duration_ms,
                )
            except Exception as audit_err:
                logger.error(f"[ToolRegistry] Could not record tool execution audit for {tool_name}: {audit_err}")
            return execution_result

        # 3. Execution Gateway
        execution_result = None
        used_gateway = "HTTP_CORE_SERVICE"

        # Try executing via Node Backend Core Service Layer (POST /api/ai/tools/execute)
        try:
            if not INTERNAL_API_SECRET:
                return {
                    "success": False,
                    "error": "TOOL_GATEWAY_NOT_CONFIGURED",
                    "message": "The authenticated Node tool gateway is unavailable because INTERNAL_API_SECRET is not configured."
                }
            url = f"{NODE_BACKEND_URL}/api/ai/tools/execute"
            headers = {
                "Content-Type": "application/json",
                "x-internal-secret": INTERNAL_API_SECRET,
                "x-user-id": user_id
            }
            payload = {
                "tool": tool.backend_action,
                "args": arguments,
                "confirmed": is_confirmed,
                "agentId": user_context.get("agentId"),
                "conversationId": user_context.get("conversationId")
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=12)
            try:
                execution_result = resp.json()
            except ValueError:
                execution_result = {
                    "success": False,
                    "error": "INVALID_TOOL_GATEWAY_RESPONSE",
                    "message": "The Node tool gateway returned a non-JSON response."
                }
            if not resp.ok:
                execution_result = {
                    "success": False,
                    "error": execution_result.get("code") or "TOOL_GATEWAY_ERROR",
                    "message": execution_result.get("message") or f"Tool gateway returned HTTP {resp.status_code}."
                }
        except Exception as http_err:
            logger.error(f"[ToolRegistry] Core tool gateway request failed: {http_err}")
            execution_result = {
                "success": False,
                "error": "TOOL_GATEWAY_UNAVAILABLE",
                "message": "The core ERP tool gateway could not be reached; no direct database fallback was attempted."
            }

        duration_ms = int((time.time() - start_time) * 1000)

        # 4. Comprehensive Audit Logging
        try:
            mongo_memory.log_agent_execution(
                agent_name=f"ToolExecutor:{tool_name}",
                user_id=user_id,
                action=tool.backend_action,
                input_data={"arguments": arguments, "gateway": used_gateway},
                output_data={"success": execution_result.get("success", False), "data_preview": str(execution_result.get("data"))[:150]},
                duration_ms=duration_ms
            )
        except Exception as audit_err:
            logger.error(f"[ToolRegistry] Could not record tool execution audit for {tool_name}: {audit_err}")

        return execution_result

    def _register_all_tools(self):
        """
        Registers all 42 core operational tools across CampusFlow.
        """
        self.register(ToolDefinition(
            name="search_knowledge",
            description="Search institution-indexed policies, curriculum documents, and uploaded academic materials.",
            purpose="Institutional Knowledge Retrieval",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Question or phrase to search for."},
                    "category": {"type": "string", "description": "Optional indexed document category."},
                    "top_k": {"type": "integer", "description": "Maximum number of passages to return."}
                },
                "required": ["query"]
            },
            output_schema={"type": "object", "properties": {"citations": {"type": "array"}, "context": {"type": "string"}}},
            required_permissions=["AI_CHAT"],
            allowed_roles=["STUDENT", "TEACHER", "TG", "HOD", "ADMIN"],
            backend_action="searchKnowledge"
        ))

        # =====================================================================
        # 1. TEACHER & FACULTY MANAGEMENT
        # =====================================================================
        self.register(ToolDefinition(
            name="get_teachers",
            description="List and filter active faculty members within the authenticated user's authorized department scope.",
            purpose="Faculty Directory",
            input_schema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["ACTIVE", "INACTIVE"], "description": "Filter by status"},
                    "isTG": {"type": "boolean", "description": "Filter by Tutor Guardian status"},
                    "designation": {"type": "string", "description": "Filter by designation (e.g. Professor, Assistant Professor)"}
                }
            },
            output_schema={"type": "object", "properties": {"count": {"type": "integer"}, "data": {"type": "array"}}},
            required_permissions=["FACULTY_MANAGE", "TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="getTeachers"
        ))

        self.register(ToolDefinition(
            name="get_teacher",
            description="Get complete details, assigned subjects, and weekly teaching schedule of a specific teacher by name or ID.",
            purpose="Faculty Profile & Schedule",
            input_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name or partial name of the faculty member"},
                    "teacherId": {"type": "string", "description": "Unique UUID of the teacher"}
                },
                "required": []
            },
            output_schema={"type": "object", "properties": {"data": {"type": "object"}}},
            required_permissions=["FACULTY_MANAGE", "TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="getTeacher"
        ))

        self.register(ToolDefinition(
            name="create_teacher",
            description="Create a new faculty member with an institutional user account in PostgreSQL.",
            purpose="Faculty Creation",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "name": {"type": "string", "description": "Full name of the faculty member"},
                    "email": {"type": "string", "description": "Official institutional email address"},
                    "phone": {"type": "string", "description": "Contact phone number"},
                    "designation": {"type": "string", "description": "Designation (default: Assistant Professor)"},
                    "isTG": {"type": "boolean", "description": "Whether faculty is assigned as Tutor Guardian (default: false)"},
                    "maxPeriodsPerDay": {"type": "integer", "description": "Maximum lecture periods per day (default: 4)"},
                    "maxPeriodsPerWeek": {"type": "integer", "description": "Maximum lecture periods per week (default: 18)"}
                },
                "required": ["name"]
            },
            output_schema={"type": "object", "properties": {"data": {"type": "object"}}},
            required_permissions=["FACULTY_MANAGE"],
            allowed_roles=["ADMIN", "HOD"],
            requires_confirmation=False,
            backend_action="createTeacher"
        ))

        self.register(ToolDefinition(
            name="update_teacher",
            description="Update an existing teacher's designation, contact phone, or maximum period limits.",
            purpose="Faculty Modification",
            input_schema={
                "type": "object",
                "properties": {
                    "teacherId": {"type": "string", "description": "UUID of the teacher to update"},
                    "name": {"type": "string", "description": "Name of the teacher to update"},
                    "designation": {"type": "string"},
                    "phone": {"type": "string"},
                    "maxPeriodsPerDay": {"type": "integer"},
                    "maxPeriodsPerWeek": {"type": "integer"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["FACULTY_MANAGE"],
            allowed_roles=["ADMIN", "HOD"],
            backend_action="updateTeacher"
        ))

        self.register(ToolDefinition(
            name="deactivate_teacher",
            description="Deactivate a faculty member in PostgreSQL. DESTRUCTIVE: Requires user confirmation.",
            purpose="Faculty Deactivation",
            input_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name of the faculty member to deactivate"},
                    "teacherId": {"type": "string", "description": "UUID of the faculty member"},
                    "confirmed": {"type": "boolean", "description": "Confirmation flag"}
                },
                "required": []
            },
            output_schema={"type": "object"},
            required_permissions=["FACULTY_MANAGE"],
            allowed_roles=["ADMIN", "HOD"],
            requires_confirmation=True,
            is_destructive=True,
            backend_action="deactivateTeacher"
        ))

        self.register(ToolDefinition(
            name="get_teacher_workload",
            description="Analyze faculty weekly teaching workload, assigned periods, and maximum capacity limits.",
            purpose="Faculty Workload Analysis",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code; administrators must select a department."}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["FACULTY_MANAGE", "REPORT_VIEW"],
            allowed_roles=["TEACHER", "TG", "HOD", "ADMIN"],
            backend_action="getTeacherWorkload"
        ))

        self.register(ToolDefinition(
            name="get_teacher_availability",
            description="Check a teacher's schedule availability for a specific day and period to identify free slots.",
            purpose="Faculty Availability",
            input_schema={
                "type": "object",
                "properties": {
                    "teacher": {"type": "string", "description": "Name of the faculty member"},
                    "day": {"type": "string", "description": "Day of week (Monday, Tuesday, etc.)"},
                    "period": {"type": "integer", "description": "Period number (1 to 7)"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="getTeacherAvailability"
        ))

        self.register(ToolDefinition(
            name="get_teachers_on_leave",
            description="List all teachers on leave today or on a specific date, with their affected lecture slots.",
            purpose="Absence Tracking",
            input_schema={
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format (default: today)"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW", "FACULTY_MANAGE", "LEAVE_APPROVE_HOD"],
            allowed_roles=["ALL"],
            backend_action="getTeachersOnLeave"
        ))

        self.register(ToolDefinition(
            name="mark_teacher_leave",
            description="Record a teacher absence for today or tomorrow and calculate affected classes requiring substitution.",
            purpose="Teacher Absence Recording",
            input_schema={
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date of leave (YYYY-MM-DD or 'tomorrow')"},
                    "reason": {"type": "string", "description": "Reason for leave"},
                    "teacherId": {"type": "string", "description": "Optional teacher UUID (defaults to logged-in teacher)"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["LEAVE_APPLY", "FACULTY_MANAGE"],
            allowed_roles=["TEACHER", "TG", "HOD", "ADMIN"],
            backend_action="markTeacherLeave"
        ))

        # =====================================================================
        # 2. STUDENT MANAGEMENT
        # =====================================================================
        self.register(ToolDefinition(
            name="get_students",
            description="List enrolled students filtered by semester and section.",
            purpose="Student Directory",
            input_schema={
                "type": "object",
                "properties": {
                    "semester": {"type": "integer", "description": "Semester number (e.g. 5)"},
                    "section": {"type": "string", "description": "Section name (e.g. A, B, C)"},
                    "status": {"type": "string", "enum": ["ACTIVE", "INACTIVE"]}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["STUDENT_LIST_VIEW"],
            allowed_roles=["TEACHER", "TG", "HOD", "ADMIN"],
            backend_action="getStudents"
        ))

        self.register(ToolDefinition(
            name="get_student",
            description="Get complete student profile, enrollment number, section, and Tutor Guardian details.",
            purpose="Student Profile",
            input_schema={
                "type": "object",
                "properties": {
                    "studentId": {"type": "string", "description": "Student UUID"},
                    "enrollmentNo": {"type": "string", "description": "Enrollment Number (e.g. 0103CS231001)"},
                    "name": {"type": "string", "description": "Student full or partial name"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["STUDENT_PROFILE_READ", "STUDENT_LIST_VIEW"],
            allowed_roles=["ALL"],
            backend_action="getStudent"
        ))

        self.register(ToolDefinition(
            name="create_student",
            description="Register a new student with section and user credentials in PostgreSQL.",
            purpose="Student Registration",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "name": {"type": "string", "description": "Full name"},
                    "enrollmentNo": {"type": "string", "description": "Unique University Enrollment Number"},
                    "email": {"type": "string", "description": "Student email address"},
                    "semester": {"type": "integer", "default": 5},
                    "section": {"type": "string", "default": "A"},
                    "phone": {"type": "string"}
                },
                "required": ["name"]
            },
            output_schema={"type": "object"},
            required_permissions=["USER_CREATE"],
            allowed_roles=["ADMIN", "HOD"],
            backend_action="createStudent"
        ))

        self.register(ToolDefinition(
            name="deactivate_student",
            description="Deactivate a student in PostgreSQL. DESTRUCTIVE: Requires user confirmation.",
            purpose="Student Deactivation",
            input_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Student name"},
                    "enrollmentNo": {"type": "string", "description": "Enrollment number"},
                    "studentId": {"type": "string"},
                    "confirmed": {"type": "boolean"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["USER_DELETE"],
            allowed_roles=["ADMIN", "HOD"],
            requires_confirmation=True,
            is_destructive=True,
            backend_action="deactivateStudent"
        ))

        # =====================================================================
        # 3. ATTENDANCE OPERATIONS
        # =====================================================================
        self.register(ToolDefinition(
            name="get_student_attendance",
            description="Retrieve student attendance records and calculate percentage against the 75% statutory threshold.",
            purpose="Attendance Lookup",
            input_schema={
                "type": "object",
                "properties": {
                    "studentId": {"type": "string", "description": "Student UUID (defaults to logged-in student)"},
                    "enrollmentNo": {"type": "string", "description": "Enrollment Number"},
                    "name": {"type": "string", "description": "Student name"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["ATTENDANCE_READ_SELF", "ATTENDANCE_VIEW_ALL"],
            allowed_roles=["ALL"],
            backend_action="getStudentAttendance"
        ))

        self.register(ToolDefinition(
            name="mark_attendance",
            description="Mark attendance (PRESENT / ABSENT / EXCUSED) for a student in a specific subject and period in PostgreSQL.",
            purpose="Mark Attendance",
            input_schema={
                "type": "object",
                "properties": {
                    "studentId": {"type": "string", "description": "Student UUID, enrollment number, or student name"},
                    "subjectCode": {"type": "string", "description": "Subject code (e.g. CS501)"},
                    "status": {"type": "string", "enum": ["PRESENT", "ABSENT", "EXCUSED"], "default": "PRESENT"},
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format (default: today)"},
                    "periodNumber": {"type": "integer", "default": 1},
                    "remarks": {"type": "string"}
                },
                "required": ["studentId", "subjectCode"]
            },
            output_schema={"type": "object"},
            required_permissions=["ATTENDANCE_MARK"],
            allowed_roles=["TEACHER", "TG", "HOD", "ADMIN"],
            backend_action="markAttendance"
        ))

        self.register(ToolDefinition(
            name="bulk_mark_attendance",
            description="Record attendance for an entire class/section, specifying which students are absent. Requires confirmation.",
            purpose="Bulk Class Attendance",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code. Required for administrators with no department scope."},
                    "semester": {"type": "integer", "default": 5},
                    "section": {"type": "string", "default": "A"},
                    "subjectCode": {"type": "string", "description": "Subject code (e.g. CS501)"},
                    "absentEnrollments": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of enrollment numbers of absent students"
                    },
                    "date": {"type": "string"},
                    "periodNumber": {"type": "integer", "default": 1},
                    "confirmed": {"type": "boolean"}
                },
                "required": ["subjectCode"]
            },
            output_schema={"type": "object"},
            required_permissions=["ATTENDANCE_MARK"],
            allowed_roles=["TEACHER", "TG", "HOD", "ADMIN"],
            requires_confirmation=True,
            backend_action="bulkMarkAttendance"
        ))

        self.register(ToolDefinition(
            name="submit_attendance_query",
            description="Submit an attendance dispute or query when incorrectly marked absent.",
            purpose="Attendance Query Submission",
            input_schema={
                "type": "object",
                "properties": {
                    "subjectCode": {"type": "string", "description": "Subject code"},
                    "date": {"type": "string", "description": "Date of missed lecture"},
                    "reason": {"type": "string", "description": "Explanation of attendance dispute"}
                },
                "required": ["subjectCode", "reason"]
            },
            output_schema={"type": "object"},
            required_permissions=["ATTENDANCE_QUERY_SUBMIT"],
            allowed_roles=["STUDENT"],
            backend_action="submitAttendanceQuery"
        ))

        self.register(ToolDefinition(
            name="review_attendance_query",
            description="Review, recommend, or approve an attendance correction request. Approving automatically updates the attendance ledger to PRESENT in PostgreSQL.",
            purpose="Attendance Query Review & Approval",
            input_schema={
                "type": "object",
                "properties": {
                    "queryId": {"type": "string", "description": "Correction request UUID"},
                    "action": {"type": "string", "enum": ["APPROVE", "RECOMMEND", "REJECT"], "default": "APPROVE"},
                    "remarks": {"type": "string", "description": "Review remarks"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["ATTENDANCE_QUERY_REVIEW", "ATTENDANCE_QUERY_APPROVE"],
            allowed_roles=["TG", "HOD", "ADMIN"],
            backend_action="reviewAttendanceQuery"
        ))

        # =====================================================================
        # 4. LEAVE OPERATIONS
        # =====================================================================
        self.register(ToolDefinition(
            name="apply_leave",
            description="Submit a formal leave application for a student or faculty member in PostgreSQL.",
            purpose="Leave Application",
            input_schema={
                "type": "object",
                "properties": {
                    "leaveType": {"type": "string", "enum": ["CASUAL", "MEDICAL", "DUTY", "OD"], "default": "CASUAL"},
                    "startDate": {"type": "string", "description": "Start date (YYYY-MM-DD or 'tomorrow')"},
                    "endDate": {"type": "string", "description": "End date (YYYY-MM-DD, defaults to startDate)"},
                    "reason": {"type": "string", "description": "Detailed justification for leave"},
                    "studentId": {"type": "string", "description": "Optional if submitting on behalf of a student"}
                },
                "required": ["reason"]
            },
            output_schema={"type": "object"},
            required_permissions=["LEAVE_APPLY"],
            allowed_roles=["ALL"],
            backend_action="applyLeave"
        ))

        self.register(ToolDefinition(
            name="approve_leave",
            description="Approve a pending leave application for a student or teacher in PostgreSQL.",
            purpose="Leave Approval",
            input_schema={
                "type": "object",
                "properties": {
                    "leaveId": {"type": "string", "description": "Leave Application UUID"},
                    "applicant": {"type": "string", "description": "Name of applicant"},
                    "remarks": {"type": "string", "description": "Approval remarks"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["LEAVE_APPROVE_HOD"],
            allowed_roles=["TG", "HOD", "ADMIN"],
            backend_action="approveLeave"
        ))

        self.register(ToolDefinition(
            name="reject_leave",
            description="Reject a pending leave application with a recorded justification in PostgreSQL.",
            purpose="Leave Rejection",
            input_schema={
                "type": "object",
                "properties": {
                    "leaveId": {"type": "string", "description": "Leave Application UUID"},
                    "reason": {"type": "string", "description": "Rejection reason"}
                },
                "required": ["reason"]
            },
            output_schema={"type": "object"},
            required_permissions=["LEAVE_APPROVE_HOD"],
            allowed_roles=["TG", "HOD", "ADMIN"],
            backend_action="rejectLeave"
        ))

        # =====================================================================
        # 5. TIMETABLE & SCHEDULING OPERATIONS
        # =====================================================================
        self.register(ToolDefinition(
            name="get_timetable",
            description="Retrieve master departmental timetable schedule for a given semester and section.",
            purpose="Timetable Schedule",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "semester": {"type": "integer", "default": 5},
                    "section": {"type": "string", "default": "A"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="getTimetable"
        ))

        self.register(ToolDefinition(
            name="get_student_schedule",
            description="Get the student's personal weekly class schedule, subjects, rooms, and period timings.",
            purpose="Student Personal Timetable",
            input_schema={
                "type": "object",
                "properties": {
                    "semester": {"type": "integer"},
                    "section": {"type": "string"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="getStudentSchedule"
        ))

        self.register(ToolDefinition(
            name="get_teacher_schedule",
            description="Get a faculty member's personal weekly teaching schedule, allocated classrooms, and assigned sections.",
            purpose="Teacher Teaching Schedule",
            input_schema={
                "type": "object",
                "properties": {
                    "teacherId": {"type": "string"},
                    "name": {"type": "string"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["TEACHER", "TG", "HOD", "ADMIN"],
            backend_action="getTeacherSchedule"
        ))

        self.register(ToolDefinition(
            name="generate_timetable",
            description="Generate an optimized timetable draft in PostgreSQL using deterministic constraint optimization.",
            purpose="Timetable Generation",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "semester": {"type": "integer", "default": 5},
                    "section": {"type": "string", "default": "A"},
                    "fileId": {"type": "string", "description": "Optional attached curriculum document ID"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_GENERATE"],
            allowed_roles=["HOD", "ADMIN"],
            backend_action="generateTimetable"
        ))

        self.register(ToolDefinition(
            name="export_timetable_excel",
            description="Generate and export the master timetable as a downloadable Microsoft Excel (.xlsx) file.",
            purpose="Export Timetable Excel",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "semester": {"type": "integer", "default": 5},
                    "section": {"type": "string", "default": "A"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="exportTimetableExcel"
        ))

        self.register(ToolDefinition(
            name="export_timetable_pdf",
            description="Generate and export the master timetable as a downloadable PDF document.",
            purpose="Export Timetable PDF",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "semester": {"type": "integer", "default": 5},
                    "section": {"type": "string", "default": "A"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="exportTimetablePDF"
        ))

        # =====================================================================
        # 6. SUBJECTS, ROOMS & INFRASTRUCTURE
        # =====================================================================
        self.register(ToolDefinition(
            name="get_subjects",
            description="List active academic curriculum courses and subjects for a given semester.",
            purpose="Curriculum Subjects",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "semester": {"type": "integer", "description": "Filter by semester number"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="getSubjects"
        ))

        self.register(ToolDefinition(
            name="create_subject",
            description="Add an academic subject/course to an authorized department's curriculum in PostgreSQL.",
            purpose="Subject Creation",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "code": {"type": "string", "description": "Subject Code (e.g. CS501)"},
                    "name": {"type": "string", "description": "Subject Name (e.g. Database Management Systems)"},
                    "semester": {"type": "integer", "default": 5},
                    "credits": {"type": "integer", "default": 4},
                    "weeklyHours": {"type": "integer", "default": 4},
                    "isElective": {"type": "boolean", "default": False}
                },
                "required": ["code", "name"]
            },
            output_schema={"type": "object"},
            required_permissions=["SUBJECT_MANAGE"],
            allowed_roles=["HOD", "ADMIN"],
            backend_action="createSubject"
        ))

        self.register(ToolDefinition(
            name="delete_subject",
            description="Delete an academic subject from PostgreSQL. DESTRUCTIVE: Requires user confirmation.",
            purpose="Subject Deletion",
            input_schema={
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Subject code to delete"},
                    "confirmed": {"type": "boolean"}
                },
                "required": ["code"]
            },
            output_schema={"type": "object"},
            required_permissions=["SUBJECT_MANAGE"],
            allowed_roles=["HOD", "ADMIN"],
            requires_confirmation=True,
            is_destructive=True,
            backend_action="deleteSubject"
        ))

        self.register(ToolDefinition(
            name="get_rooms",
            description="List all lecture halls, tutorial rooms, and computer laboratories.",
            purpose="Classroom Inventory",
            input_schema={"type": "object", "properties": {}},
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="getRooms"
        ))

        self.register(ToolDefinition(
            name="check_room_availability",
            description="Check which classrooms and labs are currently vacant and available for occupancy.",
            purpose="Room Vacancy Check",
            input_schema={
                "type": "object",
                "properties": {
                    "day": {"type": "string", "description": "Day of week"},
                    "period": {"type": "integer", "description": "Period number"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["TIMETABLE_VIEW"],
            allowed_roles=["ALL"],
            backend_action="checkRoomAvailability"
        ))

        self.register(ToolDefinition(
            name="create_classroom",
            description="Register a new classroom or lab in the department inventory.",
            purpose="Classroom Registration",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "roomNumber": {"type": "string", "description": "Room number (e.g. CS-204)"},
                    "building": {"type": "string", "description": "Optional building name."},
                    "capacity": {"type": "integer", "default": 60},
                    "type": {"type": "string", "enum": ["LECTURE_HALL", "LAB", "SEMINAR_HALL"], "default": "LECTURE_HALL"}
                },
                "required": ["roomNumber"]
            },
            output_schema={"type": "object"},
            required_permissions=["DEPARTMENT_MANAGE"],
            allowed_roles=["ADMIN", "HOD"],
            backend_action="createClassroom"
        ))

        # =====================================================================
        # 7. TG / MENTOR OPERATIONS
        # =====================================================================
        self.register(ToolDefinition(
            name="get_mentees",
            description="List all students assigned to this Tutor Guardian (TG) and check their attendance percentage.",
            purpose="Mentee Monitoring",
            input_schema={
                "type": "object",
                "properties": {
                    "onlyShortage": {"type": "boolean", "default": False, "description": "If true, only returns students below 75% attendance"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["MENTEE_MONITOR"],
            allowed_roles=["TG", "HOD", "ADMIN"],
            backend_action="getMentees"
        ))

        self.register(ToolDefinition(
            name="appoint_tg",
            description="Appoint a faculty member as Tutor Guardian (TG) for a semester section.",
            purpose="Appoint Tutor Guardian",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "name": {"type": "string", "description": "Faculty name"},
                    "semester": {"type": "integer", "default": 5},
                    "section": {"type": "string", "default": "A"}
                },
                "required": ["name"]
            },
            output_schema={"type": "object"},
            required_permissions=["FACULTY_MANAGE"],
            allowed_roles=["HOD", "ADMIN"],
            backend_action="appointTg"
        ))

        # =====================================================================
        # 8. REPORTING & ANALYTICS
        # =====================================================================
        self.register(ToolDefinition(
            name="generate_workload_report",
            description="Generate a downloadable Excel report detailing faculty weekly teaching workload and capacities.",
            purpose="Faculty Workload Report",
            input_schema={"type": "object", "properties": {}},
            output_schema={"type": "object"},
            required_permissions=["REPORT_GENERATE"],
            allowed_roles=["HOD", "ADMIN"],
            backend_action="generateWorkloadReport"
        ))

        self.register(ToolDefinition(
            name="generate_attendance_report",
            description="Generate a comprehensive Excel attendance report for a semester identifying students with attendance shortage.",
            purpose="Semester Attendance Report",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code, required for administrators without a department scope."},
                    "semester": {"type": "integer", "default": 5}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["REPORT_GENERATE"],
            allowed_roles=["HOD", "ADMIN"],
            backend_action="generateAttendanceReport"
        ))

        self.register(ToolDefinition(
            name="get_department_analytics",
            description="Get high-level statistics: student counts, faculty counts, subjects, and pending operations.",
            purpose="Department Overview",
            input_schema={
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department code. Omit to aggregate all departments as administrator."}
                }
            },
            output_schema={"type": "object"},
            required_permissions=["REPORT_VIEW"],
            allowed_roles=["HOD", "ADMIN"],
            backend_action="getDepartmentAnalytics"
        ))

        self.register(ToolDefinition(
            name="get_users",
            description="List user accounts with roles and activity statuses.",
            purpose="User Management",
            input_schema={"type": "object", "properties": {}},
            output_schema={"type": "object"},
            required_permissions=["USER_READ"],
            allowed_roles=["ADMIN"],
            backend_action="getUsers"
        ))

        # =====================================================================
        # 9. UNIVERSAL DOCUMENT & ATTACHMENT INTELLIGENCE
        # =====================================================================
        self.register(ToolDefinition(
            name="inspect_attached_file",
            description="Inspect the extracted content, OCR text, data tables, or visual analysis of an attached image or document.",
            purpose="Inspect Attached Document or Image",
            input_schema={
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "Optional MongoDB File ID. If omitted, inspects the latest file attached to this conversation."},
                    "query": {"type": "string", "description": "Optional question or focus area (e.g. 'summary', 'tables', 'description')"}
                }
            },
            output_schema={"type": "object"},
            required_permissions=[],
            allowed_roles=["ALL"],
            backend_action="inspectAttachedFile"
        ))


agent_tool_registry = AgentToolRegistry()
