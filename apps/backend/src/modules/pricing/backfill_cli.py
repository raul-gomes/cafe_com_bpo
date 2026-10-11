"""Recalcula o preço de orçamentos gravados antes da Metodologia v4.

Uso (na cópia restaurada primeiro, sempre):

    python -m src.modules.pricing.backfill          # só relata, não escreve
    python -m src.modules.pricing.backfill --apply  # grava o que a v4 descreve

Orçamento com `input_payload` legado não é inventado: fica intacto com o valor
histórico e aparece como "fora_da_v4" no relato.
"""

import argparse
import sys

from src.core.database import SessionLocal
from src.modules.pricing.backfill import backfill_proposal_prices


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="backfill_proposal_prices",
        description="Recalcula o preço dos orçamentos pela Metodologia v4.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Grava as alterações. Sem esta flag o script apenas relata.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Registros por commit (padrão: 200).",
    )
    args = parser.parse_args(argv)

    session = SessionLocal()
    try:
        report = backfill_proposal_prices(
            session, apply=args.apply, batch_size=args.batch_size
        )
    finally:
        session.close()

    for failure in report.failures:
        print(f"ERRO {failure}", file=sys.stderr)

    mode = "APLICADO" if args.apply else "SIMULAÇÃO (nada foi gravado)"
    print(f"{mode}: {report}")
    return 1 if report.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
