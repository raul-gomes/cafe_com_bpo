from uuid import UUID

from sqlalchemy.orm import Session

from .models import COMPANY_TYPE_CLIENT, Company


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
