"""Testes do BroadcastManager (SSE) — foco no shutdown gracioso.

Cenário coberto: ao receber SIGTERM, uvicorn aguarda as conexões abertas
terminarem. Sem desconexão ativa dos clientes SSE, o shutdown trava
("Waiting for connections to close") até o SIGKILL do Docker.
"""

from src.modules.task_manager.broadcast import SHUTDOWN_EVENT, BroadcastManager


def _fresh_manager() -> BroadcastManager:
    BroadcastManager.reset()
    return BroadcastManager()


def teardown_function():
    BroadcastManager.reset()


def test_subscribe_broadcast_unsubscribe():
    manager = _fresh_manager()
    client_id, q = manager.subscribe()
    manager.broadcast('{"type": "test"}')

    assert q.get(timeout=1) == '{"type": "test"}'

    manager.unsubscribe(client_id)
    assert client_id not in manager._queues


def test_stop_disconnects_all_sse_clients():
    manager = _fresh_manager()
    _, q1 = manager.subscribe()
    _, q2 = manager.subscribe()

    manager.stop()

    assert q1.get(timeout=1) == SHUTDOWN_EVENT
    assert q2.get(timeout=1) == SHUTDOWN_EVENT
    assert manager._queues == {}


def test_stop_is_safe_without_listener_and_idempotent():
    """SQLite (testes) não inicia thread de listener; stop() não pode falhar."""
    manager = _fresh_manager()
    manager.start_listener("sqlite:///:memory:")

    manager.stop()
    manager.stop()

    assert not manager._started
    assert manager._listener_thread is None or not manager._listener_thread.is_alive()


def test_start_after_stop_reinitializes():
    manager = _fresh_manager()
    manager.start_listener("sqlite:///:memory:")
    manager.stop()

    manager.start_listener("sqlite:///:memory:")

    assert manager._started


def test_signal_handler_disconnects_clients_and_chains_previous():
    """No SIGTERM os clientes SSE devem ser desconectados ANTES do drain do
    uvicorn (o lifespan roda tarde demais); o handler anterior é preservado."""
    import signal

    from src.modules.task_manager.broadcast import install_shutdown_handlers

    manager = _fresh_manager()
    _, q = manager.subscribe()

    called_with = []
    previous = signal.getsignal(signal.SIGTERM)
    try:
        install_shutdown_handlers(manager)
        handler = signal.getsignal(signal.SIGTERM)

        handler(signal.SIGTERM, None)

        assert q.get(timeout=1) == SHUTDOWN_EVENT
        # Handler original do uvicorn continua sendo chamado
        install_shutdown_handlers(manager)
        assert signal.getsignal(signal.SIGTERM) is handler  # idempotente
    finally:
        signal.signal(signal.SIGTERM, previous)

    called_with.append(True)


def test_signal_handler_invokes_previous_handler():
    import signal

    from src.modules.task_manager.broadcast import install_shutdown_handlers

    manager = _fresh_manager()
    previous_calls = []

    def fake_previous(signum, frame):
        previous_calls.append(signum)

    original = signal.getsignal(signal.SIGTERM)
    try:
        signal.signal(signal.SIGTERM, fake_previous)
        install_shutdown_handlers(manager)
        handler = signal.getsignal(signal.SIGTERM)

        handler(signal.SIGTERM, None)

        assert previous_calls == [signal.SIGTERM]
    finally:
        signal.signal(signal.SIGTERM, original)
