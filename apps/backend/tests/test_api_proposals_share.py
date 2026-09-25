from datetime import datetime, timedelta, timezone
from uuid import uuid4

from src.core.config import get_settings
from tests.helpers import register_user

FRONTEND_URL = get_settings().frontend_url.rstrip("/")


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!"}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_proposal(client, auth, client_name="Empresa do Teste"):
    resp = client.post(
        "/proposals/",
        json={
            "client_name": client_name,
            "input_payload": {"services": [{"name": "BPO Financeiro", "active": True}]},
            "result_payload": {"final_price": 1000},
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_share_link_returns_url_with_expiry(client):
    email = f"share_a_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)

    resp = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["url"].startswith(f"{FRONTEND_URL}/orcamento/")
    expires_dt = datetime.fromisoformat(data["expires_at"])
    if expires_dt.tzinfo is None:
        expires_dt = expires_dt.replace(tzinfo=timezone.utc)
    delta = expires_dt - datetime.now(timezone.utc)
    assert timedelta(hours=23) <= delta <= timedelta(hours=25)

    # Cria um hash recuperável e registra o envio
    detail = client.get(f"/proposals/{proposal['id']}", headers=auth)
    assert detail.json()["shared_at"] is not None
    assert detail.json()["shared_count"] == 1


def test_share_link_cancels_previous_hash(client):
    email = f"share_b_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)

    first = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    second = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    assert first["url"] != second["url"]

    # O hash antigo deixa de valer (link cancelado)
    old_hash = first["url"].rsplit("/", 1)[-1]
    old_resp = client.get(f"/proposals/public/{old_hash}")
    assert old_resp.status_code == 404

    # O novo continua ativo
    new_hash = second["url"].rsplit("/", 1)[-1]
    new_resp = client.get(f"/proposals/public/{new_hash}")
    assert new_resp.status_code == 200

    # shared_count incrementa a cada envio
    detail = client.get(f"/proposals/{proposal['id']}", headers=auth)
    assert detail.json()["shared_count"] == 2


def test_share_link_requires_owner(client):
    email_a = f"owner_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    proposal = create_proposal(client, auth_a)

    email_b = f"owner_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)
    resp = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth_b)
    assert resp.status_code == 404


def test_public_get_returns_sanitized_proposal(client):
    email = f"public_a_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)

    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rsplit("/", 1)[-1]

    resp = client.get(f"/proposals/public/{share_hash}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["client_name"] == "Empresa do Teste"
    assert data["input_payload"]["services"][0]["name"] == "BPO Financeiro"
    assert data["result_payload"]["final_price"] == 1000
    assert data["client_decision"] is None


def test_public_get_invalid_hash_returns_404(client):
    resp = client.get("/proposals/public/nonexistent-hash-123")
    assert resp.status_code == 404


def test_public_get_exposes_provider_branding(client):
    from src.core.database import SessionLocal
    from src.modules.auth.models import User

    email = f"public_brand_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    # Aplica a identidade visual do BPO no perfil (nome, logo, cores, contato)
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        user.name = "Raul Gomes"
        user.company_nome_fantasia = "Consultoria BPO Sul"
        user.company_razao_social = "Consultoria BPO Sul LTDA"
        user.company_logo_url = "https://cdn.example.com/logo-bpo.png"
        user.avatar_url = "https://cdn.example.com/avatar-bpo.png"
        user.company_color_code = "#2b6cb0"
        user.company_color_secondary = "#e2e8f0"
        user.company_commercial_phone = "1133334444"
        user.whatsapp = "5511933334444"
        session.commit()
    finally:
        session.close()

    proposal = create_proposal(client, auth)
    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rsplit("/", 1)[-1]

    resp = client.get(f"/proposals/public/{share_hash}")
    assert resp.status_code == 200
    provider = resp.json()["provider"]
    assert provider["name"] == "Raul Gomes"
    assert provider["email"] == email
    assert provider["company_nome_fantasia"] == "Consultoria BPO Sul"
    assert provider["company_razao_social"] == "Consultoria BPO Sul LTDA"
    assert provider["company_logo_url"] == "https://cdn.example.com/logo-bpo.png"
    assert provider["avatar_url"] == "https://cdn.example.com/avatar-bpo.png"
    assert provider["company_color_code"] == "#2b6cb0"
    assert provider["company_color_secondary"] == "#e2e8f0"
    assert provider["company_commercial_phone"] == "1133334444"
    assert provider["whatsapp"] == "5511933334444"

    # A resposta do POST (decisão) também carrega a identidade do BPO
    post_resp = client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "approved", "observation": None},
    )
    assert post_resp.status_code == 200
    assert (
        post_resp.json()["provider"]["company_nome_fantasia"] == "Consultoria BPO Sul"
    )


