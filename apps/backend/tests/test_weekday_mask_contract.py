"""Contrato de `weekday_mask` — dígitos no banco, enum no DTO (P-5).

Histórico do defeito (docs/pendencias.md P-5): a máscara é um `str` cru, convertida
em quatro lugares diferentes por `int(d) - 1`, e a documentação do código discordava
do frontend. Consequências: `"0"` (domingo) caía no **domingo da semana anterior**, e
texto/número fora de faixa só falhava lá dentro da geração — a API respondia 200, o
usuário acreditava ter salvo e a rotina não gerava card.

O contrato agora é:

- **banco**: `weekday_mask` continua sendo `"1,2,3"` — dígitos separados por vírgula
  (1=seg … 7=dom; o seletor da tela só oferece 1..5, dia útil);
- **API**: `weekdays` é uma lista de `Weekday` (`"monday"` …), no request e na
  resposta. O frontend nunca converte número ↔ dia: era exatamente aí que o
  off-by-one nascia;
- **entrada inválida é recusada na fronteira** (422), não dentro do scheduler.
"""

from uuid import UUID, uuid4

import pytest

from src.core.database import SessionLocal
from src.modules.task_manager.models import ActivityTemplate
from src.modules.task_manager.weekdays import (
    Weekday,
    format_weekday_mask,
    parse_weekday_mask,
)
from tests.helpers import register_user


