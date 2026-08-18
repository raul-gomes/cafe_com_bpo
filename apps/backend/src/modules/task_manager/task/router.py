from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.notifications.repository import NotificationRepository

from ..models import get_done_phase
from ..schemas import (
    ClientTimelineResponse,
    ConflictsResponse,
    SLAAlertsResponse,
    TaskCreate,
    TaskPhaseCreate,
    TaskPhaseReorder,
    TaskPhaseResponse,
    TaskPhaseUpdate,
    TaskResponse,
    TaskUpdate,
    TimelineResponse,
)
from ..sla.repository import SLARepository
from ..task.repository import TaskRepository
from ..task.service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_task_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> TaskRepository:
    return TaskRepository(session)


def get_task_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> TaskService:
    return TaskService(
        TaskRepository(session),
        sla_repo=SLARepository(session),
        notification_repo=NotificationRepository(session),
    )


RepoDep = Annotated[TaskRepository, Depends(get_task_repo)]
ServiceDep = Annotated[TaskService, Depends(get_task_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


# ── Task endpoints ──


@router.get("/", response_model=list[TaskResponse])
def get_tasks(
    repo: RepoDep,
    current_user: CurrentUserDep,
    session: Annotated[Session, Depends(get_db_session)],
    today: bool = False,
    overdue: bool = False,
    client_id: UUID | None = None,
):
    """Retorna as tarefas visíveis ao usuário atual.

    - Owner do cliente: vê todas as tarefas do cliente (dele e dos membros).
    - Membro da equipe: vê as próprias tarefas individuais mais as tarefas
      das rotinas (templates) que foram liberadas a ele no convite.
    """
    if client_id:
        from src.modules.team.repository import TeamRepository

        team_repo = TeamRepository(session)
        owner_id = team_repo.get_client_owner_id(client_id)
        is_owner = owner_id == current_user.id
        is_member = team_repo.is_team_member(client_id, current_user.id)

        if is_owner or is_member:
            if is_owner:
                user_ids = [current_user.id] + [
                    m.user_id
                    for m in team_repo.get_team_members(client_id)
                    if m.user_id != current_user.id
                ]

                all_tasks = []
                for uid in user_ids:
                    all_tasks.extend(
                        repo.get_by_user(
                            uid,
                            today_filter=today,
                            overdue_filter=overdue,
                        )
                    )
                all_tasks = [t for t in all_tasks if str(t.client_id) == str(client_id)]
                seen = set()
                unique = []
                for t in all_tasks:
                    if t.id not in seen:
                        seen.add(t.id)
                        unique.append(t)
                return unique

            # Membro: próprias tarefas + tarefas das rotinas liberadas
            granted = team_repo.get_routines_for_member(client_id, current_user.id)
            granted_template_ids = [r.id for r in granted]
            all_tasks = repo.get_tasks_for_member(
                current_user.id,
                granted_template_ids,
                today_filter=today,
                overdue_filter=overdue,
            )
            return [t for t in all_tasks if str(t.client_id) == str(client_id)]

    # ── Visão geral (sem client_id): agrega clientes do usuário ──
    from src.modules.clients.repository import ClientRepository
    from src.modules.team.repository import TeamRepository

    team_repo = TeamRepository(session)
    client_repo = ClientRepository(session)

    all_tasks: list = []
    seen: set = set()

    # 1) Clientes onde o usuário é OWNER → vê todas as tarefas (dele + membros)
    owned_clients = client_repo.get_by_user(current_user.id)
    for c in owned_clients:
        cid = c.id
        user_ids = [current_user.id] + [
            m.user_id
            for m in team_repo.get_team_members(cid)
            if m.user_id != current_user.id
        ]
        for uid in user_ids:
            for t in repo.get_by_user(uid, today_filter=today, overdue_filter=overdue):
                if str(t.client_id) == str(cid) and t.id not in seen:
                    seen.add(t.id)
                    all_tasks.append(t)

    # 2) Clientes onde o usuário é MEMBER → próprias + rotinas liberadas
    for cid in team_repo.get_team_client_ids(current_user.id):
        if any(str(c.id) == str(cid) for c in owned_clients):
            continue  # já tratado como owner
        granted = team_repo.get_routines_for_member(cid, current_user.id)
        granted_template_ids = [r.id for r in granted]
        for t in repo.get_tasks_for_member(
            current_user.id,
            granted_template_ids,
            today_filter=today,
            overdue_filter=overdue,
        ):
            if str(t.client_id) == str(cid) and t.id not in seen:
                seen.add(t.id)
                all_tasks.append(t)

    return sorted(
        all_tasks,
        key=lambda t: (
            t.deadline is None,
            t.deadline or datetime.min.replace(tzinfo=timezone.utc),
        ),
    )


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, service: ServiceDep, current_user: CurrentUserDep):
    """Cria uma nova tarefa para o usuário atual"""
    return service.create_task(task_in, current_user.id)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    repo: RepoDep,
    current_user: CurrentUserDep,
    session: Annotated[Session, Depends(get_db_session)],
):
    """Atualiza dados da tarefa."""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    old_phase_id = task.phase_id
    owner_id = None

    if task_in.phase_id is not None and task_in.phase_id != task.phase_id:
        from src.modules.team.repository import TeamRepository

        team_repo = TeamRepository(session)
        owner_id = team_repo.get_client_owner_id(task.client_id)
        phase_owner_id = owner_id or current_user.id

        gestor_phases = repo.get_phases_by_user(phase_owner_id)
        phase_ids = [str(p.id) for p in gestor_phases]

        if str(task_in.phase_id) not in phase_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "fase_inexistente",
                    "message": (
                        "Esta fase não existe para o gestor deste cliente. "
                        "Peça ao gestor para criar a fase primeiro."
                    ),
                },
            )

        task.moved_by = current_user.id

    updated_task = repo.update(task, task_in)

    # ── completed_at / status legado: usar as fases do gestor (owner) da task ──
    if task_in.phase_id is not None and task_in.phase_id != old_phase_id:
        phase_owner_id = owner_id or current_user.id
        phases = repo.get_phases_by_user(phase_owner_id)
        done_phase = get_done_phase(phases)
        new_phase = next(
            (p for p in phases if str(p.id) == str(task_in.phase_id)), None
        )
        if new_phase:
            # Moving to the done phase → set completed_at + status
            if done_phase and str(new_phase.id) == str(done_phase.id):
                updated_task.completed_at = datetime.now(timezone.utc)
                updated_task.status = "done"
            # Moving from the done phase to another → clear completed_at + sync status
            else:
                old_phase = next(
                    (p for p in phases if str(p.id) == str(old_phase_id)), None
                )
                if old_phase and done_phase and str(old_phase.id) == str(done_phase.id):
                    updated_task.completed_at = None
                sorted_phases = sorted(phases, key=lambda p: p.order)
                pos = next(
                    (
                        i
                        for i, p in enumerate(sorted_phases)
                        if str(p.id) == str(new_phase.id)
                    ),
                    0,
                )
                if pos == 0:
                    updated_task.status = "todo"
                else:
                    updated_task.status = "doing"

            repo.session.commit()
            repo.session.refresh(updated_task)

    return updated_task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, repo: RepoDep, current_user: CurrentUserDep):
    """Remove uma tarefa"""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    repo.delete(task)


