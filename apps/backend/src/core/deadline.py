"""Prazo de tarefa: uma única fonte para "quantos dias faltam" e "está atrasado".

A regra é de **data de negócio**, não de instante: o prazo é uma data, então a
tarefa só está atrasada quando o dia do prazo já passou. "Vence hoje" é hoje —
se contasse as horas, uma tarefa que vence às 23:59 marcaria o usuário o dia
inteiro como atrasada.

O dia é o do fuso de negócio (America/Sao_Paulo), não o do UTC: às 21:00 UTC
de segunda já é 18:00 de segunda aqui, e às 01:00 UTC de terça ainda é segunda
à noite. Usar o dia do UTC faria a tarefa parecer atrasada na virada do dia.
"""

from datetime import date, datetime, time, timedelta, timezone

try:  # pragma: no cover - depende da presença de tzdata na imagem
    from zoneinfo import ZoneInfo

    BUSINESS_TZ = ZoneInfo("America/Sao_Paulo")
except Exception:  # pragma: no cover
    BUSINESS_TZ = timezone(timedelta(hours=-3))


def business_date(value: datetime) -> date:
    """Data de calendário do prazo no fuso de negócio."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(BUSINESS_TZ).date()


def business_day_bounds(reference: datetime) -> tuple[datetime, datetime]:
    """Início e fim do dia de negócio, como instantes UTC para filtrar no banco.

    São 03:00 UTC, não 00:00: o usuário vê o dia pelo fuso dele. Filtrar pela
    meia-noite UTC punha na lista de "hoje" tarefas que vencem às 22:00 de
    ontem no relógio do usuário.
    """
    day = business_date(reference)
    start = datetime.combine(day, time.min, tzinfo=BUSINESS_TZ)
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def days_remaining(
    deadline: datetime | None, *, today: date | None = None
) -> int | None:
    """Dias de calendário até o prazo: vence hoje → 0, ontem → -1.

    `today` é injetável para os testes não dependerem do relógio.
    """
    if deadline is None:
        return None
    reference = today if today is not None else datetime.now(BUSINESS_TZ).date()
    return (business_date(deadline) - reference).days


def is_overdue(deadline: datetime | None, *, today: date | None = None) -> bool:
    """Atrasado é ter o dia do prazo **já passado** — não "é hoje"."""
    remaining = days_remaining(deadline, today=today)
    return remaining is not None and remaining < 0
