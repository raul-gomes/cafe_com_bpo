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
import signal
import threading
import uuid
from queue import Queue
from typing import Self

from src.core.logger import log

_channels = ("task_updates", "team_updates")

# Sentinela enviado às filas dos clientes no shutdown para que os geradores
# SSE encerrem o stream e o uvicorn complete o graceful shutdown (SIGTERM).
SHUTDOWN_EVENT = "__sse_shutdown__"


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
                    cls._instance._stopping = threading.Event()
                    cls._instance._conn = None
        return cls._instance

    def start_listener(self, database_url: str) -> None:
        """Start the PostgreSQL LISTEN thread. Safe to call multiple times."""
        if self._started:
            return
        self._stopping.clear()
        if "sqlite" in database_url:
            log.info("SQLite detected — SSE listener skipped (tests/dev)")
            self._started = True
            return
        self._started = True
        self._listener_thread = threading.Thread(
            target=self._listen, args=(database_url,), daemon=True
        )
        self._listener_thread.start()
        log.info(f"📡 SSE listener started (PostgreSQL LISTEN on {_channels})")

    def _listen(self, database_url: str) -> None:
        """Background thread: LISTEN on channels and broadcast to queues."""
        import psycopg

        # Strip SQLAlchemy driver suffix (postgresql+psycopg:// → postgresql://)
        clean_url = database_url.replace("+psycopg", "").replace("+asyncpg", "")
        conn = None
        try:
            conn = psycopg.connect(clean_url, autocommit=True)
            self._conn = conn
            for ch in _channels:
                conn.execute(f"LISTEN {ch};")
            log.info(f"📡 PostgreSQL LISTEN active on {_channels}")

            gen = conn.notifies()
            while not self._stopping.is_set():
                notify = next(gen)
                # Wrap payload with channel info so frontend knows the event type
                payload = json.dumps(
                    {"channel": notify.channel, "data": json.loads(notify.payload)}
                )
                self.broadcast(payload)
        except Exception as exc:
            if self._stopping.is_set():
                log.info("📡 SSE listener stopped")
            else:
                log.error(f"📡 SSE listener crashed: {exc}")
        finally:
            self._conn = None
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

    def stop(self) -> None:
        """Graceful shutdown: disconnect all SSE clients and stop the listener.

        Called on app shutdown (SIGTERM) so uvicorn does not hang waiting for
        the open EventSource connections to close.
        """
        self._stopping.set()

        # Unblock + end every connected SSE generator
        for q in list(self._queues.values()):
            try:
                q.put_nowait(SHUTDOWN_EVENT)
            except Exception as exc:
                log.debug(f"📡 SSE queue already closed: {exc}")
        self._queues.clear()
        log.info("📡 SSE clients disconnected (shutdown)")

        # Close the LISTEN connection to unblock next(notifies())
        conn = self._conn
        if conn is not None:
            try:
                conn.close()
            except Exception as exc:
                log.debug(f"📡 SSE listener conn close: {exc}")

        thread = self._listener_thread
        if thread is not None and thread.is_alive():
            thread.join(timeout=5)
        self._listener_thread = None
        self._started = False

    @classmethod
    def reset(cls) -> None:
        """Reset singleton (for tests)."""
        with cls._lock:
            cls._instance = None


manager = BroadcastManager()


def install_shutdown_handlers(mgr: BroadcastManager) -> None:
    """Chain SIGTERM/SIGINT to disconnect SSE clients before uvicorn drains.

    uvicorn só executa o lifespan shutdown DEPOIS de fechar todas as conexões
    abertas — como os streams SSE nunca terminam sozinhos, o drain trava até
    o SIGKILL. Este handler desconecta os clientes no momento do sinal,
    destravando o drain, e em seguida repassa para o handler original.
    """
    current = signal.getsignal(signal.SIGTERM)
    if getattr(current, "_is_sse_shutdown_handler", False):
        return
    if threading.current_thread() is not threading.main_thread():
        # signal.signal() só é permitido na main thread (ex.: TestClient)
        log.debug("📡 SSE shutdown handlers skipped (not main thread)")
        return

    for sig in (signal.SIGTERM, signal.SIGINT):
        previous = signal.getsignal(sig)

        def handle(signum, frame, _previous=previous):
            mgr.stop()
            if callable(_previous):
                _previous(signum, frame)

        handle._is_sse_shutdown_handler = True  # type: ignore[attr-defined]
        signal.signal(sig, handle)