@router.put("/{task_id}/cancel", response_model=TaskResponse)
def cancel_task(task_id: UUID, repo: RepoDep, current_user: CurrentUserDep):
    """Cancela uma tarefa (não remove, apenas marca como cancelada)"""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    cancelled_task = repo.cancel(task)
    log.info(f"📋 Tarefa cancelada: {task.title} por usuário {current_user.email}")
    return cancelled_task


# ── Phase endpoints ──


@router.get("/phases/", response_model=list[TaskPhaseResponse])
def get_phases(service: ServiceDep, current_user: CurrentUserDep):
    """Retorna as fases/colunas Kanban do usuário, criando padrões se necessário"""
    return service.get_phases(current_user.id)


@router.post(
    "/phases/", response_model=TaskPhaseResponse, status_code=status.HTTP_201_CREATED
)
def create_phase(
    phase_in: TaskPhaseCreate, service: ServiceDep, current_user: CurrentUserDep
):
    """Cria uma nova fase personalizada"""
    new_phase = service.create_phase(current_user.id, phase_in)
    log.info(f"📋 Fase criada: {phase_in.name} por usuário {current_user.email}")
    return new_phase


@router.put("/phases/{phase_id}", response_model=TaskPhaseResponse)
def update_phase(
    phase_id: UUID,
    phase_in: TaskPhaseUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza uma fase existente"""
    try:
        return service.update_phase(current_user.id, phase_id, phase_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="Fase não encontrada")


@router.delete("/phases/{phase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_phase(phase_id: UUID, service: ServiceDep, current_user: CurrentUserDep):
    """Remove uma fase e migra suas tarefas"""
    try:
        service.delete_phase(current_user.id, phase_id)
        log.info(f"🗑️ Fase excluída: {phase_id} por {current_user.email}")
    except ValueError as e:
        if "last remaining phase" in str(e):
            raise HTTPException(
                status_code=400, detail="Cannot delete the last remaining phase"
            )
        raise HTTPException(status_code=404, detail="Fase não encontrada")


@router.post("/phases/reorder")
def reorder_phases(
    phase_orders: TaskPhaseReorder, service: ServiceDep, current_user: CurrentUserDep
):
    """Reordena as fases do usuário"""
    return service.reorder_phases(current_user.id, phase_orders)


# ── Timeline endpoints ──


@router.get("/timeline/", response_model=TimelineResponse)
def get_timeline(
    service: ServiceDep,
    current_user: CurrentUserDep,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
):
    """Retorna timeline de tarefas agrupadas por data de prazo."""
    return service.get_timeline(current_user.id, start_date, end_date)


@router.get("/conflicts/", response_model=ConflictsResponse)
def get_conflicts(
    service: ServiceDep,
    current_user: CurrentUserDep,
    max_minutes: int = 480,
):
    """Detecta conflitos de agendamento onde minutos estimados excedem o limite."""
    return service.detect_conflicts(current_user.id, max_minutes)


# ── Client Timeline ──


@router.get("/client-timeline/{client_id}", response_model=ClientTimelineResponse)
def get_client_timeline(
    client_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep,
    month: str | None = None,
):
    """Retorna a timeline de tarefas de um cliente para um mês específico."""
    try:
        return service.get_client_timeline(client_id, current_user.id, month)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── SLA Alerts ──


@router.get("/alerts/sla", response_model=SLAAlertsResponse)
def get_sla_alerts(service: ServiceDep, current_user: CurrentUserDep):
    """Retorna alertas de SLA para o dashboard (tarefas atrasadas e próximas)."""
    return service.get_sla_alerts(current_user.id)


# ── Email ──


@router.post("/{task_id}/send-email")
def send_task_email(
    task_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep,
    subject: str = "",
    body: str = "",
    attachment_ids: list[UUID] = [],
):
    """Envia um email com anexos da tarefa para o cliente."""
    try:
        return service.send_task_email(
            task_id=task_id,
            user_id=current_user.id,
            subject=subject,
            body=body,
            attachment_ids=attachment_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
