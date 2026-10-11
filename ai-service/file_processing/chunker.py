"""
Intelligent Chunker — Splits normalized content into chunks with rich metadata.
Preserves document structure (page, slide, sheet, section) in each chunk.
"""

from typing import List, Dict, Any, Optional
from loguru import logger


class IntelligentChunker:
    """
    Creates contextual chunks from normalized content.
    Each chunk retains source metadata for Qdrant indexing.
    """
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_content(
        self,
        text: str,
        document_id: str = "",
        filename: str = "",
        file_type: str = "",
        user_id: str = "",
        department_id: str = "",
        visibility: str = "private",
        extra_metadata: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Split text into overlapping chunks, each carrying source metadata.
        Tries to break at paragraph/section boundaries when possible.
        """
        if not text or not text.strip():
            return []

        chunks = []
        start = 0
        text_len = len(text)
        chunk_idx = 0

        while start < text_len:
            end = min(start + self.chunk_size, text_len)

            # Try to break at section/paragraph boundary
            if end < text_len:
                # Try double newline (paragraph break)
                bp = text.rfind('\n\n', start, end)
                if bp <= start:
                    # Try single newline
                    bp = text.rfind('\n', start, end)
                if bp <= start:
                    # Try space
                    bp = text.rfind(' ', start, end)
                if bp > start:
                    end = bp

            chunk_text = text[start:end].strip()
            if chunk_text:
                # Detect page/slide/sheet markers in the chunk
                page = self._detect_page(chunk_text, text, start)
                section = self._detect_section(chunk_text)

                chunk_meta = {
                    "chunk_id": chunk_idx,
                    "content": chunk_text,
                    "document_id": document_id,
                    "filename": filename,
                    "file_type": file_type,
                    "user_id": user_id,
                    "department_id": department_id,
                    "visibility": visibility,
                    "page": page,
                    "section": section,
                    "char_start": start,
                    "char_end": end,
                    **(extra_metadata or {})
                }
                chunks.append(chunk_meta)
                chunk_idx += 1

            if end >= text_len:
                break

            next_start = end - self.chunk_overlap
            if next_start <= start:
                next_start = end
            start = next_start

        logger.info(f"[Chunker] Created {len(chunks)} chunks from '{filename}' ({file_type})")
        return chunks

    def chunk_tables(
        self,
        tables: List[Dict[str, Any]],
        document_id: str = "",
        filename: str = "",
        file_type: str = "",
        user_id: str = "",
        department_id: str = "",
        visibility: str = "private"
    ) -> List[Dict[str, Any]]:
        """
        Create dedicated chunks for tables so they aren't split across text chunks.
        """
        chunks = []
        for i, table in enumerate(tables):
            # Convert table to text representation
            table_text = self._table_to_text(table, i)
            if table_text:
                chunks.append({
                    "chunk_id": f"table_{i}",
                    "content": table_text[:self.chunk_size * 2],  # Allow larger for tables
                    "document_id": document_id,
                    "filename": filename,
                    "file_type": file_type,
                    "user_id": user_id,
                    "department_id": department_id,
                    "visibility": visibility,
                    "section": f"Table {i + 1}",
                    "is_table": True,
                    "table_index": i,
                    "page": table.get("page", None),
                    "sheet": table.get("sheet", None)
                })
        return chunks

    def _table_to_text(self, table: Dict[str, Any], index: int) -> str:
        """Convert table dict to readable text representation."""
        parts = [f"Table {index + 1}"]
        if table.get("name") or table.get("sheet"):
            parts[0] += f" ({table.get('name') or table.get('sheet')})"

        headers = table.get("columns") or table.get("headers", [])
        rows = table.get("rows", [])

        if headers:
            parts.append("Columns: " + " | ".join(str(h) for h in headers))

        for row in rows[:50]:  # Cap at 50 rows per chunk
            if isinstance(row, dict):
                parts.append(" | ".join(str(v) for v in row.values()))
            elif isinstance(row, (list, tuple)):
                parts.append(" | ".join(str(v) for v in row))
            else:
                parts.append(str(row))

        return "\n".join(parts)

    def _detect_page(self, chunk_text: str, full_text: str, start: int) -> Optional[int]:
        """Try to detect which page this chunk belongs to."""
        import re
        # Look backward for page markers
        preceding = full_text[max(0, start - 200):start + 100]
        match = re.findall(r'---\s*Page\s*(\d+)\s*---', preceding)
        if match:
            return int(match[-1])
        match = re.findall(r'---\s*Slide\s*(\d+)\s*---', preceding)
        if match:
            return int(match[-1])
        return None

    def _detect_section(self, chunk_text: str) -> str:
        """Try to detect section heading from chunk content."""
        lines = chunk_text.split('\n')
        for line in lines[:3]:
            line = line.strip()
            if line and len(line) < 100 and not line.startswith(('|', '-', '*')):
                # Likely a heading
                if line.startswith('#') or line.isupper() or (len(line) < 60 and line.endswith(':')):
                    return line.lstrip('#').strip()
        return "General"


intelligent_chunker = IntelligentChunker()
