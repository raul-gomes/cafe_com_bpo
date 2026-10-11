"""Contrato único dos dias da semana da rotina semanal (P-5).

Por que este módulo existe: a máscara de dias era convertida em **quatro** lugares
(`scheduler.py` ×3 e `assignments/service.py`), cada um com um parser próprio, e a
documentação do código discordava do frontend. O resultado observado foi `"0"` (que o
frontend gravava para domingo) virando `-1` — dia inexistente —, o que gerava card da
semana anterior no scheduler semanal e nada na geração do vínculo.

Decisão do dono (2026-10-04):

- **Na API** o dia é :class:`Weekday` — um enum de string (`"monday"` …). O cliente
  nunca converte número em dia, que é onde o off-by-one nascia;
- **no banco** a coluna `weekday_mask` continua sendo texto de dígitos separados por
  vírgula (`"1,2,3"`, 1=seg … 7=dom), porque é o formato já gravado e o que a
  migração existente entende. Só dígitos separados por vírgula são aceitos;
- **`0` continua sendo lido** como domingo, porque a tela antiga gravou `0` e linha já
  salva não pode deixar de abrir. O que não existe é gravar `0` agora.
"""

from enum import StrEnum

# Formato aceito na coluna: dígitos separados por vírgula, 1=seg … 7=dom.
_MASK_SEPARATOR = ","
_MASK_DIGIT_RANGE = range(1, 8)
_LEGACY_ZERO = 0  # DOM=0 na convenção 0-based que a tela antiga gravava

# Ponte entre o enum (API) e o dígito (banco). Fica aqui, e só aqui, para que o
# mapeamento não possa divergir entre leitura e gravação.
_WEEKDAY_TO_DIGIT = {
    "monday": 1,
    "tuesday": 2,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 6,
    "sunday": 7,
}
_DIGIT_TO_WEEKDAY = {digit: name for name, digit in _WEEKDAY_TO_DIGIT.items()}
_DIGIT_TO_WEEKDAY[_LEGACY_ZERO] = "sunday"


class Weekday(StrEnum):
    """Dia da semana no contrato da API.

    O valor é a string (`"monday"`), então o JSON entregue ao frontend é legível e não
    existe número para o cliente reinterpretar. A conversão para o dígito do banco é
    feita por :func:`format_weekday_mask` e para o índice de ``datetime.weekday()`` por
    :attr:`python_weekday`.
    """

    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"

    @property
    def python_weekday(self) -> int:
        """Índice aceito por ``datetime.weekday()`` (0=segunda … 6=domingo).

        Returns:
            Inteiro de 0 a 6 correspondente ao dia.
        """
        return _WEEKDAY_TO_DIGIT[self.value] - 1

    @property
    def mask_digit(self) -> int:
        """Dígito como gravado na coluna ``weekday_mask``.

        Returns:
            Inteiro de 1 a 7 usado no armazenamento.
        """
        return _WEEKDAY_TO_DIGIT[self.value]


def parse_weekday_mask(mask: str | None) -> list[Weekday]:
    """Lê a coluna ``weekday_mask`` e devolve os dias, sem repetição e em ordem.

    Aceita espaço em volta do dígito porque é ruído de digitação comum na mão; qualquer
    outra coisa — texto, vírgula dupla, ponto, sinal, número fora do contrato — é erro,
    e o erro acontece **aqui**, na leitura, e não lá dentro do scheduler.

    Args:
        mask: Conteúdo da coluna, por exemplo ``"1,3"``. ``None`` ou vazio = sem dia.

    Returns:
        Dias da semana em ordem de segunda a domingo.

    Raises:
        ValueError: Se o formato não for dígitos separados por vírgula, ou se algum
            dígito estiver fora do contrato.
    """
    if not mask:
        return []

    days: list[Weekday] = []
    for chunk in mask.split(_MASK_SEPARATOR):
        token = chunk.strip()
        if not token.isdigit():
            raise ValueError(
                f"weekday_mask fora do contrato: {mask!r} "
                "(aceito dígitos separados por vírgula, ex.: '1,3')"
            )
        digit = int(token)
        if digit == _LEGACY_ZERO:
            days.append(Weekday.SUNDAY)  # legado do frontend 0-based
            continue
        if digit not in _MASK_DIGIT_RANGE:
            raise ValueError(
                f"weekday_mask fora do contrato: {digit!r} (aceito 1..7, ou 0 legado)"
            )
        days.append(Weekday(_DIGIT_TO_WEEKDAY[digit]))

    unique = {day.value: day for day in days}
    return sorted(unique.values(), key=lambda day: day.python_weekday)


def format_weekday_mask(days: list[Weekday]) -> str | None:
    """Grava os dias na coluna ``weekday_mask``.

    Args:
        days: Dias a persistir.

    Returns:
        Texto de dígitos separados por vírgula em ordem canônica, ou ``None`` quando
        não há dia algum (rotina não é semanal).
    """
    if not days:
        return None
    ordered = sorted(
        {day.value for day in days}, key=lambda value: _WEEKDAY_TO_DIGIT[value]
    )
    return _MASK_SEPARATOR.join(str(_WEEKDAY_TO_DIGIT[value]) for value in ordered)
