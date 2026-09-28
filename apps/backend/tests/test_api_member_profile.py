"""Perfil do membro na Comunidade (somente autenticados).

Contrato definido com o dono do produto (2026-09-27):
- rota dentro do /painel (exige login), sem link público;
- mostra: nome, avatar, biografia, habilidades, empresa do próprio BPO
  (nome fantasia/razão social, segmento, cidade/UF) e data de entrada;
- NÃO expõe e-mail, telefone, WhatsApp, CPF, CNPJ, endereço nem role;
- comentários em texto simples (sem HTML), publicados na hora;
- podem apagar: o autor do comentário e o dono do perfil;
- autor não comenta no próprio perfil (400);
- o comentário dispara a notificação `profile_comment` para o dono.
"""

from uuid import uuid4

import pytest

from src.core.database import SessionLocal
from src.modules.auth.models import User
from src.modules.notifications.models import AppNotification
from tests.helpers import register_user

PASSWORD = "StrongPassword123!"


def _user_id_by_email(email: str):
    """Id puro do usuário (o helper `register_user` devolve ORM detached)."""
    session = SessionLocal()
    try:
        return session.query(User.id).filter(User.email == email.lower()).scalar()
    finally:
        session.close()


def _login(client, email: str):
    """Cadastra e autentica um membro. Devolve (auth_header, user_id)."""
    register_user(payload={"email": email, "password": PASSWORD, "name": "Membro"})
    user_id = _user_id_by_email(email)
    resp = client.post("/auth/login", data={"username": email, "password": PASSWORD})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


def test_member_profile_returns_public_data(client):
    auth, member = _login(client, f"perfil_{uuid4()}@cafe.com")
    assert (
        client.patch(
            "/auth/me",
            json={
                "biografia": "Opero o BPO financeiro do meu estudio ha 8 anos.",
                "company_nome_fantasia": "Studio Alfa Contabilidade",
                "company_razao_social": "Studio Alfa Contabilidade ME",
                "company_segment": "Contabilidade",
                "company_city": "Curitiba",
                "company_state": "PR",
                "whatsapp": "+55 41 99999-9999",
            },
            headers=auth,
        ).status_code
        == 200
    )
    client.post("/network/me/skills", json={"name": "Contabilidade"}, headers=auth)
    # visualizador = outro membro da comunidade (não o dono do perfil)
    viewer_auth, _ = _login(client, f"visitante_{uuid4()}@cafe.com")

    resp = client.get(f"/network/members/{member}", headers=viewer_auth)

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(member)
    assert data["name"] == "Membro"
    assert "Opero o BPO financeiro" in data["biografia"]
    assert [s["name"] for s in data["skills"]] == ["Contabilidade"]
    assert data["company_name"] == "Studio Alfa Contabilidade"
    assert data["company_segment"] == "Contabilidade"
    assert data["company_city"] == "Curitiba"
    assert data["company_state"] == "PR"
    assert data["comments_count"] == 0
    assert data["is_owner"] is False
    assert data["can_comment"] is True
    assert data["created_at"]


def test_member_profile_never_exposes_contact_or_sensitive_fields(client):
    email = f"sigilo_{uuid4()}@cafe.com"
    auth, member = _login(client, email)
    client.patch(
        "/auth/me",
        json={"whatsapp": "+55 11 98888-7777", "company_cnpj": "11222333000181"},
        headers=auth,
    )

    resp = client.get(f"/network/members/{member}", headers=auth)

    assert resp.status_code == 200
    data = resp.json()
    for forbidden in (
        "email",
        "whatsapp",
        "cpf",
        "company_cnpj",
        "company_professional_email",
        "company_commercial_phone",
        "company_street",
        "company_cep",
        "role",
        "password_hash",
    ):
        assert forbidden not in data, f"perfil vazou o campo {forbidden}"
    assert email not in resp.text
    assert "+55 11 98888-7777" not in resp.text
    assert "11222333000181" not in resp.text


