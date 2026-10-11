import re
from typing import Dict, Any


def redact_pii(data: Any) -> Any:
    """
    Recursively redacts sensitive PII fields (passwords, tokens, bank numbers)
    from logs and audit stores.
    """
    if isinstance(data, dict):
        redacted = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(term in k_lower for term in ["password", "secret", "token", "hash", "credit_card", "cvv", "bank_account"]):
                redacted[k] = "[REDACTED]"
            else:
                redacted[k] = redact_pii(v)
        return redacted
    elif isinstance(data, list):
        return [redact_pii(item) for item in data]
    elif isinstance(data, str):
        # Redact 12-16 digit continuous numbers
        return re.sub(r"\b\d{12,16}\b", "[REDACTED_NUM]", data)
    return data
