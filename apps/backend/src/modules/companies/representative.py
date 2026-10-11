"""Quem representa o negócio — fonte única para Governança e contratos.

A fonte é o `Contact` apontado por `companies.primary_contact_id`. Quando a
empresa não tem contato ativo, o fallback são as colunas legadas
`prospects.representante_*`, e esse é o **único** lugar do código que ainda lê
`prospects` por outro motivo que não a migração das listagens: some junto com a
tabela no R4, sem deixar nenhum token de contrato sem fonte.

O fallback atende a dois estados da mesma empresa:

- **em prospecção** — a linha de `prospects` ainda é a dona do negócio e tem o
  mesmo id da empresa (o espelho cria a empresa com o id do prospecto);
- **convertida** — a linha de `prospects` continua existindo, apontando para a
  empresa que a substituiu em `converted_client_id`. Sem esse segundo vínculo o
  representante do negócio capturado sumiria da tela e do contrato.
"""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.modules.contacts.models import Contact

from .models import Company

#: Chave de cada valor do representante. O `Contact` e as colunas legadas têm
#: nomes diferentes, então todo consumidor normaliza por aqui em vez de adivinhar.
REPRESENTANTE_KEYS = ("nome", "cargo", "cpf", "email", "telefone")


def _empty() -> dict[str, str | None]:
    """Representante sem nenhum dado — as chaves existem, os valores são nulos.

    Os consumidores testam `representante.get(...)`, então a forma do dict é
    parte do contrato: vir `None` inteiro mudaria o que o template resolve.
    """
    return dict.fromkeys(REPRESENTANTE_KEYS)


def resolve_representative(
    session: Session, company: Company | None
) -> dict[str, str | None]:
    """Representante do negócio, normalizado para as chaves de `REPRESENTANTE_KEYS`.

    Args:
        session: Session ligada ao banco.
        company: Dono do negócio. `None` devolve um representante vazio — a
            geração de contrato usa isso para o rascunho sem dono.

    Returns:
        Os valores do contato ativo; na falta dele, os das colunas legadas do
        prospecto (em prospecção ou já convertido); sem nenhum dos dois, um dict
        com todas as chaves e valor `None`.
    """
    if company is None:
        return _empty()

    contact = None
    if company.primary_contact_id is not None:
        contact = session.get(Contact, company.primary_contact_id)
    if contact is not None and contact.is_active:
        return {
            "nome": contact.nome,
            "cargo": contact.cargo,
            "cpf": contact.cpf,
            "email": contact.email,
            "telefone": contact.telefone,
        }

    from src.modules.prospects.models import Prospect

    legado = session.scalars(
        select(Prospect).where(
            or_(
                Prospect.id == company.id,
                Prospect.converted_client_id == company.id,
            )
        )
    ).first()
    if legado is None:
        return _empty()
    return {
        "nome": legado.representante_nome,
        "cargo": legado.representante_cargo,
        "cpf": legado.representante_cpf,
        "email": legado.representante_email,
        "telefone": legado.representante_telefone,
    }
