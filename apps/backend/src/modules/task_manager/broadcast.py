"""
Broadcast manager for SSE real-time updates.

Uses PostgreSQL LISTEN/NOTIFY to detect task and team changes and distributes
events to connected SSE clients via in-memory queues.

Architecture:
  PostgreSQL triggers (trg_notify_task_update, trg_notify_invitation_routines, etc.)
    → pg_notify('task_updates' | 'team_updates', payload)
    → BroadcastManager._listener_thread (psycopg LISTEN)
    → BroadcastManager.broadcast()
    → Each SSE client's asyncio.Queue
    → Client receives event via SSE endpoint
"""

import json
import threading
import uuid
from queue import Queue
from typing import Self

from src.core.logger import log

_channels = ("task_updates", "team_updates")


class BroadcastManager:
    """Singleton that distributes DB change events to SSE clients."""

    _instance: "BroadcastManager | None" = None
    _lock = threading.Lock()

    def __new__(cls) -> Self:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._started = False
                    cls._instance._queues: dict[str, Queue] = {}
                    cls._instance._listener_thread: threading.Thread | None = None
        return cls._instance

    def start_listener(self, database_url: str) -> None:
        """Start the PostgreSQL LISTEN thread. Safe to call multiple times."""
        if self._started:
            return
        if "sqlite" in database_url:
            log.info("SQLite detected — SSE listener skipped (tests/dev)")
            self._started = True
            return
        self._started = True
        self._listener_thread = threading.Thread(
            target=self._listen, args=(database_url,), daemon=True
        )
        self._listener_thread.start()
        log.info(
            f"📡 SSE listener started (PostgreSQL LISTEN on {_channels})"
        )

    def _listen(self, database_url: str) -> None:
        """Background thread: LISTEN on channels and broadcast to queues."""
        import psycopg

        # Strip SQLAlchemy driver suffix (postgresql+psycopg:// → postgresql://)
        clean_url = database_url.replace("+psycopg", "").replace("+asyncpg", "")
        conn = None
        try:
            conn = psycopg.connect(clean_url, autocommit=True)
            for ch in _channels:
                conn.execute(f"LISTEN {ch};")
            log.info(f"📡 PostgreSQL LISTEN active on {_channels}")

            gen = conn.notifies()
            while True:
                notify = next(gen)
                # Wrap payload with channel info so frontend knows the event type
                payload = json.dumps(
                    {"channel": notify.channel, "data": json.loads(notify.payload)}
                )
                self.broadcast(payload)
        except Exception as exc:
            log.error(f"📡 SSE listener crashed: {exc}")
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception as close_err:
                    log.debug(f"📡 SSE listener connection close: {close_err}")

    def broadcast(self, payload: str) -> None:
        """Send event to all connected SSE clients."""
        dead: list[str] = []
        for client_id, q in list(self._queues.items()):
            try:
                q.put_nowait(payload)
            except Exception:
                dead.append(client_id)
        for cid in dead:
            self._queues.pop(cid, None)

    def subscribe(self) -> tuple[str, Queue]:
        """Register a new SSE client. Returns (client_id, queue)."""
        client_id = uuid.uuid4().hex[:8]
        q: Queue = Queue(maxsize=64)
        self._queues[client_id] = q
        log.info(f"📡 SSE client connected: {client_id} (total: {len(self._queues)})")
        return client_id, q

    def unsubscribe(self, client_id: str) -> None:
        """Remove an SSE client."""
        self._queues.pop(client_id, None)
        log.info(
            f"📡 SSE client disconnected: {client_id} (total: {len(self._queues)})"
        )

    @classmethod
    def reset(cls) -> None:
        """Reset singleton (for tests)."""
        with cls._lock:
            cls._instance = None


manager = BroadcastManager()
