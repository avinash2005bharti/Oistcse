from typing import List, Dict, Any, Optional
import httpx
from loguru import logger
from app.documents.extractors import extract_text_from_bytes
from app.documents.vision import analyze_image_with_vision
from app.llm.schemas import FileUrlItem

MAX_FILES_PER_MESSAGE = 5
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


async def process_attached_files(file_items: Optional[List[FileUrlItem]]) -> str:
    """
    Downloads and extracts content from attached files.
    Wraps extracted content in clearly delimited <document untrusted="true"> tags
    so the reasoning model treats content purely as data, not instructions (§9 Security).
    """
    if not file_items:
        return ""

    if len(file_items) > MAX_FILES_PER_MESSAGE:
        return f"\n<warning>Too many attachments ({len(file_items)}). Only the first {MAX_FILES_PER_MESSAGE} were processed.</warning>\n"

    document_blocks: List[str] = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        for item in file_items[:MAX_FILES_PER_MESSAGE]:
            url = item.url
            filename = item.name or "attached_file"
            mime = (item.mime or "").lower()

            try:
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue

                content = resp.content
                if len(content) > MAX_FILE_BYTES:
                    document_blocks.append(
                        f'<document untrusted="true" name="{filename}">File exceeds 10MB limit; skipped.</document>'
                    )
                    continue

                if "image" in mime:
                    vision_res = await analyze_image_with_vision(
                        image_url=url,
                        prompt="Transcribe all visible text, tables, and details from this image accurately."
                    )
                    extracted_text = str(vision_res)
                else:
                    extracted_text = extract_text_from_bytes(content, mime)

                # Format inside untrusted data wrapper
                clean_text = extracted_text.strip()[:4000] if extracted_text else "No text extracted."
                block = f'<document untrusted="true" name="{filename}" mime="{mime}">\n{clean_text}\n</document>'
                document_blocks.append(block)

            except Exception as e:
                logger.warning(f"[Document Pipeline] Error processing {filename}: {e}")
                document_blocks.append(
                    f'<document untrusted="true" name="{filename}">Error reading file: {str(e)}</document>'
                )

    return "\n\n".join(document_blocks)
