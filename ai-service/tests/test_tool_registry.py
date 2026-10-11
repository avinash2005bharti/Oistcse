import pytest
from app.agents.factory import agent_factory
from app.tools.registry import get_tools_for, get_tool_definition


def test_agent_factory_loads_all_roles():
    for role in ["student", "teacher", "tg", "hod", "admin"]:
        agent = agent_factory.get_agent(role)
        assert agent is not None
        assert len(agent.tools) > 0
        assert "CORE RULES" in agent.system_prompt


def test_tool_filtering_by_permission():
    student_agent = agent_factory.get_agent("student")
    assert student_agent is not None

    # User with NO permissions
    tools_no_perms = get_tools_for(student_agent.tools, user_permissions=[])
    tool_names_no_perms = [t["function"]["name"] for t in tools_no_perms]
    # Tools requiring permissions must be filtered out
    assert "get_my_attendance" not in tool_names_no_perms
    assert "apply_leave" not in tool_names_no_perms

    # User WITH student permissions
    student_perms = ["ATTENDANCE_READ_SELF", "TIMETABLE_VIEW", "LEAVE_APPLY", "ATTENDANCE_QUERY_SUBMIT"]
    tools_with_perms = get_tools_for(student_agent.tools, user_permissions=student_perms)
    tool_names = [t["function"]["name"] for t in tools_with_perms]

    assert "get_my_attendance" in tool_names
    assert "get_my_timetable" in tool_names
    assert "apply_leave" in tool_names


def test_write_tools_have_flag_set():
    apply_leave_def = get_tool_definition("apply_leave")
    assert apply_leave_def is not None
    assert apply_leave_def.write is True

    get_attendance_def = get_tool_definition("get_my_attendance")
    assert get_attendance_def is not None
    assert get_attendance_def.write is False
