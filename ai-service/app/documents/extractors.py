import io
from typing import Optional
from loguru import logger
import pypdf
import docx


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts raw text from a PDF document byte stream."""
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        extracted = []
        for i, page in enumerate(reader.pages):
            txt = page.extract_text()
            if txt:
                extracted.append(f"--- Page {i+1} ---\n{txt}")
        return "\n\n".join(extracted)
    except Exception as e:
        logger.warning(f"[PDF Extractor] Error extracting text: {e}")
        return ""


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extracts raw text from a DOCX document byte stream."""
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except Exception as e:
        logger.warning(f"[DOCX Extractor] Error extracting text: {e}")
        return ""


def extract_text_from_bytes(file_bytes: bytes, mime_type: str) -> str:
    """Routes file bytes to appropriate text extractor based on MIME."""
    mime = (mime_type or "").lower()
    if "pdf" in mime:
        return extract_text_from_pdf(file_bytes)
    elif "word" in mime or "docx" in mime:
        return extract_text_from_docx(file_bytes)
    elif "text" in mime or "plain" in mime or "csv" in mime or "json" in mime:
        try:
            return file_bytes.decode("utf-8", errors="replace")
        except Exception:
            return ""
    return ""
