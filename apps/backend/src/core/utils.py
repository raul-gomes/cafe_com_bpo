from datetime import datetime, timedelta


def next_business_day(date: datetime) -> datetime:
    """Avança para o próximo dia útil se a data cair em sábado ou domingo.

    Args:
        date: Data a ser ajustada (timezone-aware ou naive).

    Returns:
        Data ajustada para o próximo dia útil (se necessário),
        preservando hora, minuto, segundo e timezone.
    """
    result = date
    while result.weekday() >= 5:  # 5=Saturday, 6=Sunday
        result += timedelta(days=1)
    return result