@pytest.fixture
def auth(client):
    """Autentica um usuário novo para cada teste.

    Args:
        client: Cliente FastAPI de teste.

    Returns:
        Tupla com o header de autorização e o e-mail do usuário.
    """
    email = f"wdmask_{uuid4()}@cafe.com"
    register_user(
        payload={"email": email, "password": "StrongPassword123!", "name": "Teste"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}, email


def _create_template(client, auth, **overrides) -> dict:
    """Cria um template semanal e devolve o corpo da resposta.

    Args:
        client: Cliente FastAPI de teste.
        auth: Header de autorização.
        **overrides: Campos que substituem o payload padrão.

    Returns:
        JSON da resposta.
    """
    payload = {
        "name": "Rotina Semanal",
        "recurrence": "weekly",
        "weekdays": ["monday", "wednesday"],
    }
    payload.update(overrides)
    return client.post("/tasks/templates/", json=payload, headers=auth)


# ─────────────────────────── o enum ───────────────────────────


def test_enum_covers_the_whole_week():
    """O enum conhece os 7 dias e sabe se converter para o `weekday()` do Python."""
    assert [d.name for d in Weekday] == [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
    ]
    assert Weekday.MONDAY.python_weekday == 0  # Python: 0=segunda
    assert Weekday.SUNDAY.python_weekday == 6
    assert Weekday.MONDAY.mask_digit == 1  # banco: 1=segunda
    assert Weekday.SUNDAY.mask_digit == 7


# ──────────────────────── banco: dígitos ────────────────────────


def test_parse_reads_the_documented_digits():
    """`"1,3"` vira segunda e quarta, nos índices 0 e 2 do Python."""
    assert parse_weekday_mask("1,3") == [Weekday.MONDAY, Weekday.WEDNESDAY]
    assert [d.python_weekday for d in parse_weekday_mask("1,3")] == [0, 2]


def test_parse_orders_and_deduplicates():
    """Máscara fora de ordem ou repetida não muda o resultado."""
    assert parse_weekday_mask("3,1,1") == [Weekday.MONDAY, Weekday.WEDNESDAY]


def test_parse_ignores_surrounding_spaces():
    """Espaço em volta do dígito é ruído de digitação, não erro."""
    assert parse_weekday_mask(" 1 , 3 ") == [Weekday.MONDAY, Weekday.WEDNESDAY]


@pytest.mark.parametrize("mask", ["seg", "1;2", "1,,2", "1,2x", "-1", "1.5"])
def test_parse_rejects_anything_but_digits_and_commas(mask):
    """Só dígito separado por vírgula é aceito; o resto estoura na leitura."""
    with pytest.raises(ValueError):
        parse_weekday_mask(mask)


def test_parse_accepts_the_legacy_zero_as_sunday():
    """`"0"` é domingo na convenção do frontend (0-based) e não pode quebrar a leitura.

    Antes virava `-1`: no scheduler semanal gerava card da semana anterior e no
    vínculo não gerava nada. Agora é domingo, e o seletor impede gravar `"0"`.
    """
    assert parse_weekday_mask("0") == [Weekday.SUNDAY]
    assert parse_weekday_mask("6") == [Weekday.SATURDAY]


def test_empty_mask_is_no_days():
    """Rotina não é semanal (ou máscara vazia) não tem dia marcado."""
    assert parse_weekday_mask("") == []
    assert parse_weekday_mask(None) == []


def test_format_round_trips():
    """O que o enum formata volta ao mesmo enum — ida e volta sem deriva."""
    days = [Weekday.MONDAY, Weekday.FRIDAY]
    assert format_weekday_mask(days) == "1,5"
    assert parse_weekday_mask(format_weekday_mask(days)) == days


# ────────────────────── API: enum no request ──────────────────────


def test_create_accepts_the_enum_and_stores_digits(client, auth):
    """Request manda enum; o banco guarda dígitos."""
    header, _ = auth
    resp = _create_template(client, header)
    assert resp.status_code == 201, resp.text

    db = SessionLocal()
    try:
        stored = (
            db.query(ActivityTemplate)
            .filter(ActivityTemplate.id == UUID(resp.json()["id"]))
            .one()
        )
        assert stored.weekday_mask == "1,3"
    finally:
        db.close()


def test_create_response_carries_the_enum_and_not_the_mask(client, auth):
    """A resposta manda `weekdays` e não carrega mais `weekday_mask`."""
    header, _ = auth
    body = _create_template(client, header).json()

    assert body["weekdays"] == ["monday", "wednesday"]
    assert "weekday_mask" not in body, (
        "campo interno de armazenamento não deve viajar na resposta (§6 do contrato)"
    )


@pytest.mark.parametrize(
    "value", [["domingo"], ["MONDAY"], [""], ["monday", "monday"], [1]]
)
def test_create_rejects_an_invalid_weekday(client, auth, value):
    """Só o enum conhecido entra; qualquer outra coisa é 422 na entrada."""
    header, _ = auth
    resp = _create_template(client, header, weekdays=value)
    assert resp.status_code == 422, resp.text


def test_create_rejects_the_old_mask_field_instead_of_ignoring_it(client, auth):
    """Enviar `weekday_mask` não pode ser ignorado em silêncio.

    Sem esta recusa, um cliente antigo receberia 201 e a rotina ficaria sem dia
    nenhum — o usuário veria "salvo" e nunca veria card.
    """
    header, _ = auth
    resp = _create_template(client, header, weekday_mask="1,2")
    assert resp.status_code == 422, resp.text
    assert "weekdays" in resp.text.lower()


def test_weekly_without_days_is_accepted_and_inert(client, auth):
    """Rotina semanal sem dia marcado é aceita e não gera card.

    Bloquear a criação seria regra nova e não foi pedido pelo dono: a rotina pode ser
    cadastrada primeiro e receber os dias depois. O efeito de não ter dia é nenhum —
    a regra semanal não tem dia marcado para gerar.
    """
    header, _ = auth
    resp = _create_template(client, header, weekdays=[])
    assert resp.status_code == 201, resp.text
    assert resp.json()["weekdays"] == []


def test_non_weekly_ignores_weekdays(client, auth):
    """Recorrência que não é semanal não carrega dia da semana."""
    header, _ = auth
    resp = client.post(
        "/tasks/templates/",
        json={"name": "Mensal", "recurrence": "monthly", "due_day": 10},
        headers=header,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["weekdays"] == []


def test_update_rewrites_the_stored_digits(client, auth):
    """Alterar os dias reescreve a coluna de dígitos."""
    header, _ = auth
    tmpl_id = _create_template(client, header).json()["id"]

    resp = client.put(
        f"/tasks/templates/{tmpl_id}",
        json={"weekdays": ["friday"]},
        headers=header,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["weekdays"] == ["friday"]

    db = SessionLocal()
    try:
        stored = (
            db.query(ActivityTemplate)
            .filter(ActivityTemplate.id == UUID(tmpl_id))
            .one()
        )
        assert stored.weekday_mask == "5"
    finally:
        db.close()


def test_list_item_carries_the_enum(client, auth):
    """A lista também entrega o enum — a página de listagem mostra os dias."""
    header, _ = auth
    _create_template(client, header)

    resp = client.get("/tasks/templates/", headers=header)
    assert resp.status_code == 200, resp.text
    row = resp.json()[0]
    assert row["weekdays"] == ["monday", "wednesday"]
    assert "weekday_mask" not in row


def test_legacy_row_is_readable(client, auth):
    """Linha antiga com `"0"` (domingo) é lida e devolvida como `sunday`."""
    header, _ = auth
    tmpl_id = _create_template(client, header, weekdays=["monday"]).json()["id"]

    db = SessionLocal()
    try:
        stored = (
            db.query(ActivityTemplate)
            .filter(ActivityTemplate.id == UUID(tmpl_id))
            .one()
        )
        stored.weekday_mask = "0"  # como a tela antiga gravava
        db.commit()

        resp = client.get(f"/tasks/templates/{tmpl_id}", headers=header)
        assert resp.status_code == 200, resp.text
        assert resp.json()["weekdays"] == ["sunday"]
    finally:
        db.close()
