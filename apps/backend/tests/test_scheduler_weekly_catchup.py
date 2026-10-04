"""Regate da rodada semanal (P-3) — o que fazer quando o domingo passa sem rodar.

A rodada semanal só era aplicada quando o dia **em UTC** era domingo
(`scheduler.py`), porque o run automático é `cron("0 0 * * *")` = 00:00 UTC e a
janela em UTC é exatamente o domingo (sábado 21:00 → domingo 21:00 em BRT). Se o
processo estivesse fora do ar nessa janela, a semana inteira ficava sem card de
rotina semanal — e sem erro em log, porque simplesmente não havia candidato.

Este arquivo trava o comportamento do regate:

1. Em dia útil, a rodada semanal é reaplicada **ancorada na semana corrente**, de
   modo que produza exatamente os mesmos `period_key`/`routine_instance_id` que o
   run de domingo teria produzido. Sem a âncora, `current + (wd + 1)` numa
   quarta-feira daria quinta→quarta e criaria card com uma semana de prazo errada.
2. O que já foi gerado não duplica: o dedup por `routine_instance_id` (§1.2) é o
   próprio mecanismo de idempotência.
3. O run de domingo continua igual (gera a semana que vem) e o bônus das dailies
   de segunda continua exclusivo do automático de domingo.
4. O regate **não cria card retroativo** (P-6, definido pelo dono): só dias a
   partir de hoje, porque card de dia já passado só entraria no board atrasado.
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.task_manager.models import Task
from src.modules.task_manager.scheduler import TaskScheduler, build_routine_instance_id
from tests.helpers import register_user

# Quarta-feira, 22/07/2026 (UTC). A semana começou na segunda 20/07.
WEDNESDAY = datetime(2026, 7, 22, 12, 0, 0, tzinfo=timezone.utc)
MONDAY = datetime(2026, 7, 20, 0, 0, 0, tzinfo=timezone.utc)
THURSDAY = datetime(2026, 7, 23, 0, 0, 0, tzinfo=timezone.utc)
FRIDAY = datetime(2026, 7, 24, 0, 0, 0, tzinfo=timezone.utc)
# Domingo, 26/07/2026 (UTC) — a mesma semana ainda não capturada pela segunda.
SUNDAY_BEFORE = datetime(2026, 7, 19, 0, 0, 0, tzinfo=timezone.utc)


def _setup_weekly(client, auth, days=("friday",)):
    """Cria cliente, template semanal com uma atividade e o vínculo.

    Args:
        client: Cliente FastAPI de teste.
        auth: Header de autorização do usuário.
        days: Dias marcados, no enum do contrato da API (P-5).

    Returns:
        Tupla com o id do cliente e o id do template.
    """
    cli = client.post(
        "/clients/",
        json={"name": "Empresa Semanal", "cnpj": "12.345.678/0001-99"},
        headers=auth,
    ).json()

    tmpl = client.post(
        "/tasks/templates/",
        json={
            "name": "Rotina Semanal",
            "recurrence": "weekly",
            "weekdays": list(days),
            "process_type": "fiscal",
        },
        headers=auth,
    )
    assert tmpl.status_code == 201, tmpl.text
    tmpl_id = tmpl.json()["id"]

    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Atividade Semanal", "due_day": 1},
        headers=auth,
    )
    link = client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )
    assert link.status_code in (200, 201), link.text
    return UUID(cli["id"]), UUID(tmpl_id)


def _complete_pending_tasks(client_id: UUID, template_id: UUID) -> None:
    """Conclui os cards gerados no ato do vínculo (regra §1.2 destrava a geração).

    Args:
        client_id: Empresa do vínculo.
        template_id: Template da rotina.
    """
    db = SessionLocal()
    try:
        for task in (
            db.query(Task)
            .filter(Task.client_id == client_id, Task.template_id == template_id)
            .all()
        ):
            task.completed_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def _weekly_cards(client_id: UUID, template_id: UUID) -> list[Task]:
    """Cards do template.

    Args:
        client_id: Empresa do vínculo.
        template_id: Template da rotina.

    Returns:
        Lista de cards (a sessão é fechada antes do retorno).
    """
    db = SessionLocal()
    try:
        return (
            db.query(Task)
            .filter(Task.client_id == client_id, Task.template_id == template_id)
            .all()
        )
    finally:
        db.close()


def test_missed_weekly_is_caught_up_on_a_weekday(client):
    """Quarta-feira sem o run de domingo: a semana corrente é gerada."""
    email = f"catchup_{uuid4()}@cafe.com"
    auth = _auth(client, email)
    client_id, tmpl_id = _setup_weekly(client, auth, days=("friday",))  # sexta
    _complete_pending_tasks(client_id, tmpl_id)

    result = TaskScheduler().run_daily_check(now=WEDNESDAY, mode="all")

    cards = _weekly_cards(client_id, tmpl_id)
    generated = [c for c in cards if c.completed_at is None]
    assert result["tasks_generated"] >= 1, result
    assert generated, "o regate deveria ter criado o card de sexta-feira"


def test_catch_up_anchors_on_the_current_week_not_on_today(client):
    """A âncora é a segunda da semana — o prazo não pode escorregar uma semana.

    Numa quarta-feira, a formula antiga `current + (wd + 1)` cairia na segunda da
    **semana seguinte** (27/07) em vez da sexta da semana corrente (24/07): um card
    sete dias adiantado. O teste fixa a data certa.
    """
    email = f"anchor_{uuid4()}@cafe.com"
    auth = _auth(client, email)
    client_id, tmpl_id = _setup_weekly(client, auth, days=("friday",))  # sexta
    _complete_pending_tasks(client_id, tmpl_id)

    TaskScheduler().run_daily_check(now=WEDNESDAY, mode="all")

    cards = [c for c in _weekly_cards(client_id, tmpl_id) if c.completed_at is None]
    assert cards, "nenhum card pendente foi criado"
    deadlines = {c.deadline.date() for c in cards}
    assert deadlines == {FRIDAY.date()}, (
        f"esperado só a sexta 24/07; veio {deadlines} — a âncora da semana escorregou"
    )


def test_catch_up_does_not_duplicate_what_sunday_already_created(client):
    """Rodar de novo na mesma semana não regenera a semana, mesmo com o card concluído.

    Sem concluir o card, a regra §1.2 esconderia o problema: o card pendente de
    segunda bloquearia a geração de qualquer forma. Concluindo, o único mecanismo
    que pode barrar a duplicata é o dedup por `routine_instance_id` — e é
    exatamente ele que a âncora por semana precisa preservar.
    """
    email = f"nodup_{uuid4()}@cafe.com"
    auth = _auth(client, email)
    client_id, tmpl_id = _setup_weekly(client, auth)
    _complete_pending_tasks(client_id, tmpl_id)

    sunday = TaskScheduler().run_daily_check(now=SUNDAY_BEFORE, mode="all")
    assert sunday["tasks_generated"] >= 1, sunday

    # O usuário concluiu o card de segunda — nada mais bloqueia a geração.
    _complete_pending_tasks(client_id, tmpl_id)
    generated_by_sunday = len(_weekly_cards(client_id, tmpl_id))

    # Segunda-feira da mesma semana: a rodada de domingo já rodou.
    monday = datetime(2026, 7, 20, 12, 0, 0, tzinfo=timezone.utc)
    TaskScheduler().run_daily_check(now=monday, mode="all")

    total = len(_weekly_cards(client_id, tmpl_id))
    assert total == generated_by_sunday, (
        f"o regate regenerou a semana: {generated_by_sunday} -> {total} cards"
    )


def test_catch_up_instance_id_matches_the_sunday_run(client):
    """O `routine_instance_id` do regate é o mesmo que o do run de domingo.

    É o que torna o regate seguro por construção: o dedup é por instância, então
    se o ids batem, um card já criado é reconhecido sem nenhuma consulta extra.
    """
    email = f"instance_{uuid4()}@cafe.com"
    auth = _auth(client, email)
    client_id, tmpl_id = _setup_weekly(client, auth, days=("friday",))  # sexta
    _complete_pending_tasks(client_id, tmpl_id)

    db = SessionLocal()
    try:
        from src.modules.task_manager.models import ClientTemplateAssignment

        assignment = (
            db.query(ClientTemplateAssignment)
            .filter(ClientTemplateAssignment.client_id == client_id)
            .one()
        )
        expected = build_routine_instance_id(
            assignment.id, "Atividade Semanal", "2026-07-24"
        )
    finally:
        db.close()

    TaskScheduler().run_daily_check(now=WEDNESDAY, mode="all")

    cards = [c for c in _weekly_cards(client_id, tmpl_id) if c.completed_at is None]
    assert cards, "o regate não criou card"
    assert cards[0].routine_instance_id == expected, (
        "o instance_id do regate não bate com o do run de domingo — "
        "o dedup não reconheceria card já criado"
    )


def test_weekday_run_does_not_grant_the_monday_dailies_bonus(client):
    """O bônus "semanal gera as dailies de segunda" é exclusivo do domingo.

    Numa quarta-feira a rotina diária **tem** card novo — é a regra diária comum,
    para quinta. O que não pode acontecer é o card vir pelo caminho do bônus de
    domingo (que tem prazo de segunda). A distinção é o prazo: quinta vem da
    regra diária, segunda seria o bônus.
    """
    email = f"bonus_{uuid4()}@cafe.com"
    auth = _auth(client, email)

    cli = client.post(
        "/clients/",
        json={"name": "Empresa Diario", "cnpj": "12.345.678/0001-99"},
        headers=auth,
    ).json()
    tmpl = client.post(
        "/tasks/templates/",
        json={"name": "Rotina Diaria", "recurrence": "daily", "process_type": "fiscal"},
        headers=auth,
    ).json()
    client.post(
        f"/tasks/templates/{tmpl['id']}/activities/",
        json={"name": "Atividade Diaria", "due_day": 1},
        headers=auth,
    )
    client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl["id"]},
        headers=auth,
    )
    cli_id = UUID(cli["id"])
    tmpl_uuid = UUID(tmpl["id"])
    _complete_pending_tasks(cli_id, tmpl_uuid)

    TaskScheduler().run_daily_check(now=WEDNESDAY, mode="all")

    pending = [c for c in _weekly_cards(cli_id, tmpl_uuid) if c.completed_at is None]
    assert pending, "a regra diária de quarta deveria gerar o card de quinta"
    deadlines = {c.deadline.date() for c in pending}
    assert deadlines == {THURSDAY.date()}, (
        f"esperado só quinta 23/07 (regra diária); veio {deadlines} — "
        "o bônus de segunda escapou para dia útil"
    )


def test_catch_up_does_not_create_cards_for_days_already_gone(client):
    """Regate não gera card retroativo: só do dia em diante (P-6, definido pelo dono).

    Numa quarta-feira, a segunda e a terça da semana já foram. Gerar o card delas
    agora só produziria tarefas **atrasadas** que ninguém pode mais cumprir — o
    board mostraria um vencimento perdido no momento em que a rotina foi
    recuperada.
    """
    email = f"retro_{uuid4()}@cafe.com"
    auth = _auth(client, email)
    client_id, tmpl_id = _setup_weekly(client, auth, days=("monday",))  # segunda
    _complete_pending_tasks(client_id, tmpl_id)

    result = TaskScheduler().run_daily_check(now=WEDNESDAY, mode="all")

    assert result["tasks_generated"] == 0, (
        f"não deveria gerar card de dia já passado; gerou {result['tasks_generated']}"
    )
    assert not [
        c for c in _weekly_cards(client_id, tmpl_id) if c.completed_at is None
    ], "o regate criou card retroativo"


def test_catch_up_generates_only_the_remaining_days_of_the_week(client):
    """Com a semana pela metade, gera só os dias marcados que ainda vêm."""
    email = f"remaining_{uuid4()}@cafe.com"
    auth = _auth(client, email)
    client_id, tmpl_id = _setup_weekly(
        client, auth, days=("thursday", "friday")
    )  # quinta e sexta
    _complete_pending_tasks(client_id, tmpl_id)

    result = TaskScheduler().run_daily_check(now=WEDNESDAY, mode="all")

    cards = [c for c in _weekly_cards(client_id, tmpl_id) if c.completed_at is None]
    assert result["tasks_generated"] == 2, result
    assert {c.deadline.date() for c in cards} == {
        THURSDAY.date(),
        FRIDAY.date(),
    }, "deveria gerar apenas quinta 23/07 e sexta 24/07"


def _auth(client, email: str) -> dict:
    """Registra e autentica um usuário de teste.

    Args:
        client: Cliente FastAPI de teste.
        email: E-mail do usuário.

    Returns:
        Header de autorização.
    """
    register_user(
        payload={"email": email, "password": "StrongPassword123!", "name": "Teste"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
