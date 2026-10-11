import json
import time
from typing import Dict, Any, Optional
import redis.asyncio as aioredis
from loguru import logger
from app.config import settings

_in_memory_proposals: Dict[str, Dict[str, Any]] = {}


class PendingActionMemory:
    """
    Stores write proposals awaiting user confirmation.
    TTL is 10 minutes (600 seconds).
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
            except Exception:
                self._redis_available = False
        return self._redis if self._redis_available else None

    def _key(self, proposal_id: str) -> str:
        return f"pending:{proposal_id}"

    async def save_proposal(self, proposal_id: str, data: Dict[str, Any], ttl_seconds: int = 600):
        """Stores proposal in Redis with 10 min TTL."""
        key = self._key(proposal_id)
        redis_conn = await self._get_redis()
        serialized = json.dumps(data)

        if redis_conn:
            try:
                await redis_conn.setex(key, ttl_seconds, serialized)
                return
            except Exception as e:
                logger.warning(f"[Pending Memory] Redis write error: {e}")

        # Fallback
        _in_memory_proposals[proposal_id] = {
            "data": data,
            "expires_at": time.time() + ttl_seconds
        }

    async def get_proposal(self, proposal_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves proposal and verifies it has not expired."""
        key = self._key(proposal_id)
        redis_conn = await self._get_redis()

        if redis_conn:
            try:
                raw = await redis_conn.get(key)
                if raw:
                    return json.loads(raw)
            except Exception as e:
                logger.warning(f"[Pending Memory] Redis read error: {e}")

        # Fallback
        entry = _in_memory_proposals.get(proposal_id)
        if entry:
            if time.time() > entry["expires_at"]:
                del _in_memory_proposals[proposal_id]
                return None
            return entry["data"]
        return None

    async def delete_proposal(self, proposal_id: str):
        """Removes proposal once confirmed or rejected."""
        key = self._key(proposal_id)
        redis_conn = await self._get_redis()

        if redis_conn:
            try:
                await redis_conn.delete(key)
            except Exception:
                pass

        if proposal_id in _in_memory_proposals:
            del _in_memory_proposals[proposal_id]


pending_memory = PendingActionMemory()
