import httpx
from typing import Dict, Any, Optional
from app.config import settings


def create_erp_client(user_token: str) -> httpx.AsyncClient:
    """
    Creates an httpx.AsyncClient pre-configured with the ERP API base URL
    and the user's delegated JWT. All ERP requests run with the user's exact permissions.
    """
    headers = {
        "Authorization": f"Bearer {user_token}",
        "Content-Type": "application/json"
    }
    return httpx.AsyncClient(
        base_url=settings.ERP_API_BASE_URL,
        headers=headers,
        timeout=15.0
    )
