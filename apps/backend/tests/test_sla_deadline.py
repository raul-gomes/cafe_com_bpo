"""O SLA precisa ler o prazo com a mesma regra de calendário da lista de tarefas.

`src/core/deadline.py` é a fonte única: dias de calendário no fuso de negócio,
com "vence hoje" nunca atrasado. O SLA lia o prazo de outro jeito — fracionário
(`instante / 86400`) e truncado (`.days` de um `timedelta`) — então a mesma
tarefa recebia vereditos opostos na mesma tela: a lista dizia que ainda não
venceu e o selo dizia que estava atrasada.

Estes testes fixam o relógio num instante conhecido, porque a dependência do
tempo real é justamente o que estava sendo testado.
"""

from contextlib import ExitStack
from datetime import datetime, timezone

import pytest

from src.core.deadline import BUSINESS_TZ
from tests.helpers import auth_header, freeze_sla_clock, unique_email

# Segunda-feira, 20/07/2026, 15:00 UTC = 12:00 de segunda em São Paulo.
AGORA = datetime(2026, 7, 20, 15, 0, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def clock_fixo():
    """Congela a regra de prazo e o relógio do serviço de SLA juntos."""
    with ExitStack() as stack:
        for patcher in freeze_sla_clock():
            stack.enter_context(patcher)
        yield


def _registrar(client):
    return auth_header(client, unique_email("sla"))


def _criar_cliente(client, headers) -> str:
    resp = client.post(
        "/clients/",
        headers=headers,
        json={"name": "Cliente SLA", "email": "sla@exemplo.com"},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def _criar_sla(client, headers, client_id: str) -> None:
    resp = client.post(
        "/tasks/sla/",
        headers=headers,
        json={
            "client_id": client_id,
            "process_type": "BPF",
            "sla_days": 5,
            "warning_threshold": 0.8,
        },
    )
    assert resp.status_code == 201, resp.text


def _fase_em_andamento(client, headers) -> str:
    """Fase que não é a final.

    Os filtros de prazo do SLA excluem a fase de conclusão com
    `~Task.phase_id.in_(done_ids)`, e em SQL `NULL NOT IN (...)` é NULL: uma
    tarefa sem fase é descartada. O teste cria a tarefa com uma fase para
    exercitar a regra de prazo, não esse filtro.
    """
    resp = client.get("/tasks/phases/", headers=headers)
    assert resp.status_code == 200, resp.text
    em_andamento = [f for f in resp.json() if not f.get("is_done")]
    assert em_andamento, resp.json()
    return em_andamento[0]["id"]


def _criar_tarefa(client, headers, client_id: str, deadline: datetime) -> str:
    resp = client.post(
        "/tasks/",
        headers=headers,
        json={
            "title": "Tarefa com SLA",
            "client_id": client_id,
            "process_type": "BPF",
            "deadline": deadline.isoformat(),
            "phase_id": _fase_em_andamento(client, headers),
        },
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


class TestSlaUsaRegraDeCalendario:
    @pytest.fixture
    def base(self, client):
        headers = _registrar(client)
        client_id = _criar_cliente(client, headers)
        _criar_sla(client, headers, client_id)
        return client_id, headers

    def test_tarefa_que_vence_hoje_de_manha_nao_e_overdue(self, client, base):
        """O caso que gerou o bug: vence hoje às 07:00, consultado às 12:00.

        O cálculo fracionário via `instante / 86400` dá negativo e marca
        "atrasada" qualquer coisa que vence antes do horário atual do dia. A
        regra de calendário diz que hoje ainda não venceu.
        """
        client_id, headers = base
        hoje_de_manha = datetime(2026, 7, 20, 10, 0, tzinfo=timezone.utc)  # 07:00 BRT
        _criar_tarefa(client, headers, client_id, hoje_de_manha)

        resp = client.get(f"/tasks/client-timeline/{client_id}", headers=headers)
        assert resp.status_code == 200, resp.text
        tarefas = resp.json()["tasks"]
        assert len(tarefas) == 1, tarefas
        assert tarefas[0]["sla_status"] == "warning"

    def test_tarefa_de_ontem_e_overdue(self, client, base):
        """O outro lado: o dia anterior já venceu, em qualquer horário dele."""
        client_id, headers = base
        ontem = datetime(2026, 7, 19, 23, 0, tzinfo=timezone.utc)  # 20:00 de ontem
        _criar_tarefa(client, headers, client_id, ontem)

        resp = client.get(f"/tasks/client-timeline/{client_id}", headers=headers)
        assert resp.status_code == 200, resp.text
        tarefas = resp.json()["tasks"]
        assert tarefas[0]["sla_status"] == "overdue"

    def test_dias_usados_e_inteiro(self, client, base):
        """`sla_days_used` é inteiro no contrato; fracionário mentia no tipo."""
        client_id, headers = base
        amanha = datetime(2026, 7, 21, 15, 0, tzinfo=timezone.utc)
        _criar_tarefa(client, headers, client_id, amanha)

        resp = client.get(f"/tasks/client-timeline/{client_id}", headers=headers)
        tarefas = resp.json()["tasks"]
        assert tarefas[0]["sla_days_used"] == 4  # 5 do limite - 1 dia restante


class TestAlertaDeAtrasoContaDiasDeCalendario:
    def test_total_de_dias_nao_e_truncado_para_zero(self, client):
        """Dias atrasados sao contados, nunca truncados para zero.

        A tarefa vence ontem às 22:00 (horário de São Paulo), então está
        exatamente 1 dia atrasada. O `.days` de um `timedelta` contava as horas
        em vez do dia e trunca em direção a zero: 14 horas de atraso viravam
        "0d", e o painel dizia ao usuário que uma tarefa atrasada estava com
        zero dias de atraso.
        """
        headers = _registrar(client)
        client_id = _criar_cliente(client, headers)
        ontem_a_noite = datetime(2026, 7, 20, 1, 0, tzinfo=timezone.utc)  # 19/07 22:00
        _criar_tarefa(client, headers, client_id, ontem_a_noite)

        resp = client.get("/tasks/alerts/sla", headers=headers)
        assert resp.status_code == 200, resp.text
        atrasadas = [a for a in resp.json()["overdue"] if a["count"] > 0]
        assert atrasadas, resp.json()
        assert "1d em atraso" in atrasadas[0]["message"], atrasadas[0]["message"]

    def test_alerta_nao_usa_a_meia_noite_utc_como_limite(self, client):
        """Tarefa que vence hoje só vira atraso depois da virada do dia.

        Às 12:00 de segunda em São Paulo ainda é segunda: nada venceu, mesmo
        que a meia-noite UTC já tenha passado.
        """
        headers = _registrar(client)
        client_id = _criar_cliente(client, headers)
        hoje = datetime(2026, 7, 20, 10, 0, tzinfo=timezone.utc)  # 07:00 BRT
        _criar_tarefa(client, headers, client_id, hoje)

        resp = client.get("/tasks/alerts/sla", headers=headers)
        assert resp.status_code == 200, resp.text
        atrasadas = [a for a in resp.json()["overdue"] if a["count"] > 0]
        assert not atrasadas, atrasadas


def test_ancora_dos_testes_mantem_o_mesmo_dia_no_fuso_de_negocio():
    """15:00 UTC e 12:00 em São Paulo são o mesmo dia — é o que os testes assumem."""
    assert AGORA.astimezone(BUSINESS_TZ).date() == AGORA.date()
