import asyncio
import json
from typing import List, Dict, Any, Optional, AsyncGenerator
from groq import AsyncGroq, APIStatusError, RateLimitError
from loguru import logger
from app.config import settings
from app.llm.schemas import TokenUsage


class GroqClient:
    """
    Robust asynchronous Groq client wrapper for text reasoning and vision models.
    Supports streaming, tool calling, retry on 429/5xx, and token tracking.
    """

    def __init__(self):
        self._client: Optional[AsyncGroq] = None

    def _get_client(self) -> AsyncGroq:
        if not self._client:
            api_key = settings.GROQ_API_KEY
            if not api_key:
                raise ValueError("GROQ_API_KEY is not configured in environment.")
            self._client = AsyncGroq(api_key=api_key)
        return self._client

    async def _retry_call(self, coro_func, *args, **kwargs):
        """Executes coroutine with exponential backoff retry on 429 or 5xx."""
        max_retries = 2
        delay = 1.0
        for attempt in range(max_retries + 1):
            try:
                return await coro_func(*args, **kwargs)
            except (RateLimitError, APIStatusError) as e:
                status_code = getattr(e, "status_code", 500)
                if (status_code == 429 or status_code >= 500) and attempt < max_retries:
                    logger.warning(
                        f"[Groq Retry] Caught HTTP {status_code} on attempt {attempt+1}. "
                        f"Retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                    delay *= 2.0
                else:
                    logger.error(f"[Groq Client Error] HTTP {status_code}: {str(e)}")
                    raise e
            except Exception as e:
                logger.error(f"[Groq Client Error]: {str(e)}")
                raise e

    async def chat_stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.2
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streams completion tokens and tool call chunks from text reasoning model.
        Yields:
          {"type": "token", "delta": "..."}
          {"type": "tool_call", "tool_call": {...}}
          {"type": "usage", "usage": TokenUsage(...)}
        """
        client = self._get_client()
        model = settings.get_text_model()

        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
        }
        if tools and len(tools) > 0:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response_stream = await self._retry_call(client.chat.completions.create, **kwargs)

        accumulated_tool_calls: Dict[int, Dict[str, Any]] = {}
        usage_info = TokenUsage()

        async for chunk in response_stream:
            # Check for token usage if provided in stream chunk
            if hasattr(chunk, "usage") and chunk.usage:
                usage_info.prompt_tokens = chunk.usage.prompt_tokens or 0
                usage_info.completion_tokens = chunk.usage.completion_tokens or 0
                usage_info.total_tokens = chunk.usage.total_tokens or 0

            choice = chunk.choices[0] if chunk.choices else None
            if not choice:
                continue

            delta = choice.delta

            # Text token delta
            if delta and delta.content:
                yield {"type": "token", "delta": delta.content}

            # Tool call accumulation
            if delta and delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in accumulated_tool_calls:
                        accumulated_tool_calls[idx] = {
                            "id": tc.id or f"call_{idx}",
                            "name": tc.function.name if tc.function and tc.function.name else "",
                            "arguments": tc.function.arguments if tc.function and tc.function.arguments else ""
                        }
                    else:
                        if tc.id:
                            accumulated_tool_calls[idx]["id"] = tc.id
                        if tc.function and tc.function.name:
                            accumulated_tool_calls[idx]["name"] += tc.function.name
                        if tc.function and tc.function.arguments:
                            accumulated_tool_calls[idx]["arguments"] += tc.function.arguments

        # Yield any completed tool calls
        for idx, tc_data in accumulated_tool_calls.items():
            try:
                parsed_args = json.loads(tc_data["arguments"]) if tc_data["arguments"] else {}
            except Exception:
                parsed_args = {"raw": tc_data["arguments"]}

            yield {
                "type": "tool_call",
                "tool_call": {
                    "id": tc_data["id"],
                    "name": tc_data["name"],
                    "arguments": parsed_args
                }
            }

        yield {"type": "usage", "usage": usage_info}

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        response_format: Optional[Dict[str, Any]] = None,
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        """Synchronous (non-streaming) completion from text model."""
        client = self._get_client()
        model = settings.get_text_model()

        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools and len(tools) > 0:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        if response_format:
            kwargs["response_format"] = response_format

        response = await self._retry_call(client.chat.completions.create, **kwargs)
        choice = response.choices[0]
        content = choice.message.content or ""

        tool_calls = []
        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except Exception:
                    args = {"raw": tc.function.arguments}
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": args
                })

        return {
            "content": content,
            "tool_calls": tool_calls,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            }
        }

    async def vision(
        self,
        messages_with_images: List[Dict[str, Any]],
        json_output: bool = True
    ) -> str:
        """
        Executes vision analysis using the 27B vision model (e.g. qwen/qwen3.8-27b).
        Converts image/document content to structured text or JSON.
        """
        client = self._get_client()
        model = settings.get_vision_model()

        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages_with_images,
            "temperature": 0.1,
        }
        if json_output:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self._retry_call(client.chat.completions.create, **kwargs)
        return response.choices[0].message.content or ""


groq_client = GroqClient()
