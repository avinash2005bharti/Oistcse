import json
import time
from typing import List, Dict, Any, Optional
import redis.asyncio as aioredis
from loguru import logger
from app.config import settings

# In-memory fallback if Redis is not running
_in_memory_sessions: Dict[str, Dict[str, Any]] = {}


class SessionMemory:
    """
    Manages conversational turn history per user and sessionId.
    Stores messages in Redis with 24-hour TTL, with in-memory fallback.
    """

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._redis_available: bool = False

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        if self._redis is None:
            try:
                self._redis = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=2
                )
                await self._redis.ping()
                self._redis_available = True
                logger.info(f"[Session Memory] Connected to Redis at {settings.REDIS_URL}")
            except Exception as e:
                self._redis_available = False
                logger.warning(f"[Session Memory] Redis unavailable ({str(e)}). Using in-memory fallback store.")
        return self._redis if self._redis_available else None

    def _key(self, user_id: str, session_id: str) -> str:
        return f"session:{user_id}:{session_id}"

    async def get_messages(self, user_id: str, session_id: str, limit: int = 12) -> List[Dict[str, Any]]:
        """Retrieves conversational messages for the session."""
        key = self._key(user_id, session_id)
        redis_conn = await self._get_redis()

        if redis_conn:
            try:
                raw_list = await redis_conn.lrange(key, -limit, -1)
                return [json.loads(item) for item in raw_list]
            except Exception as e:
                logger.warning(f"[Session Memory] Redis read error: {e}")

        # Fallback
        entry = _in_memory_sessions.get(key)
        if entry:
            return entry.get("messages", [])[-limit:]
        return []

    async def append_message(self, user_id: str, session_id: str, message: Dict[str, Any], ttl_seconds: int = 86400):
        """Appends a message turn and sets 24-hour TTL."""
        key = self._key(user_id, session_id)
        redis_conn = await self._get_redis()
        serialized = json.dumps(message)

        if redis_conn:
            try:
                await redis_conn.rpush(key, serialized)
                await redis_conn.expire(key, ttl_seconds)
                return
            except Exception as e:
                logger.warning(f"[Session Memory] Redis write error: {e}")

        # Fallback
        if key not in _in_memory_sessions:
            _in_memory_sessions[key] = {"messages": [], "expires_at": time.time() + ttl_seconds}
        _in_memory_sessions[key]["messages"].append(message)


session_memory = SessionMemory()
