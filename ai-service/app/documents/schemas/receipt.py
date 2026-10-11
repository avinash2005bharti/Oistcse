from typing import Optional
from pydantic import BaseModel, Field


class ReceiptData(BaseModel):
    merchant_name: str = Field(..., description="Name of merchant or store")
    date: Optional[str] = Field(default=None, description="Date of transaction")
    total_amount: float = Field(..., description="Total amount paid")
    payment_method: Optional[str] = Field(default=None, description="Card, Cash, UPI, NetBanking")
    category: Optional[str] = Field(default="GENERAL", description="Expense category")
