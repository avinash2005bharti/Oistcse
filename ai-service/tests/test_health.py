import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "text_model" in data
    assert "vision_model" in data


def test_chat_without_service_key_returns_401():
    response = client.post(
        "/v1/agent/chat",
        json={"sessionId": "test-123", "text": "Hello"}
    )
    assert response.status_code == 401
    assert "Valid X-Service-Key is required" in response.json()["detail"]


def test_chat_with_invalid_service_key_returns_401():
    response = client.post(
        "/v1/agent/chat",
        headers={"X-Service-Key": "wrong-secret-key"},
        json={"sessionId": "test-123", "text": "Hello"}
    )
    assert response.status_code == 401
