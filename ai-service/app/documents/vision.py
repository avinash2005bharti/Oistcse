import base64
import json
from typing import Dict, Any, Optional, Type
import httpx
from pydantic import BaseModel, ValidationError
from loguru import logger
from app.llm.groq_client import groq_client


async def analyze_image_with_vision(
    image_url: str,
    prompt: str,
    schema_cls: Optional[Type[BaseModel]] = None
) -> Dict[str, Any]:
    """
    Fetches image and queries the Groq 27B vision model.
    Validates output with schema_cls. On validation failure, makes 1 repair attempt.
    """
    # 1. Fetch image bytes and encode to base64 data URL
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/jpeg")
            b64_data = base64.b64encode(resp.content).decode("utf-8")
            data_url = f"data:{content_type};base64,{b64_data}"
    except Exception as e:
        logger.error(f"[Vision Pipeline] Failed to download image from {image_url}: {e}")
        return {"error": f"Failed to download image: {str(e)}"}

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": f"{prompt}\nReturn strictly valid JSON only."},
                {"type": "image_url", "image_url": {"url": data_url}}
            ]
        }
    ]

    try:
        raw_json_str = await groq_client.vision(messages, json_output=True)
        parsed = json.loads(raw_json_str)
        if schema_cls:
            return schema_cls.model_validate(parsed).model_dump()
        return parsed
    except (ValidationError, json.JSONDecodeError) as e:
        logger.warning(f"[Vision Validation Failed] {e}. Attempting 1 repair call...")
        # 1 Repair attempt
        repair_messages = [
            {
                "role": "user",
                "content": f"The following JSON failed validation for schema {schema_cls.__name__ if schema_cls else 'JSON'}:\n{raw_json_str}\nError: {str(e)}\nPlease return ONLY the corrected, strictly valid JSON."
            }
        ]
        try:
            repair_res = await groq_client.chat(repair_messages, response_format={"type": "json_object"})
            parsed_repaired = json.loads(repair_res["content"])
            if schema_cls:
                return schema_cls.model_validate(parsed_repaired).model_dump()
            return parsed_repaired
        except Exception as repair_err:
            logger.error(f"[Vision Repair Failed] {repair_err}")
            return {"error": "Could not extract valid document data from image.", "raw": raw_json_str}
