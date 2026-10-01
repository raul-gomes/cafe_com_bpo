from uuid import UUID

from sqlalchemy.orm import Session

from .models import COMPANY_TYPE_CLIENT, COMPANY_TYPE_PROSPECT, Company


class CompanyRepository:
    """Facade de leitura sobre `companies`.

    `clients` e `prospects` passam a ser vistas sobre esta tabela: a empresa é
    a linha única do negócio e a pairagem colapsa nela. Aqui mora só a
    **leitura** — a escrita continua nos módulos legados, com escrita dupla,
    até a remoção das colunas.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_by_type(
        self, user_id: UUID, company_type: str, *, search: str | None = None
    ) -> list[Company]:
        """Empresas ativas do usuário no estágio pedido, em ordem alfabética.

        `deleted_at` também entra no filtro: empresa arquivada é soft delete e
        precisa sair da listagem, mesmo com `is_active` ainda verdadeiro.
        """
        query = self.session.query(Company).filter(
            Company.user_id == user_id,
            Company.type == company_type,
            Company.is_active,
            Company.deleted_at.is_(None),
        )
        if search:
            query = query.filter(Company.name.ilike(f"%{search}%"))
        return query.order_by(Company.name).all()

    def list_clients(self, user_id: UUID) -> list[Company]:
        return self.list_by_type(user_id, COMPANY_TYPE_CLIENT)

    def list_open_prospects(self, user_id: UUID) -> list[Company]:
        """Empresas em prospecção ainda abertas, em ordem alfabética.

        Reproduz 1:1 o filtro do `ProspectRepository.get_by_user` legado: quem
        foi convertido vira cliente e quem foi marcado como não captado sai da
        listagem (passa a viver na Governança como Perdido, até voltar à
        negociação). As flags do ciclo de vida já são espelhadas em
        `companies` (`converted_at`/`reproved_at`), então o filtro migra
        inteiro sem consulta à tabela legada.
        """
        return (
            self.session.query(Company)
            .filter(
                Company.user_id == user_id,
                Company.type == COMPANY_TYPE_PROSPECT,
                Company.is_active,
                Company.deleted_at.is_(None),
                Company.converted_at.is_(None),
                Company.reproved_at.is_(None),
            )
            .order_by(Company.name)
            .all()
        )
