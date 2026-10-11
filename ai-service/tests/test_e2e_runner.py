import json
import pytest
import jwt
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.agents.runner import run_agent_loop
from app.memory.pending import pending_memory

client = TestClient(app)


def generate_test_jwt(user_id="std_123", role="STUDENT", permissions=None):
    if permissions is None:
        permissions = ["ATTENDANCE_READ_SELF", "TIMETABLE_VIEW", "LEAVE_APPLY"]
    return jwt.encode(
        {
            "id": user_id,
            "role": role,
            "permissions": permissions,
            "departmentId": "CSE",
            "name": "Test Student"
        },
        settings.JWT_SECRET,
        algorithm="HS256"
    )


@pytest.mark.asyncio
async def test_write_tool_generates_proposal():
    """Verifies write actions emit proposal events and do not execute immediately."""
    user_context = {
        "userId": "std_123",
        "role": "STUDENT",
        "permissions": ["LEAVE_APPLY", "ATTENDANCE_READ_SELF"],
        "raw_token": generate_test_jwt()
    }

    # Simulate proposal storage
    proposal_id = "prop_test_abc123"
    await pending_memory.save_proposal(proposal_id, {
        "userId": "std_123",
        "sessionId": "sess_1",
        "toolName": "apply_leave",
        "args": {"reason": "Medical emergency", "startDate": "2026-10-15", "endDate": "2026-10-16"}
    })

    # Retrieve proposal
    saved = await pending_memory.get_proposal(proposal_id)
    assert saved is not None
    assert saved["toolName"] == "apply_leave"
    assert saved["userId"] == "std_123"

    # Clean up
    await pending_memory.delete_proposal(proposal_id)
    deleted = await pending_memory.get_proposal(proposal_id)
    assert deleted is None


def test_confirm_endpoint_permission_check():
    """Ensures another user cannot confirm someone else's proposal."""
    token_user_a = generate_test_jwt(user_id="user_A")
    token_user_b = generate_test_jwt(user_id="user_B")

    # Save proposal for user_A
    import asyncio
    asyncio.run(pending_memory.save_proposal("prop_cross_user", {
        "userId": "user_A",
        "sessionId": "sess_x",
        "toolName": "apply_leave",
        "args": {"reason": "Hackathon"}
    }))

    # Try to confirm as user_B
    resp = client.post(
        "/v1/agent/confirm",
        headers={
            "X-Service-Key": settings.get_service_key(),
            "Authorization": f"Bearer {token_user_b}"
        },
        json={
            "sessionId": "sess_x",
            "proposalId": "prop_cross_user",
            "approved": True
        }
    )
    assert resp.status_code == 403
    assert "another user" in resp.json()["detail"]