def test_member_profile_404_for_unknown_user(client):
    auth, known = _login(client, f"desconhecido_{uuid4()}@cafe.com")
    # sanidade: a rota existe para um membro real (senão o 404 seria tautologia)
    assert client.get(f"/network/members/{known}", headers=auth).status_code == 200

    resp = client.get(f"/network/members/{uuid4()}", headers=auth)

    assert resp.status_code == 404


def test_owner_sees_own_profile_with_owner_flags(client):
    auth, member = _login(client, f"dono_{uuid4()}@cafe.com")

    resp = client.get(f"/network/members/{member}", headers=auth)

    assert resp.status_code == 200
    data = resp.json()
    assert data["is_owner"] is True
    assert data["can_comment"] is False


def test_comment_on_member_profile_publishes_immediately(client):
    author_auth, author = _login(client, f"autor_{uuid4()}@cafe.com")
    _, owner = _login(client, f"dono_comentado_{uuid4()}@cafe.com")

    resp = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Trabalhei com a Marina e o trabalho e impecavel."},
        headers=author_auth,
    )

    assert resp.status_code == 201
    created = resp.json()
    assert created["message"] == "Trabalhei com a Marina e o trabalho e impecavel."
    assert created["author_id"] == str(author)
    assert created["author"]["name"] == "Membro"
    assert created["can_delete"] is True

    listing = client.get(f"/network/members/{owner}/comments", headers=author_auth)
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["message"].endswith("impecavel.")


def test_comment_is_stored_and_returned_as_plain_text(client):
    author_auth, _ = _login(client, f"xss_{uuid4()}@cafe.com")
    _, owner = _login(client, f"dono_xss_{uuid4()}@cafe.com")

    resp = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "<script>alert('x')</script><b>oi</b>"},
        headers=author_auth,
    )

    assert resp.status_code == 201
    # O comentario e texto simples: o backend nao reescreve a string (nao ha
    # HTML a sanitizar). A seguranca contra XSS esta em o frontend renderizar
    # como text node -- nunca dangerouslySetInnerHTML.
    assert resp.json()["message"] == "<script>alert('x')</script><b>oi</b>"
    listing = client.get(f"/network/members/{owner}/comments", headers=author_auth)
    assert listing.json()["items"][0]["message"] == resp.json()["message"]


def test_comment_validation_rejects_empty_and_too_long(client):
    author_auth, _ = _login(client, f"validacao_{uuid4()}@cafe.com")
    _, owner = _login(client, f"dono_validacao_{uuid4()}@cafe.com")

    empty = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "   "},
        headers=author_auth,
    )
    too_long = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "x" * 2001},
        headers=author_auth,
    )

    assert empty.status_code == 422
    assert too_long.status_code == 422


def test_cannot_comment_on_own_profile(client):
    auth, member = _login(client, f"self_{uuid4()}@cafe.com")

    resp = client.post(
        f"/network/members/{member}/comments",
        json={"message": "Elogio a mim mesmo"},
        headers=auth,
    )

    assert resp.status_code == 400


def test_comment_on_unknown_member_returns_404(client):
    author_auth, _ = _login(client, f"fantasma_{uuid4()}@cafe.com")
    # sanidade: comentar num perfil real de OUTRO membro funciona (o próprio
    # commenter é bloqueado com 400, então o controle precisa de outro usuário)
    _, alvo = _login(client, f"alvo_{uuid4()}@cafe.com")
    assert (
        client.post(
            f"/network/members/{alvo}/comments",
            json={"message": "Comentario de controle"},
            headers=author_auth,
        ).status_code
        == 201
    )

    resp = client.post(
        f"/network/members/{uuid4()}/comments",
        json={"message": "Comentario no vazio"},
        headers=author_auth,
    )

    assert resp.status_code == 404