def test_public_decision_records_approved_with_observation(client):
    email = f"decision_a_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)
    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rsplit("/", 1)[-1]

    resp = client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "approved", "observation": "Só ajustar a data de início"},
    )
    assert resp.status_code == 200
    assert resp.json()["client_decision"] == "approved"
    assert resp.json()["client_observation"] == "Só ajustar a data de início"

    # BPO vê a decisão no detalhe
    detail = client.get(f"/proposals/{proposal['id']}", headers=auth)
    assert detail.json()["client_decision"] == "approved"
    assert detail.json()["client_observation"] == "Só ajustar a data de início"
    assert detail.json()["client_decided_at"] is not None


def test_public_decision_allows_revision_and_keeps_history(client):
    email = f"decision_b_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)
    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rsplit("/", 1)[-1]

    client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "changes", "observation": "Reduzir escopo"},
    )
    resp = client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "approved", "observation": "Fechado"},
    )
    assert resp.json()["client_decision"] == "approved"

    # Histórico mantido (última decisão vence, mas o histórico é persistido)
    detail = client.get(f"/proposals/{proposal['id']}", headers=auth).json()
    assert detail["client_decision"] == "approved"
    assert detail["client_observation"] == "Fechado"
    assert [d["decision"] for d in detail["decision_history"]] == [
        "changes",
        "approved",
    ]


def test_public_decision_rejected_without_observation(client):
    email = f"decision_c_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)
    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rsplit("/", 1)[-1]

    resp = client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "rejected", "observation": None},
    )
    assert resp.status_code == 200
    assert resp.json()["client_decision"] == "rejected"
    assert resp.json()["client_observation"] is None


def test_public_decision_rejects_invalid_decision(client):
    email = f"decision_d_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)
    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rsplit("/", 1)[-1]

    resp = client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "maybe", "observation": ""},
    )
    assert resp.status_code == 422


def test_public_decision_after_expiry_returns_404(client):
    email = f"decision_e_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)
    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rsplit("/", 1)[-1]

    # Expira o hash diretamente no banco (SQLite in-memory via StaticPool)
    from src.core.database import SessionLocal
    from src.modules.proposals.models import PricingScenario

    session = SessionLocal()
    try:
        scenario = (
            session.query(PricingScenario)
            .filter(PricingScenario.public_hash == share_hash)
            .first()
        )
        scenario.public_hash_expires_at = datetime.now(timezone.utc) - timedelta(
            hours=1
        )
        session.commit()
    finally:
        session.close()

    resp = client.get(f"/proposals/public/{share_hash}")
    assert resp.status_code == 404

    resp = client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "approved"},
    )
    assert resp.status_code == 404


def test_email_and_whatsapp_include_public_share_link(client):
    email = f"channel_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    proposal = create_proposal(client, auth)

    # WhatsApp
    wa = client.post(f"/proposals/{proposal['id']}/whatsapp", headers=auth)
    assert wa.status_code == 200
    assert "/orcamento/" in wa.json()["message"]

    # E-mail gera share link quando não fornecido
    resp = client.post(
        f"/proposals/{proposal['id']}/send-email",
        json={
            "email": "cliente@empresa.com",
            "client_name": "Empresa do Teste",
            "message": "Avalie por favor",
        },
        headers=auth,
    )
    assert resp.status_code == 200

    detail = client.get(f"/proposals/{proposal['id']}", headers=auth)
    assert detail.json()["shared_count"] >= 2
