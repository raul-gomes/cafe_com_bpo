"""Origem da leitura de empresa no `task_manager` (Fase 3, item 6).

O `task_manager` resolvia dono, nome e e-mail de contato pela linha legada
`clients`. A migração para `companies` tem duas propriedades que precisam ser
asseguradas ao mesmo tempo, e uma delas é o risco real desta mudança:

1. **A posse não afrouxa.** `ClientRepository.get_by_id(client_id, user_id)`
   filtra por dono; `CompanyRepository.get_by_id(company_id)` não filtra nada,
   porque é uma leitura de etapa. Trocar uma pela outra sem comparar o
   `user_id` devolveria a timeline de qualquer empresa para qualquer usuário
   logado. O teste monta duas empresas com donos diferentes e exige que uma não
   veja a timeline da outra.

2. **A leitura vem da empresa.** Degradar a linha `clients` não pode derrubar o
   endpoint — é o que prova que a origem migrou. O espelho do cadastro
   reescreveria a linha legada, então a degradação é feita direto na tabela.
"""

from contextlib import ExitStack
from datetime import datetime, timezone
from uuid import UUID

import pytest

from src.core.database import SessionLocal
from src.modules.clients.models import Client
from tests.helpers import auth_header, freeze_sla_clock, unique_email

# Data fixa e já vencida, para o SLA cair em "overdue" sem depender de qual dia
# o teste roda (regra §3).
ONTEM = datetime(2026, 7, 19, 23, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def clock_fixo():
    """Congela o relógio do SLA e da tarefa, como o resto dos testes de prazo.

    A timeline filtra por mês e o SLA lê o prazo com o relógio do serviço; sem
    congelar os dois, a asserção passa ou falha conforme o dia em que roda.
    """
    with ExitStack() as stack:
        for patcher in freeze_sla_clock():
            stack.enter_context(patcher)
        yield


def _criar_cliente(client, headers, nome: str) -> str:
    """Cria a empresa pelo endpoint de cadastro e devolve o id."""
    resp = client.post(
        "/clients/", headers=headers, json={"name": nome, "email": "sla@exemplo.com"}
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def _criar_sla(client, headers, client_id: str) -> None:
    """Cadastra o SLA de 5 dias que a timeline usa para classificar a tarefa."""
    resp = client.post(
        "/tasks/sla/",
        headers=headers,
        json={
            "client_id": client_id,
            "process_type": "BPF",
            "sla_days": 5,
            "description": "SLA de teste",
        },
    )
    assert resp.status_code in (200, 201), resp.text


def _fase_em_andamento(client, headers) -> str:
    """Fase que não é a final.

    Os filtros de prazo do SLA excluem a fase de conclusão, e em SQL
    `NULL NOT IN (...)` é NULL: uma tarefa sem fase é descartada. O teste cria
    a tarefa com uma fase para exercitar a regra de prazo, não esse filtro.
    """
    resp = client.get("/tasks/phases/", headers=headers)
    assert resp.status_code == 200, resp.text
    fases = [f for f in resp.json() if not f.get("is_final")]
    assert fases, "nenhuma fase intermediária cadastrada"
    return fases[0]["id"]


def _criar_tarefa(client, headers, client_id: str, deadline: datetime) -> str:
    """Cria uma tarefa da empresa com o prazo informado."""
    resp = client.post(
        "/tasks/",
        headers=headers,
        json={
            "title": "Tarefa com SLA",
            "client_id": client_id,
            "deadline": deadline.isoformat(),
            "phase_id": _fase_em_andamento(client, headers),
        },
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def _convidar_para_o_time(client, headers, client_id: str, email: str) -> dict:
    """Convida a pessoa para o time da empresa e devolve o header dela."""
    resp = client.post(
        f"/clients/{client_id}/invite",
        json={"emails": [email], "template_ids": []},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return auth_header(client, email)


def _degradar_linha_legada(client_id: str) -> None:
    """Desativa a linha `clients` direto na tabela, sem passar pela API.

    O espelho do cadastro manteria `clients` em dia, então a degradação tem de
    ser na tabela para distinguir as duas origens.
    """
    session = SessionLocal()
    try:
        session.query(Client).filter(Client.id == UUID(client_id)).update(
            {"is_active": False}
        )
        session.commit()
    finally:
        session.close()


class TestPosseDaEmpresa:
    def test_dono_de_uma_empresa_nao_ve_a_timeline_de_outra(self, client):
        """A timeline é da empresa do usuário; a alheia responde erro.

        Regressão de segurança: `get_by_id` do legado filtrava por dono, e o
        acesso pela empresa precisa filtrar do mesmo jeito.
        """
        dono_a = auth_header(client, unique_email("dono-alfa"))
        dono_b = auth_header(client, unique_email("dono-bravo"))

        empresa_a = _criar_cliente(client, dono_a, "Empresa Alfa")
        empresa_b = _criar_cliente(client, dono_b, "Empresa Bravo")
        _criar_sla(client, dono_a, empresa_a)
        _criar_tarefa(client, dono_a, empresa_a, ONTEM)
        _criar_tarefa(client, dono_b, empresa_b, ONTEM)

        propria = client.get(f"/tasks/client-timeline/{empresa_a}", headers=dono_a)
        assert propria.status_code == 200, propria.text
        assert len(propria.json()["tasks"]) == 1

        alheia = client.get(f"/tasks/client-timeline/{empresa_b}", headers=dono_a)
        assert alheia.status_code in (400, 403, 404), (
            f"empresa de outro dono respondeu {alheia.status_code}: {alheia.text}"
        )

    def test_membro_do_time_continua_sem_acesso(self, client):
        """Fixa o comportamento atual: a timeline da tarefa é só do dono.

        A listagem de equipe abre para membros, mas a timeline da tarefa não —
        `get_by_id` do legado filtra por dono e a migração para `companies` tem
        de manter exatamente esse filtro. A assimetria é suspeita e está
        registrada em `docs/pendencias.md` (2.9) para decisão do dono; até lá o
        comportamento é preservado, não corrigido por conta própria.
        """
        dono = auth_header(client, unique_email("dono-assimetria"))
        empresa = _criar_cliente(client, dono, "Empresa Da Assimetria")
        _criar_sla(client, dono, empresa)
        _criar_tarefa(client, dono, empresa, ONTEM)

        colega = _convidar_para_o_time(
            client, dono, empresa, unique_email("colega-assimetria")
        )
        resp = client.get(f"/tasks/client-timeline/{empresa}", headers=colega)
        assert resp.status_code in (400, 403, 404), (
            f"a timeline Widows mudou de dono para o time: {resp.status_code}"
        )


class TestOrigemDaLeitura:
    def test_timeline_sobrevive_a_linha_legada_desativada(self, client):
        """A timeline sai da empresa: degradar `clients` não pode derrubá-la."""
        dono = auth_header(client, unique_email("dono-origem"))
        empresa = _criar_cliente(client, dono, "Empresa Da Origem")
        _criar_sla(client, dono, empresa)
        _criar_tarefa(client, dono, empresa, ONTEM)

        antes = client.get(f"/tasks/client-timeline/{empresa}", headers=dono)
        assert antes.status_code == 200, antes.text

        _degradar_linha_legada(empresa)

        depois = client.get(f"/tasks/client-timeline/{empresa}", headers=dono)
        assert depois.status_code == 200, (
            f"a timeline ainda depende da linha legada: {depois.text}"
        )
        assert len(depois.json()["tasks"]) == 1
