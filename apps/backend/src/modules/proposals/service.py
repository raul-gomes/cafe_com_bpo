"""
Proposals Module - Service Layer

Business logic for proposal management, PDF generation, and sharing.
"""

import math
from uuid import UUID

from src.core.config import get_settings
from src.core.email import EmailService
from src.modules.proposals.repository import PricingScenarioRepository
from src.modules.proposals.schemas import (
    ProposalCreate,
    ProposalResponse,
    ProposalUpdate,
)

settings = get_settings()


class ProposalService:
    """Service layer for proposal operations."""

    def __init__(self, repository: PricingScenarioRepository):
        self.repository = repository

    @staticmethod
    def _safe_float(value, default=0.0):
        """Convert value to float safely, returning default if NaN/None."""
        if value is None:
            return default
        try:
            val = float(value)
            return val if not math.isnan(val) else default
        except (ValueError, TypeError):
            return default

    @staticmethod
    def _sanitize_result_payload(result_payload: dict) -> dict:
        """Recursively replace NaN/None values with 0 in result_payload."""
        if not result_payload:
            return {}

        def sanitize_value(v):
            if v is None:
                return 0
            if isinstance(v, float) and math.isnan(v):
                return 0
            if isinstance(v, dict):
                return {k: sanitize_value(v) for k, v in v.items()}
            if isinstance(v, list):
                return [sanitize_value(item) for item in v]
            return v

        return sanitize_value(result_payload)

    def get_user_proposals(
        self, user_id: UUID, status: str | None = None
    ) -> list[ProposalResponse]:
        """Get all proposals for a user."""
        proposals = self.repository.get_by_user(user_id, status_filter=status)
        # Sanitize NaN values from result_payloads
        for proposal in proposals:
            if proposal.result_payload:
                proposal.result_payload = self._sanitize_result_payload(
                    proposal.result_payload
                )
        return proposals

    def get_proposal(self, proposal_id: UUID, user_id: UUID) -> ProposalResponse:
        """Get a specific proposal."""
        proposal = self.repository.get_scenario_by_id(
            user_id=user_id, scenario_id=proposal_id
        )
        if not proposal:
            raise ValueError(f"Proposal {proposal_id} not found")
        # Sanitize NaN values from result_payload
        if proposal.result_payload:
            proposal.result_payload = self._sanitize_result_payload(
                proposal.result_payload
            )
        return proposal

    def create_proposal(
        self, proposal_data: ProposalCreate, user_id: UUID
    ) -> ProposalResponse:
        """Create a new proposal."""
        if proposal_data.result_payload:
            proposal_data.result_payload = self._sanitize_result_payload(
                proposal_data.result_payload
            )
        return self.repository.create_scenario(
            user_id=user_id,
            client_name=proposal_data.client_name,
            input_payload=proposal_data.input_payload,
            result_payload=proposal_data.result_payload,
        )

    def update_proposal(
        self, proposal_id: UUID, user_id: UUID, proposal_data: ProposalUpdate
    ) -> ProposalResponse:
        """Update an existing proposal."""
        if proposal_data.result_payload:
            proposal_data.result_payload = self._sanitize_result_payload(
                proposal_data.result_payload
            )
        updated = self.repository.update_scenario(
            user_id=user_id,
            scenario_id=proposal_id,
            client_name=proposal_data.client_name,
            input_payload=proposal_data.input_payload,
            result_payload=proposal_data.result_payload,
        )
        if not updated:
            raise ValueError(f"Proposal {proposal_id} not found")
        return updated

    def delete_proposal(self, proposal_id: UUID, user_id: UUID) -> None:
        """Delete a proposal."""
        if not self.repository.delete_scenario(
            user_id=user_id, scenario_id=proposal_id
        ):
            raise ValueError(f"Proposal {proposal_id} not found")

    def get_pdf_download_url(self, proposal_id: UUID, user_id: UUID) -> str:
        """Get frontend URL for PDF download (PDF is generated client-side)."""
        return f"{settings.frontend_url}/proposta?id={proposal_id}"

    def send_email(
        self,
        proposal_id: UUID,
        user_id: UUID,
        recipient_email: str,
        client_name: str,
        message: str = "",
    ) -> bool:
        """Send proposal summary via email."""
        proposal = self.get_proposal(proposal_id, user_id)
        result = proposal.result_payload or {}
        final_price = self._safe_float(result.get("final_price", 0))

        price_str = (
            f"R$ {final_price:,.2f}".replace(",", "X")
            .replace(".", ",")
            .replace("X", ".")
        )

        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #1a1a2e;">Orçamento — Café com BPO</h2>
            <p>Olá,</p>
            <p>Segue o orçamento detalhado para <strong>{client_name}</strong>:</p>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0;"><strong>Valor Total: {price_str}</strong></p>
            </div>
            {f"<p>{message}</p>" if message else ""}
            <p>Para visualizar o documento completo com todos os detalhes dos serviços, 
            <a href="{settings.frontend_url}/proposta?id={proposal_id}">clique aqui</a>.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">
            <p style="font-size: 12px; color: #666;">Enviado via Café com BPO</p>
        </body>
        </html>
        """

        body_text = f"""
Orçamento Café com BPO

Cliente: {client_name}
Valor Total: R$ {final_price:,.2f}

{message}

Visualize o documento completo: {settings.frontend_url}/proposta?id={proposal_id}

Enviado via Café com BPO
        """.strip()

        try:
            EmailService.send_email(
                to_email=recipient_email,
                subject=f"Orçamento Café com BPO — {client_name}",
                text=body_text,
                html=body_html,
            )
            return True
        except Exception as e:
            raise RuntimeError(f"Falha ao enviar e-mail: {e!s}")

    def get_whatsapp_message(self, proposal_id: UUID, user_id: UUID) -> dict:
        """Generate WhatsApp share message for a proposal."""
        proposal = self.get_proposal(proposal_id, user_id)
        result = proposal.result_payload or {}
        final_price = self._safe_float(result.get("final_price", 0))
        price_str = (
            f"R$ {final_price:,.2f}".replace(",", "X")
            .replace(".", ",")
            .replace("X", ".")
        )

        text = (
            f"Olá! Segue o detalhamento do seu orçamento no Café com BPO.\n\n"
            f"*Cliente:* {proposal.client_name}\n"
            f"*Valor Total:* {price_str}\n\n"
            f"Para visualizar o documento completo com todos os detalhes dos serviços, "
            f"acesse: {settings.frontend_url}/proposta?id={proposal_id}"
        )

        return {
            "message": text,
            "url": f"https://wa.me/?text={__import__('urllib.parse').parse.quote(text)}",
        }
