"""Escrita dupla: `clients`/`prospects` e as tabelas filhas nascem com `company_id`.

Até R4 remover as colunas antigas, cada linha nova precisa nascer nas duas. A
regra é aplicada em **listener de ORM** em vez de em cada `create()` de cada
módulo, porque os caminhos de escrita são muitos (gerador de rotinas,
finalização de contrato, cadastro manual) e um `create()` esquecido viraria
linha sem dono silenciosamente — a falha apareceria só quando a leitura
migrasse, semanas depois.

O que cada listener faz:

- `Client`/`Prospect` inseridos → nasce a `Company` com o **mesmo id**.
- Linha filha inserida/atualizada → `company_id` preenchido a partir do dono
  legado, seguindo a conversão quando o dono é um prospecto já conquistado.
- `company_id` que não resolve para uma empresa existente **não é escrito**:
  melhor linha sem dono (e visível na verificação) que FK apontando para o vazio.
"""

import logging
import uuid
from datetime import datetime

from sqlalchemy import event, select, update
from sqlalchemy.orm import Session, object_session

from src.modules.clients.models import Client
from src.modules.companies.fk_backfill import resolve_company_id
from src.modules.companies.models import (
    COMPANY_TYPE_CLIENT,
    COMPANY_TYPE_PROSPECT,
    Company,
)
from src.modules.contacts.models import Contact
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.task_manager.models import (
    ClientSLA,
    ClientTemplateAssignment,
    Task,
)
from src.modules.team.models import Team

log = logging.getLogger(__name__)

# Tabela -> aceita prospecto? (define se a conversão precisa ser seguida)
CHILD_MODELS = {
    PricingScenario: True,
    Contract: True,
    Task: False,
    Team: False,
    ClientSLA: False,
    ClientTemplateAssignment: False,
}


def _mirror(source, company_type: str) -> None:
    """Cria a empresa correspondente, com os mesmos cadastrais e o mesmo id."""
    from src.modules.companies.backfill import _company_from

    # O `id` das tabelas legadas é default Python (`uuid4`), e o SQLAlchemy só o
    # avalia **depois** do `before_insert` — sem esta linha, a empresa nasceria
    # com outro id e as colunas `company_id` apontariam para o vazio.
    if source.id is None:
        source.id = uuid.uuid4()
    company = _company_from(source, company_type)
    session = object_session(source)
    if session is None:
        log.warning(
            "[companies] %s %s sem sessão: empresa não espelhada",
            type(source).__name__,
            source.id,
        )
        return
    session.add(company)


# `before_insert` (e não `after_insert`) porque o `id` das duas é gerado em
# Python (`default=uuid4`), então já existe antes do INSERT — e um objeto
# adicionado à sessão durante o flush só entra no flush atual se for no
# `before_*`.
@event.listens_for(Client, "before_insert")
def _client_becomes_company(mapper, connection, target: Client) -> None:
    _mirror(target, COMPANY_TYPE_CLIENT)


@event.listens_for(Prospect, "before_insert")
def _prospect_becomes_company(mapper, connection, target: Prospect) -> None:
    _mirror(target, COMPANY_TYPE_PROSPECT)


@event.listens_for(Session, "before_flush")
def _mirror_pending_cadastrais(session: Session, flush_context, instances) -> None:
    """Espelha os cadastrais editados das linhas legadas para a empresa.

    A leitura de clientes já sai de `companies` (Fase 3, item 3) e a de
    prospects vem logo atrás (item 4), então a empresa precisa acompanhar a
    edição do cadastro legado. Sem este espelho, salvar um CNPJ e recarregar a
    tela mostra o valor antigo — o dado que o usuário acabou de cadastrar
    desaparece da tela sem nenhum erro.

    É `before_flush` (e não `before_update`) por causa da ordem do flush: o
    unit of work decide o que está sujo **antes** de emitir os UPDATEs, e as
    duas tabelas não têm FK entre si, então a empresa pode já ter sido
    processada quando o `before_update` do prospecto roda — a alteração feita
    ali não vira UPDATE. Em `before_flush` o `session.dirty` ainda está sendo
    lido, e a empresa entra no mesmo flush.

    Só os cadastrais são copiados: `is_active`/`deleted_at` têm dono próprio (a
    desativação em cascata, regra §16) e o ciclo de vida (`converted_at`,
    `reproved_at`) é espelhado pelos métodos de lifecycle, que também decidem
    quando a empresa muda de estágio.
    """
    from src.modules.companies.backfill import CADASTRAL_FIELDS

    for target in session.dirty:
        if not isinstance(target, (Client, Prospect)):
            continue
        company = session.get(Company, target.id)
        if company is None:
            # Empresa sem linha (ou já colapsada na conversão): nada a
            # atualizar. A verificação V5 e o backfill cobrem o buraco.
            log.warning(
                "[companies] %s %s sem empresa: cadastrais não espelhados",
                type(target).__name__,
                target.id,
            )
            continue
        for field_name in CADASTRAL_FIELDS:
            setattr(company, field_name, getattr(target, field_name))


