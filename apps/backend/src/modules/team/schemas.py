from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class InviteCreate(BaseModel):
    emails: list[str]
    template_ids: list[UUID]


class InviteResult(BaseModel):
    email: str
    status: str
    invitation_id: UUID | None = None
    error: str | None = None


class InviteBatchResponse(BaseModel):
    results: list[InviteResult]
    total_sent: int
    total_errors: int


class RoutineAccess(BaseModel):
    """Rotina liberada a um membro, como o chip de rotina no card."""

    template_id: UUID
    name: str


class TeamMemberResponse(BaseModel):
    """Card de membro da equipe (regra §6 — só o que a tela renderiza).

    O card mostra avatar (iniciais de `name` ou `email`), nome, e-mail e os
    chips de rotina. Ficaram de fora `joined_at`, `role` e `is_active`: a
    listagem já vem filtrada por membro ativo e a tela não mostra data de
    entrada nem papel — a role é sempre `member` (o dono é o `clients.user_id`,
    não entra na lista).
    """

    user_id: UUID
    name: str | None = None
    email: str
    routines: list[RoutineAccess] = []


class TeamListResponse(BaseModel):
    members: list[TeamMemberResponse]


class InvitationResponse(BaseModel):
    """Card de "Convites enviados" (regra §6 — só o que a tela renderiza).

    O card mostra o e-mail, o status e as datas de expiração/aceite. Ficaram de
    fora `routines` (montado com duas queries por convite e nunca exibido) e
    `created_at` (a lista é ordenada por ele, mas a tela mostra a expiração).
    """

    invitation_id: UUID
    email: str
    status: str
    expires_at: datetime
    accepted_at: datetime | None = None


class InvitationListResponse(BaseModel):
    invitations: list[InvitationResponse]


class AcceptResponse(BaseModel):
    """Resposta do aceite de convite, lida pela tela de aceitar convite.

    `client_name` é o nome da empresa (vem de `companies`, fonte única do
    vínculo) e é o que a tela mostra no título antes e depois do aceite.
    """

    status: str
    client_name: str | None = None
    client_id: UUID | None = None
