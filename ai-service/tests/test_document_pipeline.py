import pytest
from app.documents.schemas.invoice import InvoiceData
from app.security.guard import redact_pii


def test_invoice_schema_validation():
    valid_payload = {
        "invoice_number": "INV-2024-001",
        "vendor_name": "Campus Office Supplies Ltd",
        "total_amount": 14500.0,
        "items": [
            {"description": "A4 Paper Reams", "quantity": 10, "unit_price": 450.0, "amount": 4500.0}
        ]
    }
    invoice = InvoiceData.model_validate(valid_payload)
    assert invoice.vendor_name == "Campus Office Supplies Ltd"
    assert invoice.total_amount == 14500.0
    assert len(invoice.items) == 1


def test_pii_redaction():
    sample = {
        "userId": "usr-123",
        "password": "SuperSecretPassword123",
        "bank_account": "1234567890123456",
        "note": "Payment processed to 9876543210987654 account"
    }
    redacted = redact_pii(sample)
    assert redacted["password"] == "[REDACTED]"
    assert redacted["bank_account"] == "[REDACTED]"
    assert "[REDACTED_NUM]" in redacted["note"]
