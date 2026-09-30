from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from .models import Prospect
from .schemas import ProspectCreate, ProspectUpdate

# As colunas `representante_*` do prospecto viram um contato da empresa.
REPRESENTANTE_FIELDS = (
    "representante_nome",
    "representante_email",
    "representante_cpf",
    "representante_telefone",
    "representante_cargo",
)
CONTATO_POR_CAMPO = {
    "representante_email": "email",
    "representante_cpf": "cpf",
    "representante_telefone": "telefone",
    "representante_cargo": "cargo",
}


def _sync_representante_contact(
    session: Session, prospect: Prospect, data: dict
) -> None:
    """Cadastra o representante como contato da empresa (fonte única).

    `contacts` passou a ser a fonte do representante. O cadastro do prospecto
    continua entregando as colunas na API — é o que o formulário envia e o que o
    contrato lê — mas elas passam a **nascer** um contato ligado à empresa, que
    é o principal dela.

    Fica aqui, e não no service, porque o `PUT /prospects/{id}` do router chama
    o repository direto: um hook no service seria contornado por esse caminho,
    e é exatamente o tipo de caminho que esquece. Dado duplicado sem dono é o que
    já divergiu uma vez — a cópia do backfill nunca era sincronizada, e foi ela
    que impedia a conversão de prospecto em cliente.

    Campo ausente no `PUT` mantém o que já existia. Representante apagado por
    inteiro remove o contato da agenda em vez de deixar uma linha sem ninguém.
    """
    from src.modules.companies.models import Company
    from src.modules.contacts.models import Contact

    if not any(campo in data for campo in REPRESENTANTE_FIELDS):
        return
    # A empresa espelhada entra na sessão como objeto **pendente** durante o
    # flush do prospecto, e o `id` dela (default Python) só existe no flush
    # seguinte. Sem este flush, `get` não a encontra e o contato nasce órfão.
    session.flush()
    company = session.get(Company, prospect.id)
    if company is None:
        return
    contact = (
        None
        if company.primary_contact_id is None
        else session.get(Contact, company.primary_contact_id)
    )

    nome = data.get("representante_nome", prospect.representante_nome)
    if not nome:
        if contact is not None and contact.is_active:
            contact.is_active = False
            contact.deleted_at = datetime.now(timezone.utc)
        company.primary_contact_id = None
        session.flush()
        return

    if contact is None or not contact.is_active:
        contact = Contact(user_id=prospect.user_id, company_id=company.id, nome=nome)
        session.add(contact)
        # `id` é default Python (`uuid4`) e o SQLAlchemy só o avalia no flush:
        # sem isto, `primary_contact_id` receberia None.
        session.flush()
    elif contact.nome != nome:
        contact.nome = nome
    contact.empresa = company.name
    for campo, coluna in CONTATO_POR_CAMPO.items():
        valor = data.get(campo, getattr(prospect, campo))
        if valor is not None and getattr(contact, coluna) != valor:
            setattr(contact, coluna, valor)
    company.primary_contact_id = contact.id
    session.flush()


def _mirror_lifecycle(prospect: Prospect, *, reproved_at: datetime | None) -> None:
    """Espelha a classificação do negócio na `Company`.

    A partir do cutover da leitura a listagem filtra por `companies`, então a
    flag precisa existir nos dois lados. Prospecto de empresa já convertida
    não tem linha própria: quem guarda o estado é a empresa do cliente, e é lá
    que o filtro vai olhar.
    """
    from src.modules.companies.models import Company
    from src.modules.prospects.models import Prospect as ProspectModel

    company_id = (
        prospect.converted_client_id
        if isinstance(prospect, ProspectModel) and prospect.converted_client_id
        else prospect.id
    )
    company = prospect._sa_instance_state.session.get(Company, company_id)
    if company is not None:
        company.reproved_at = reproved_at


class ProspectRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, prospect_id: UUID, user_id: UUID) -> Prospect | None:
        return (
            self.session.query(Prospect)
            .filter(
                Prospect.id == prospect_id,
                Prospect.user_id == user_id,
                Prospect.is_active,
            )
            .first()
        )

    def get_by_user(self, user_id: UUID) -> list[Prospect]:
        """Prospectos ativos, não convertidos e ainda em negociação (não
        reprovados). Quem foi marcado como "não captado" sai da listagem e
        passa a viver na Governança como Perdido, até voltar à negociação."""
        return (
            self.session.query(Prospect)
            .filter(
                Prospect.user_id == user_id,
                Prospect.is_active,
                Prospect.converted_client_id.is_(None),
                Prospect.reproved_at.is_(None),
            )
            .order_by(Prospect.name)
            .all()
        )

    def get_by_user_all(self, user_id: UUID) -> list[Prospect]:
        """Todos os prospectos ativos, incluindo os já convertidos (histórico)."""
        return (
            self.session.query(Prospect)
            .filter(Prospect.user_id == user_id, Prospect.is_active)
            .order_by(Prospect.name)
            .all()
        )

    def create(self, prospect_in: ProspectCreate, user_id: UUID) -> Prospect:
        prospect_data = prospect_in.model_dump()

        # Garante uma cor contrastante se não informada
        if not prospect_data.get("color"):
            import random

            palette = [
                "#3b82f6",
                "#8b5cf6",
                "#d946ef",
                "#f43f5e",
                "#06b6d4",
                "#10b981",
                "#6366f1",
            ]
            prospect_data["color"] = random.choice(palette)

        new_prospect = Prospect(**prospect_data, user_id=user_id)
        self.session.add(new_prospect)
        # `flush` antes do contato: o `id` é default Python e a empresa espelhada
        # nasce em `before_insert`, então ambos precisam existir. O commit é um
        # só, no fim — prospecto sem contato não deve sobrar pela metade.
        self.session.flush()
        _sync_representante_contact(self.session, new_prospect, prospect_data)
        self.session.commit()
        self.session.refresh(new_prospect)
        return new_prospect

    def update(self, prospect: Prospect, prospect_in: ProspectUpdate) -> Prospect:
        update_data = prospect_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(prospect, field, value)
        self.session.flush()
        _sync_representante_contact(self.session, prospect, update_data)
        self.session.commit()
        self.session.refresh(prospect)
        return prospect

    def delete(self, prospect: Prospect) -> None:
        prospect.is_active = False
        prospect.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    def mark_converted(self, prospect: Prospect, client_id: UUID) -> Prospect:
        from src.modules.clients.models import Client
        from src.modules.companies.sync import collapse_prospect_into_client

        converted_at = datetime.now(timezone.utc)
        prospect.converted_client_id = client_id
        prospect.converted_at = converted_at
        prospect.is_active = False
        prospect.deleted_at = converted_at
        # R2: o par vira uma empresa só. Os filhos (orçamentos, contratos) que
        # nasceram apontados para o prospecto acompanham a conversão — sem
        # isso, o contrato ficaria órfão no instante em que a empresa vira
        # cliente, que é justamente quando ele passa a valer.
        client = self.session.get(Client, client_id)
        if client is not None:
            collapse_prospect_into_client(self.session, prospect, client, converted_at)
        self.session.commit()
        self.session.refresh(prospect)
        return prospect

    def mark_reproved(self, prospect: Prospect) -> Prospect:
        """Marca o prospecto como não captado (reprovado). Flag binária:
        `reproved_at` preenchida = 1 (perdido); nula = ainda negociando."""
        reproved_at = datetime.now(timezone.utc)
        prospect.reproved_at = reproved_at
        _mirror_lifecycle(prospect, reproved_at=reproved_at)
        self.session.commit()
        self.session.refresh(prospect)
        return prospect

    def clear_reproved(self, prospect: Prospect) -> Prospect:
        """Desfaz a reprovação, voltando o prospecto à negociação."""
        prospect.reproved_at = None
        _mirror_lifecycle(prospect, reproved_at=None)
        self.session.commit()
        self.session.refresh(prospect)
        return prospect
