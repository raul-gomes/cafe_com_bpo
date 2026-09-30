from datetime import date, datetime, timezone

import pytest

from src.core.deadline import (
    business_date,
    business_day_bounds,
    days_remaining,
    is_overdue,
)

# Segunda-feira fixo: regra de calendário não pode depender de "hoje" real.
HOJE = date(2026, 9, 28)


def _prazo(dia: int, hora: int = 12) -> datetime:
    return datetime(2026, 9, dia, hora, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("prazo", "esperado"),
    [
        (_prazo(29), 1),  # amanhã
        (_prazo(28), 0),  # vence hoje
        (_prazo(27), -1),  # ontem
        (_prazo(25), -3),
    ],
)
def test_dias_usa_calendario_nao_instante(prazo, esperado):
    assert days_remaining(prazo, today=HOJE) == esperado


def test_vence_hoje_nunca_e_atrasado():
    """Regra de negócio: o prazo é uma data. 'Vence hoje' é hoje, não ontem."""
    assert is_overdue(_prazo(28), today=HOJE) is False


def test_ontem_e_atrasado():
    assert is_overdue(_prazo(27), today=HOJE) is True


def test_sem_prazo_nao_esta_atrasado():
    assert is_overdue(None, today=HOJE) is False
    assert days_remaining(None, today=HOJE) is None


def test_prazo_meio_dia_antes_das_meia_noite_ainda_e_hoje():
    """A hora do prazo não pode virar dia: 23:59 de hoje vence hoje."""
    assert is_overdue(_prazo(28, hora=23), today=HOJE) is False


def test_meia_noite_utc_ainda_e_o_dia_de_ontem_no_fuso_de_negocio():
    """00:00 UTC de terça são 21:00 de segunda em São Paulo: o prazo vence
    **hoje**, mesmo que o instantâneo suggestisse o dia seguinte."""
    assert days_remaining(_prazo(29, hora=0), today=HOJE) == 0
    assert is_overdue(_prazo(29, hora=0), today=HOJE) is False


def test_naive_e_tratado_como_utc():
    """O banco devolve `naive` em parte dos caminhos; tratar como UTC evita
    o `astimezone` estourar e mantém o mesmo veredito dos outros."""
    naive = datetime(2026, 9, 27, 12, 0)
    assert is_overdue(naive, today=HOJE) is True


def test_fuso_de_negocio_decide_o_dia():
    """23:30 UTC de segunda é 20:30 de segunda em São Paulo — mesmo dia.
    01:00 UTC de terça é 22:00 de segunda em São Paulo: continua segunda.
    O dia útil do prazo é o do fuso do negócio, não o do UTC."""
    segunda_noite = datetime(2026, 9, 28, 23, 30, tzinfo=timezone.utc)
    assert business_date(segunda_noite) == date(2026, 9, 28)

    terca_cedo_utc = datetime(2026, 9, 29, 1, 0, tzinfo=timezone.utc)
    assert business_date(terca_cedo_utc) == date(2026, 9, 28)


def test_mesma_regra_para_todos_os_meses():
    """Virada de mês não pode virar off-by-one."""
    fim_do_mes = date(2026, 9, 30)
    assert (
        days_remaining(datetime(2026, 9, 30, 12, tzinfo=timezone.utc), today=fim_do_mes)
        == 0
    )
    assert (
        days_remaining(datetime(2026, 10, 1, 12, tzinfo=timezone.utc), today=fim_do_mes)
        == 1
    )
    assert (
        days_remaining(datetime(2026, 8, 31, 12, tzinfo=timezone.utc), today=fim_do_mes)
        == -30
    )


def test_limites_do_dia_de_negocio_sao_em_utc():
    """O filtro de "vence hoje"/"atrasadas" precisa dos mesmos limites.

    A meia-noite do dia de negócio em São Paulo é 03:00 UTC. Filtrar por
    meia-noite UTC colocava na lista de "hoje" as tarefas que vencem às 22:00
    de ontem no horário do usuário — e a mesma tarefa vinha com
    `is_overdue=False` logo abaixo no payload."""
    inicio, fim = business_day_bounds(datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc))
    assert inicio == datetime(2026, 9, 28, 3, 0, tzinfo=timezone.utc)
    assert fim == datetime(2026, 9, 29, 3, 0, tzinfo=timezone.utc)
