"""Backfill do preço dos orçamentos gravados antes da Metodologia v4.

Modelo aplicado: **recalcula só o que a v4 sabe descrever**. Um
`input_payload` legado (v1/v2) não é inventado nem aproximado — o registro é
contado como "fora da v4" e fica **intacto**, com o valor histórico que o
cliente já viu. O script é idempotente e, por padrão, **não escreve nada**:
sem `--apply` ele só relata o que faria.
"""

from sqlalchemy.orm import Session

from src.modules.pricing.schemas import PricingCalculateRequest
from src.modules.pricing.service import PricingService
from src.modules.proposals.models import PricingScenario


class BackfillReport:
    """Contagem do que o backfill encontrou e do que mudou."""

    def __init__(self) -> None:
        self.scanned = 0
        self.recalculated = 0
        self.unchanged = 0
        self.legacy_skipped = 0
        self.failed = 0
        self.failures: list[str] = []

    def as_dict(self) -> dict[str, int]:
        return {
            "analisados": self.scanned,
            "recalculados": self.recalculated,
            "iguais": self.unchanged,
            "fora_da_v4": self.legacy_skipped,
            "erros": self.failed,
        }

    def __str__(self) -> str:
        return (
            f"analisados={self.scanned} recalculados={self.recalculated} "
            f"iguais={self.unchanged} fora_da_v4={self.legacy_skipped} "
            f"erros={self.failed}"
        )


def _normalized(payload: dict | None) -> dict:
    """Compara dicionários por valor, ignorando a ordem das chaves."""
    return dict(payload or {})


def backfill_proposal_prices(
    session: Session,
    *,
    apply: bool = False,
    batch_size: int = 200,
) -> BackfillReport:
    """Recalcula o `result_payload` dos orçamentos que a v4 consegue descrever.

    Args:
        session: sessão de banco onde a coluna `result_payload` será lida.
        apply: quando `False` (padrão), nada é gravado — só o relato.
        batch_size: quantos registros são commitados por vez.

    Returns:
        BackfillReport: contagem por desfecho, mais o id dos que falharam.
    """
    pricing_service = PricingService()
    report = BackfillReport()

    scenarios = (
        session.query(PricingScenario)
        .order_by(PricingScenario.id)
        .yield_per(batch_size)
    )

    pending = 0
    for scenario in scenarios:
        report.scanned += 1
        try:
            request = PricingCalculateRequest.model_validate(
                scenario.input_payload or {}
            )
        except ValueError:
            # Payload que não é uma simulação v4: preserva o valor histórico.
            report.legacy_skipped += 1
            continue

        try:
            calculated = pricing_service.build_result_payload(request)
        except ValueError as exc:
            # Regra de negócio barrada (ex.: imposto + comissão >= 100%).
            report.failed += 1
            report.failures.append(f"{scenario.id}: {exc}")
            continue

        if _normalized(calculated) == _normalized(scenario.result_payload):
            report.unchanged += 1
            continue

        if apply:
            scenario.result_payload = calculated
            pending += 1
            if pending >= batch_size:
                session.commit()
                pending = 0
        report.recalculated += 1

    if apply and pending:
        session.commit()

    return report
