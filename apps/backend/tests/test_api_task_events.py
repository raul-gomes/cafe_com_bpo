"""Testes de autenticação do endpoint SSE /tasks/events (SSE-1).

Antes da correção o endpoint aceitava conexão sem token e recebia eventos de
todos os tenants. Agora exige autenticação (header ou ?token=) e só entrega
eventos filtrados por participação.

Nota: o TestClient do Starlette aguarda o stream de eventos terminar, o que
torna inviável testar o corpo do SSE infinito via HTTP. A cobertura do
consumidor é feita aqui (401) + unitária da dependência get_current_user_for_sse
+ unitária do filtro em test_sse_event_filter.py.
"""

from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from src.core.database import SessionLocal
from src.modules.auth.service import get_current_user_for_sse
from tests.helpers import create_test_user


def _login_token(client, email):
    create_test_user(email)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _make_request() -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/tasks/events",
        "headers": [],
        "query_string": b"",
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


def test_sse_requires_auth(client):
    resp = client.get("/tasks/events")
    assert resp.status_code == 401


def test_sse_rejects_invalid_token(client):
    resp = client.get("/tasks/events?token=token-invalido")
    assert resp.status_code == 401


def test_get_current_user_for_sse_accepts_query_token(client):
    email = f"sse_{uuid4().hex[:8]}@cafe.com"
    token = _login_token(client, email)

    session = SessionLocal()
    try:
        user = get_current_user_for_sse(_make_request(), session, token=token)
        assert user.email == email
    finally:
        session.close()


def test_get_current_user_for_sse_accepts_auth_header(client):
    email = f"sse_{uuid4().hex[:8]}@cafe.com"
    token = _login_token(client, email)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/tasks/events",
        "headers": [(b"authorization", f"Bearer {token}".encode())],
        "query_string": b"",
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    session = SessionLocal()
    try:
        user = get_current_user_for_sse(Request(scope), session, token=None)
        assert user.email == email
    finally:
        session.close()


def test_get_current_user_for_sse_sem_token_gera_401():
    with pytest.raises(HTTPException) as exc:
        get_current_user_for_sse(_make_request(), None, token=None)
    assert exc.value.status_code == 401


def test_get_current_user_for_sse_token_invalido_gera_401():
    with pytest.raises(HTTPException) as exc:
        get_current_user_for_sse(_make_request(), None, token="token-invalido")
    assert exc.value.status_code == 401
