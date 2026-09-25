from uuid import UUID

from src.modules.clients.schemas import ClientCreate
from src.modules.prospects.repository import ProspectRepository
from src.modules.prospects.schemas import ProspectConvertResponse


class ProspectService:
    """Service layer for prospect operations."""

    def __init__(self, repository: ProspectRepository):
        self.repository = repository

    def get_user_prospects(self, user_id: UUID) -> list:
        """Prospectos ativos e não convertidos do usuário."""
        return self.repository.get_by_user(user_id)

    def create_prospect(self, prospect_data, user_id: UUID):
        return self.repository.create(prospect_data, user_id)

    def update_prospect(self, prospect_id: UUID, user_id: UUID, prospect_data):
        prospect = self.repository.get_by_id(prospect_id, user_id)
        if not prospect:
            raise ValueError(f"Prospect {prospect_id} not found for user {user_id}")
        return self.repository.update(prospect, prospect_data)

    def delete_prospect(
        self,
        prospect_id: UUID,
        user_id: UUID,
        proposal_repo,
        contract_repo,
    ) -> None:
        """Arquiva (soft delete) o prospecto e oculta tudo o que está
        vinculado a ele para este usuário: orçamentos e contratos. O link
        público de um orçamento vinculado também deixa de valer."""
        prospect = self.repository.get_by_id(prospect_id, user_id)
        if not prospect:
            raise ValueError(f"Prospect {prospect_id} not found for user {user_id}")
        self.repository.delete(prospect)
        proposal_repo.delete_by_prospect(user_id, prospect_id)
        contract_repo.delete_by_prospect(user_id, prospect_id)

    def convert_prospect(
        self,
        prospect_id: UUID,
        user_id: UUID,
        client_repo,
    ) -> ProspectConvertResponse:
        """Converte um prospecto ativo em Cliente (cadastro simples, sem time/rotinas).

        O prospecto sai da listagem ativa de prospectos e o Cliente criado carrega
        os mesmos dados cadastrais. É a única fonte da regra de conversão — quando o
        módulo de Contratos existir, `finalizar_contrato` chamará este mesmo service.
        """
        prospect = self.repository.get_by_id(prospect_id, user_id)
        if not prospect:
            raise ValueError(f"Prospect {prospect_id} not found or already converted")

        client_in = ClientCreate(
            name=prospect.name,
            cnpj=prospect.cnpj,
            phone=prospect.phone,
            email=prospect.email,
            color=prospect.color,
            description=prospect.description,
            segment=prospect.segment,
            street=prospect.street,
            number=prospect.number,
            complement=prospect.complement,
            neighborhood=prospect.neighborhood,
            city=prospect.city,
            state=prospect.state,
            cep=prospect.cep,
        )
        new_client = client_repo.create(client_in, user_id)

        self.repository.mark_converted(prospect, new_client.id)

        return ProspectConvertResponse(
            prospect_id=prospect.id,
            client_id=new_client.id,
        )
