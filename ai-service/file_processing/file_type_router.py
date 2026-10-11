"""
File Type Router — Automatically detects file type and routes to the correct processing pipeline.
Central entry point for the Universal File Intelligence Pipeline.
"""

import os
import httpx
from typing import Dict, Any, Optional
from loguru import logger

from file_processing.normalizer import NormalizedContent
from file_processing.image_pipeline import image_pipeline
from file_processing.pdf_pipeline import pdf_pipeline
from file_processing.excel_pipeline import excel_pipeline
from file_processing.pptx_pipeline import pptx_pipeline
from file_processing.docx_pipeline import docx_pipeline
from file_processing.text_pipeline import text_pipeline
from file_processing.chunker import intelligent_chunker
from rag.qdrant_manager import qdrant_manager

NODE_BACKEND_URL = "http://localhost:5000" if not os.getenv("RENDER") else (
    os.getenv("NODE_BACKEND_URL") or os.getenv("BACKEND_URL") or "https://oistcse-server.onrender.com"
)


# File type classification
IMAGE_TYPES = {'png', 'jpg', 'jpeg', 'webp'}
PDF_TYPES = {'pdf'}
EXCEL_TYPES = {'xlsx', 'xls', 'csv'}
PPTX_TYPES = {'pptx', 'ppt'}
DOCX_TYPES = {'docx', 'doc'}
TEXT_TYPES = {'txt'}


