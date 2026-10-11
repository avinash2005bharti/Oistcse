from pydantic import BaseModel, Field
from app.tools.base import tool, ToolContext
from app.documents.vision import analyze_image_with_vision
from app.documents.schemas.invoice import InvoiceData
from app.documents.schemas.resume import ResumeData


class ImageUrlInput(BaseModel):
    imageUrl: str = Field(..., description="Public or ImageKit URL of the document image")


@tool(
    name="extract_invoice_from_image",
    permission=None,
    write=False,
    schema=ImageUrlInput
)
async def extract_invoice_from_image(ctx: ToolContext, args: ImageUrlInput):
    """Extract structured invoice fields (vendor, invoice number, items, total) from an image."""
    result = await analyze_image_with_vision(
        image_url=args.imageUrl,
        prompt="Extract the invoice details into the JSON schema matching InvoiceData.",
        schema_cls=InvoiceData
    )
    return {"extracted_invoice": result}


@tool(
    name="parse_resume",
    permission=None,
    write=False,
    schema=ImageUrlInput
)
async def parse_resume(ctx: ToolContext, args: ImageUrlInput):
    """Extract structured candidate profile (name, email, skills, education) from a resume image/scan."""
    result = await analyze_image_with_vision(
        image_url=args.imageUrl,
        prompt="Extract candidate resume details into the JSON schema matching ResumeData.",
        schema_cls=ResumeData
    )
    return {"extracted_resume": result}
