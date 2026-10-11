import hmac
from typing import Dict, Any, Optional
from fastapi import Header, HTTPException, Depends
import jwt
from app.config import settings


def verify_service_key(
    x_service_key: Optional[str] = Header(None, alias="X-Service-Key"),
    x_internal_secret: Optional[str] = Header(None, alias="x-internal-secret")
) -> str:
    """
    Verifies that the request originates from the trusted Node gateway.
    Accepts X-Service-Key or x-internal-secret header.
    """
    expected = settings.get_service_key()
    provided = x_service_key or x_internal_secret

    if not expected or not provided or not hmac.compare_digest(expected, provided):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Valid X-Service-Key is required to access the AI service."
        )
    return provided


def get_user_context(
    authorization: Optional[str] = Header(None),
    _: str = Depends(verify_service_key)
) -> Dict[str, Any]:
    """
    Decodes the user's delegated identity from the Authorization Bearer header.
    The agent uses this identity and JWT to execute ERP tools on behalf of the user.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header with user JWT."
        )

    token = authorization.split("Bearer ")[1].strip()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_exp": True}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="User JWT token has expired.")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid user JWT token: {str(e)}")

    user_id = str(payload.get("id") or payload.get("sub") or payload.get("userId") or "")
    role = str(payload.get("role") or "STUDENT").upper()
    permissions = payload.get("permissions") or []
    tenant_id = payload.get("departmentId") or payload.get("tenantId") or "CSE"

    if not user_id:
        raise HTTPException(status_code=401, detail="JWT token missing user ID.")

    return {
        "userId": user_id,
        "role": role,
        "permissions": permissions,
        "tenantId": str(tenant_id),
        "raw_token": token,
        "email": payload.get("email"),
        "name": payload.get("name")
    }
