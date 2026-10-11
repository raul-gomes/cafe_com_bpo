"""Regra §16 — desativação em cascata de uma empresa.

O dono do produto definiu (2026-09-30) que **não existe hard delete** no
produto: arquivar uma empresa marca `is_active = false` nela **e em toda linha
que aponta para ela por `company_id`**, preservando o histórico — quando a
empresa esteve ativa, e o que existia vinculado a ela (contato, tarefas, times,
SLAs, rotinas, orçamentos, contratos).

Por que fica aqui e não em cada módulo: a lista de tabelas é da **empresa**, e
a empresa é a mesma linha para prospecto e para cliente (Fase 1/R1). Espalhar
a cascata por módulo faria cada rota de arquivamento depender de lembrar a lista
inteira — e foi exatamente o que aconteceu: o cascade anterior vivia no
repository de clientes e cobria só tarefas e orçamentos, por `client_id`.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.companies.models import Company
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.task_manager.models import (
    ClientSLA,
    ClientTemplateAssignment,
    Task,
)
from src.modules.team.models import Team

# Tabela -> model. A lista é a fonte única da cascata: acrescentar uma tabela com
# `company_id` aqui é o que a faz acompanhar a desativação.
#
# `contacts` NÃO entra: o contato da empresa continua ativo quando a empresa é
# arquivada, porque a agenda precisa mostrar a pessoa de uma empresa arquivada
# (regra §13, confirmada pelo dono do produto em 2026-09-30 junto da §16). O
# registro da pessoa é justamente o histórico de "quem era o contato", e apagá-lo
# de vista perderia essa informação.
CASCADE_TABLES = (
    Task,
    Team,
    ClientSLA,
    ClientTemplateAssignment,
    PricingScenario,
    Contract,
)


def deactivate_company(session: Session, company_id: UUID) -> dict[str, int]:
    """Desativa toda linha ativa que pertence à empresa e devolve o placar.

    Marca `is_active = false` e `deleted_at` com o **mesmo instante** em todas as
    tabelas de `CASCADE_TABLES` que têm `company_id = company_id`. Nada é
    apagado: as linhas continuam no banco, que é o que responde "o que existia
    quando a empresa estava ativa". O contato da empresa fica de fora (ver
    `CASCADE_TABLES`).

    O registro legado (prospect/client) é desativado pelo chamador, que já o
    carregou com escopo do usuário; a linha de `companies` é desativada aqui,
    porque é a raiz da cascata e a que a listagem lê.

    Returns:
        dict[str, int]: nome da tabela -> quantas linhas foram desativadas.
    """
    deactivated_at = datetime.now(timezone.utc)
    report: dict[str, int] = {}
    for model in CASCADE_TABLES:
        updated = (
            session.query(model)
            .filter(model.company_id == company_id, model.is_active.is_(True))
            .update(
                {"is_active": False, "deleted_at": deactivated_at},
                synchronize_session="fetch",
            )
        )
        report[model.__tablename__] = updated
    # A própria empresa entra na cascata: a listagem de clientes e de prospects
    # é lida de `companies` (Fase 3, itens 3 e 4), então `companies.is_active` é
    # o que decide o que a tela mostra. Antes a empresa ficava ativa e o
    # arquivamento devolvia 204 sem tirar a empresa da listagem.
    report["companies"] = (
        session.query(Company)
        .filter(Company.id == company_id, Company.is_active.is_(True))
        .update(
            {"is_active": False, "deleted_at": deactivated_at},
            synchronize_session="fetch",
        )
    )
    session.flush()
    return report