def test_comment_notifies_profile_owner(client):
    author_auth, _ = _login(client, f"notifica_{uuid4()}@cafe.com")
    _, owner = _login(client, f"dono_notificado_{uuid4()}@cafe.com")

    client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Excelente profissional, recomendo."},
        headers=author_auth,
    )

    session = SessionLocal()
    try:
        notification = (
            session.query(AppNotification)
            .filter(
                AppNotification.user_id == owner,
                AppNotification.type == "profile_comment",
            )
            .one()
        )
        assert notification.related_entity_type == "member_profile"
        assert notification.related_entity_id == owner
    finally:
        session.close()


def test_profile_owner_can_delete_any_comment(client):
    author_auth, _ = _login(client, f"deleta_autor_{uuid4()}@cafe.com")
    owner_auth, owner = _login(client, f"deleta_dono_{uuid4()}@cafe.com")
    created = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Comentario que o dono nao queria"},
        headers=author_auth,
    ).json()

    resp = client.delete(
        f"/network/profile-comments/{created['id']}", headers=owner_auth
    )

    assert resp.status_code == 204
    listing = client.get(f"/network/members/{owner}/comments", headers=owner_auth)
    assert listing.json()["total"] == 0


def test_third_party_cannot_delete_comment(client):
    author_auth, _ = _login(client, f"terceiro_autor_{uuid4()}@cafe.com")
    _, owner = _login(client, f"terceiro_dono_{uuid4()}@cafe.com")
    other_auth, _ = _login(client, f"terceiro_x_{uuid4()}@cafe.com")
    created = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Comentario protegido"},
        headers=author_auth,
    ).json()

    resp = client.delete(
        f"/network/profile-comments/{created['id']}", headers=other_auth
    )

    assert resp.status_code == 403
    listing = client.get(f"/network/members/{owner}/comments", headers=other_auth)
    assert listing.json()["total"] == 1


def test_author_can_delete_own_comment(client):
    author_auth, _ = _login(client, f"autoapaga_autor_{uuid4()}@cafe.com")
    _, owner = _login(client, f"autoapaga_dono_{uuid4()}@cafe.com")
    created = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Mudei de ideia"},
        headers=author_auth,
    ).json()

    resp = client.delete(
        f"/network/profile-comments/{created['id']}", headers=author_auth
    )

    assert resp.status_code == 204


def test_comments_count_reflects_undeleted_comments_only(client):
    owner_auth, owner = _login(client, f"contador_dono_{uuid4()}@cafe.com")
    a1_auth, _ = _login(client, f"contador_a1_{uuid4()}@cafe.com")
    a2_auth, _ = _login(client, f"contador_a2_{uuid4()}@cafe.com")
    first = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Primeiro comentario"},
        headers=a1_auth,
    ).json()
    client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Segundo comentario"},
        headers=a2_auth,
    )
    client.delete(f"/network/profile-comments/{first['id']}", headers=a1_auth)

    resp = client.get(f"/network/members/{owner}", headers=owner_auth)

    assert resp.json()["comments_count"] == 1


def test_comments_listing_never_exposes_author_email(client):
    author_email = f"sigilo_autor_{uuid4()}@cafe.com"
    owner_auth, owner = _login(client, f"sigilo_lista_dono_{uuid4()}@cafe.com")
    author_auth, author = _login(client, author_email)
    client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Comentario de teste"},
        headers=author_auth,
    )

    resp = client.get(f"/network/members/{owner}/comments", headers=owner_auth)

    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["author"]["id"] == str(author)
    assert item["author"]["name"] == "Membro"
    # o dono do perfil pode apagar qualquer comentário (regra do produto)
    assert item["can_delete"] is True
    assert author_email not in resp.text


def test_commenting_requires_authentication(client):
    _, owner = _login(client, f"anon_comenta_{uuid4()}@cafe.com")

    resp = client.post(
        f"/network/members/{owner}/comments",
        json={"message": "Sem login"},
    )

    assert resp.status_code == 401


@pytest.mark.parametrize("path", ["comments", ""])
def test_profile_endpoints_require_authentication(client, path):
    suffix = f"/{path}" if path else ""
    resp = client.get(f"/network/members/{uuid4()}{suffix}")

    assert resp.status_code == 401