class FileTypeRouter:
    """
    Routes files to the correct processing pipeline based on file type.
    Orchestrates: detection → pipeline → normalization → chunking → Qdrant indexing → status update.
    """

    def detect_type(self, filename: str, mime_type: str = "") -> str:
        """Detect file type from extension, falling back to MIME type."""
        ext = os.path.splitext(filename or "")[1].lower().replace(".", "")

        if ext in IMAGE_TYPES:
            return ext
        elif ext in PDF_TYPES:
            return "pdf"
        elif ext in EXCEL_TYPES:
            return ext
        elif ext in PPTX_TYPES:
            return ext
        elif ext in DOCX_TYPES:
            return ext
        elif ext in TEXT_TYPES:
            return "txt"

        # Fallback to MIME type
        mime = (mime_type or "").lower()
        if "image" in mime:
            return "png"
        elif "pdf" in mime:
            return "pdf"
        elif "spreadsheet" in mime or "excel" in mime or "csv" in mime:
            return "xlsx"
        elif "presentation" in mime or "powerpoint" in mime:
            return "pptx"
        elif "word" in mime or "document" in mime:
            return "docx"
        elif "text" in mime:
            return "txt"

        return "other"

    def get_pipeline_category(self, file_type: str) -> str:
        """Get the pipeline category for a file type."""
        if file_type in IMAGE_TYPES:
            return "IMAGE"
        elif file_type in PDF_TYPES:
            return "PDF"
        elif file_type in EXCEL_TYPES:
            return "OFFICE"
        elif file_type in PPTX_TYPES:
            return "OFFICE"
        elif file_type in DOCX_TYPES:
            return "OFFICE"
        elif file_type in TEXT_TYPES:
            return "TEXT"
        return "UNKNOWN"

    async def process_file(
        self,
        file_id: str,
        file_url: str,
        filename: str,
        mime_type: str = "",
        file_type: str = "",
        user_id: str = "",
        conversation_id: str = "",
        department_id: str = "",
        department_code: str = "",
        role: str = "student",
        local_path: str = None
    ) -> Dict[str, Any]:
        """
        Main entry point: detect type → route to pipeline → normalize → chunk → index → update status.
        Follows Section 29 debug stages:
        STORED → TYPE_DETECTED → EXTRACTING → EXTRACTED → CHUNKED → EMBEDDED → QDRANT_STORED → READY
        """
        detected_type = file_type or self.detect_type(filename, mime_type)
        category = self.get_pipeline_category(detected_type)

        # Check local file existence if local_path not passed or not found
        if not local_path or not os.path.exists(local_path):
            uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/uploads"))
            if os.path.exists(uploads_dir):
                # 1. exact basename check
                fname = os.path.basename(file_url or filename)
                possible_local = os.path.join(uploads_dir, fname)
                if os.path.exists(possible_local):
                    local_path = possible_local
                else:
                    # 2. prefix / substring match for multer files (e.g. COMPARE_TABLE-1790966911296-127909.jpeg)
                    clean_target = os.path.splitext(filename)[0].lower().replace(" ", "_")
                    for f in os.listdir(uploads_dir):
                        if clean_target in f.lower():
                            local_path = os.path.join(uploads_dir, f)
                            break

        # Ensure file_url is full URL if relative
        backend_base = NODE_BACKEND_URL
        if file_url and file_url.startswith("/"):
            file_url = f"{backend_base}{file_url}"

        logger.info(
            f"[FileRouter] Processing file_id={file_id} | "
            f"filename={filename} | type={detected_type} | category={category} | local={bool(local_path)}"
        )

        # Stage 1: Initial Processing status
        self._update_status(file_id, "processing", stage="EXTRACTING")

        normalized = NormalizedContent(
            document_id=file_id,
            filename=filename,
            file_type=detected_type,
            file_url=file_url
        )

        try:
            # Route to correct pipeline
            if category == "IMAGE":
                normalized = image_pipeline.process(
                    image_url=file_url,
                    filename=filename,
                    document_id=file_id,
                    local_path=local_path
                )
            elif category == "PDF":
                normalized = pdf_pipeline.process(
                    file_url=file_url,
                    filename=filename,
                    document_id=file_id,
                    local_path=local_path
                )
            elif category == "OFFICE":
                if detected_type in EXCEL_TYPES:
                    normalized = excel_pipeline.process(
                        file_url=file_url,
                        filename=filename,
                        document_id=file_id,
                        file_type=detected_type,
                        local_path=local_path
                    )
                elif detected_type in PPTX_TYPES:
                    normalized = pptx_pipeline.process(
                        file_url=file_url,
                        filename=filename,
                        document_id=file_id,
                        local_path=local_path
                    )
                elif detected_type in DOCX_TYPES:
                    normalized = docx_pipeline.process(
                        file_url=file_url,
                        filename=filename,
                        document_id=file_id
                    )
            elif category == "TEXT":
                normalized = text_pipeline.process(
                    file_url=file_url,
                    filename=filename,
                    document_id=file_id
                )
            else:
                # Unknown type — try text extraction
                normalized = text_pipeline.process(
                    file_url=file_url,
                    filename=filename,
                    document_id=file_id
                )

            # Check for processing errors
            if normalized.processing_errors:
                logger.warning(f"[FileRouter] Processing had errors: {normalized.processing_errors}")

            chunks_indexed = 0
            if normalized.text and normalized.text.strip():
                # Create text chunks
                text_chunks = intelligent_chunker.chunk_content(
                    text=normalized.text,
                    document_id=file_id,
                    filename=filename,
                    file_type=detected_type,
                    user_id=user_id,
                    department_id=department_id,
                    visibility="private"
                )

                # Create table chunks
                table_chunks = []
                if normalized.tables:
                    table_chunks = intelligent_chunker.chunk_tables(
                        tables=normalized.tables,
                        document_id=file_id,
                        filename=filename,
                        file_type=detected_type,
                        user_id=user_id,
                        department_id=department_id,
                        visibility="private"
                    )

                all_chunks = text_chunks + table_chunks

                if all_chunks:
                    qdrant_chunks = []
                    for chunk in all_chunks:
                        qdrant_chunks.append({
                            "content": chunk.get("content", ""),
                            "metadata": {
                                "document_id": file_id,
                                "filename": filename,
                                "file_type": detected_type,
                                "user_id": user_id,
                                "department_id": department_id,
                                "department": department_code or "CSE",
                                "visibility": chunk.get("visibility", "private"),
                                "page": chunk.get("page"),
                                "slide": chunk.get("slide") or chunk.get("slide_number"),
                                "sheet": chunk.get("sheet") or chunk.get("sheet_name"),
                                "section": chunk.get("section", "General"),
                                "chunk_id": chunk.get("chunk_id", 0),
                                "category": "Uploaded Document",
                                "access_level": "student" if role == "student" else role
                            }
                        })

                    try:
                        chunks_indexed = qdrant_manager.index_document_chunks(
                            collection_name="erp_documents",
                            chunks=qdrant_chunks
                        )
                        logger.info(f"[FileRouter] Indexed {chunks_indexed} chunks into Qdrant for {filename}")
                    except Exception as qe:
                        logger.error(f"[FileRouter] Qdrant indexing error: {qe}")
                        normalized.processing_errors.append(f"Qdrant indexing: {qe}")

            # Stage 7: READY / COMPLETED
            extracted_content = {
                "summary": normalized.summary[:2000] if normalized.summary else "",
                "textPreview": normalized.text[:400] if normalized.text else "",
                "fullText": normalized.text[:60000] if normalized.text else "",
                "tables": normalized.tables if normalized.tables else [],
                "structuredData": normalized.structured_data if normalized.structured_data else {},
                "pageCount": normalized.page_count,
                "sheetCount": normalized.sheet_count,
                "slideCount": normalized.slide_count,
                "tableCount": normalized.table_count,
                "chunksIndexed": chunks_indexed,
                "hasVisualContent": normalized.has_visual_content
            }

            if normalized.processing_errors:
                self._update_status(
                    file_id, "completed", stage="READY",
                    extracted_content=extracted_content,
                    error="; ".join(normalized.processing_errors)
                )
            else:
                self._update_status(
                    file_id, "completed", stage="READY",
                    extracted_content=extracted_content
                )

            return {
                "success": True,
                "file_id": file_id,
                "filename": filename,
                "file_type": detected_type,
                "category": category,
                "summary": normalized.summary,
                "chunks_indexed": chunks_indexed,
                "tables_found": normalized.table_count,
                "has_visual_content": normalized.has_visual_content,
                "errors": normalized.processing_errors
            }

        except Exception as e:
            logger.error(f"[FileRouter] Fatal processing error for {filename}: {e}")
            self._update_status(file_id, "failed", error=str(e), stage="fatal_error")
            return {
                "success": False,
                "file_id": file_id,
                "filename": filename,
                "error": str(e)
            }

    def _update_status(
        self,
        file_id: str,
        status: str,
        stage: str = None,
        error: str = None,
        extracted_content: dict = None
    ):
        """Update file processing status in Node.js backend via API and direct MongoDB."""
        payload = {"processingStatus": status}
        if stage:
            payload["processingStage"] = stage
        if error is not None:
            payload["processingError"] = error
        if extracted_content:
            payload["extractedContent"] = extracted_content

        # 1. Update directly in MongoDB if available
        try:
            from memory.mongo_memory import mongo_memory
            from bson import ObjectId
            if mongo_memory and mongo_memory.db is not None:
                try:
                    obj_id = ObjectId(file_id) if ObjectId.is_valid(file_id) else file_id
                    mongo_memory.db.file_documents.update_one(
                        {"_id": obj_id},
                        {"$set": payload}
                    )
                except Exception as m_err:
                    logger.debug(f"[FileRouter] Mongo direct update error: {m_err}")
        except Exception:
            pass

        # 2. Also notify Node backend HTTP endpoint (SEC-09: include X-Microservice-Secret)
        try:
            backend_base = NODE_BACKEND_URL
            internal_secret = os.getenv("INTERNAL_API_SECRET", "dev_internal_microservice_secret_key_123")
            httpx.patch(
                f"{backend_base}/api/files/{file_id}/status",
                json=payload,
                headers={"X-Microservice-Secret": internal_secret},
                timeout=2.0
            )
        except Exception as e:
            logger.debug(f"[FileRouter] HTTP status update warning for {file_id}: {e}")


file_type_router = FileTypeRouter()
