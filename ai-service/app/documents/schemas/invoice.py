from typing import List, Optional
from pydantic import BaseModel, Field


class InvoiceItem(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0
    amount: float = 0.0


class InvoiceData(BaseModel):
    invoice_number: Optional[str] = Field(default=None, description="Invoice or bill reference number")
    vendor_name: str = Field(..., description="Name of company or vendor issuing the invoice")
    date: Optional[str] = Field(default=None, description="Invoice issue date (YYYY-MM-DD)")
    due_date: Optional[str] = Field(default=None, description="Payment due date")
    items: List[InvoiceItem] = Field(default_factory=list, description="Line items")
    subtotal: float = 0.0
    tax: float = 0.0
    total_amount: float = Field(..., description="Total payable amount")
    currency: str = Field(default="INR", description="Currency symbol or code")