def _fill_company_id(mapper, connection, target) -> None:
    """Preenche `company_id` na linha filha a partir do dono legado."""
    if getattr(target, "company_id", None) is not None:
        return
    session = object_session(target)
    if session is None:
        return
    follow_conversion = CHILD_MODELS.get(type(target), False)
    company_id = resolve_company_id(session, target, follow_conversion)
    if company_id is None:
        return
    target.company_id = company_id
    if hasattr(target, "company_type"):
        target.company_type = COMPANY_TYPE_CLIENT


for _model in CHILD_MODELS:
    event.listen(_model, "before_insert", _fill_company_id)
    event.listen(_model, "before_update", _fill_company_id)


def collapse_prospect_into_client(
    session: Session, prospect: Prospect, client: Client, converted_at: datetime
) -> None:
    """Converte em tempo de execução: o par vira uma empresa só.

    Sob escrita dupla existem **duas** linhas (`companies` do prospecto e da
    cliente), então o colapso aqui é: mover os filhos para a empresa do cliente,
    apagar a empresa do prospecto e marcar a conversão. As colunas legadas
    (`prospect_id`, `converted_client_id`) continuam como estão — elas valem
    até R4, e é delas que a listagem da Governança ainda lê.
    """
    for model in CHILD_MODELS:
        session.execute(
            model.__table__.update()
            .where(model.company_id == prospect.id)
            .values(company_id=client.id)
        )

    # O contato do representante nasce apontado para a empresa do *prospecto*, e
    # a conversão apaga essa empresa. Sem mover antes, a conversão quebra na FK
    # (`NO ACTION` -> ForeignKeyViolation, e prospecto com representante não
    # converte); trocar a FK para `CASCADE` não resolveria, porque apagaria o
    # representante — que é justamente o dado que a empresa cliente herda.
    session.execute(
        update(Contact)
        .where(Contact.company_id == prospect.id)
        .values(company_id=client.id)
    )

    company = session.get(Company, client.id)
    if company is not None:
        if company.converted_at is None:
            company.converted_at = converted_at
        if company.primary_contact_id is None:
            # A empresa cliente pode ter vários contatos: nenhum é descartado, e
            # a ordem fixa deixa a escolha estável entre execuções.
            herdado = session.scalars(
                select(Contact)
                .where(Contact.company_id == client.id)
                .order_by(Contact.created_at, Contact.id)
                .limit(1)
            ).first()
            if herdado is not None:
                company.primary_contact_id = herdado.id
            elif prospect.representante_nome:
                # Prospecto sem contato ainda: ele nasce do representante.
                contato = _contact_from_representante(session, prospect, company)
                if contato is not None:
                    company.primary_contact_id = contato.id

    prospect_company = session.get(Company, prospect.id)
    if prospect_company is not None:
        session.delete(prospect_company)

    prospect.converted_client_id = client.id
    prospect.converted_at = converted_at
    session.flush()


def _contact_from_representante(session: Session, prospect: Prospect, company: Company):
    """Contato do representante, se ainda não existir para esta empresa."""
    from src.modules.companies.backfill import (
        _has_representante,
        _representante_to_contact,
    )
    from src.modules.contacts.models import Contact

    if not _has_representante(prospect):
        return None
    existing = session.scalars(
        select(Contact).where(Contact.company_id == company.id)
    ).first()
    if existing is not None:
        return existing
    contact = _representante_to_contact(prospect, company)
    session.add(contact)
    session.flush()
    return contact


__all__ = ["CHILD_MODELS", "collapse_prospect_into_client"]
