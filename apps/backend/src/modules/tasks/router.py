from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, Header
from typing import Annotated, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db_session
from src.core.logger import log
from src.core.config import get_settings
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.notifications.repository import NotificationRepository

from .schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskPhaseCreate,
    TaskPhaseUpdate,
    TaskPhaseReorder,
    TaskPhaseResponse,
    TimelineResponse,
    ConflictsResponse,
    ActivityTemplateCreate,
    ActivityTemplateUpdate,
    ActivityTemplateResponse,
    ActivityTemplateListItem,
    OverdueTemplateResponse,
    TemplateActivityCreate,
    TemplateActivityUpdate,
    TemplateActivityResponse,
    ClientTemplateAssignmentCreate,
    ClientTemplateAssignmentResponse,
    RoutineTypeCreate,
    RoutineTypeUpdate,
    RoutineTypeResponse,
    ClientSLACreate,
    ClientSLAUpdate,
    ClientSLAResponse,
    TaskAttachmentResponse,
    ClientTimelineResponse,
    SLAAlertsResponse,
)
from .repository import TaskRepository
from .service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_repo(session: Annotated[Session, Depends(get_db_session)]) -> TaskRepository:
    return TaskRepository(session)


def get_service(session: Annotated[Session, Depends(get_db_session)]) -> TaskService:
    return TaskService(TaskRepository(session), NotificationRepository(session))


RepoDep = Annotated[TaskRepository, Depends(get_repo)]
ServiceDep = Annotated[TaskService, Depends(get_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


# Task endpoints


@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    repo: RepoDep,
    current_user: CurrentUserDep,
    today: bool = False,
    overdue: bool = False,
):
    """Retorna tarefas cadastradas pelo usuário atual.

    Query params:
    - today: filtra apenas tarefas com deadline igual à data de hoje
    - overdue: filtra apenas tarefas com deadline anterior a hoje e não concluídas
    """
    return repo.get_by_user(
        current_user.id,
        today_filter=today,
        overdue_filter=overdue,
    )


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, repo: RepoDep, current_user: CurrentUserDep):
    """Cria uma nova tarefa para o usuário atual"""
    new_task = repo.create(task_in, current_user.id)
    log.info(f"📋 Tarefa criada: {task_in.title} por usuário {current_user.email}")
    return new_task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: UUID, task_in: TaskUpdate, repo: RepoDep, current_user: CurrentUserDep
):
    """Atualiza dados da tarefa"""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    updated_task = repo.update(task, task_in)
    return updated_task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, repo: RepoDep, current_user: CurrentUserDep):
    """Remove uma tarefa"""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    repo.delete(task)
    return None


@router.put("/{task_id}/cancel", response_model=TaskResponse)
def cancel_task(task_id: UUID, repo: RepoDep, current_user: CurrentUserDep):
    """Cancela uma tarefa (não remove, apenas marca como cancelada)"""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    cancelled_task = repo.cancel(task)
    log.info(f"📋 Tarefa cancelada: {task.title} por usuário {current_user.email}")
    return cancelled_task


# Phase endpoints


@router.get("/phases/", response_model=List[TaskPhaseResponse])
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
    return None


@router.post("/phases/reorder")
def reorder_phases(
    phase_orders: TaskPhaseReorder, service: ServiceDep, current_user: CurrentUserDep
):
    """Reordena as fases do usuário"""
    return service.reorder_phases(current_user.id, phase_orders)


# Timeline endpoints


@router.get("/timeline/", response_model=TimelineResponse)
def get_timeline(
    service: ServiceDep,
    current_user: CurrentUserDep,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
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


# ================================================================
# Activity Template Endpoints
# ================================================================


@router.get("/templates/", response_model=List[ActivityTemplateListItem])
def list_templates(service: ServiceDep, current_user: CurrentUserDep):
    """Lista todos os templates de atividades do usuário."""
    return service.get_templates(current_user.id)


@router.post(
    "/templates/",
    response_model=ActivityTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_template(
    template_in: ActivityTemplateCreate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Cria um novo template de atividades."""
    return service.create_template(template_in, current_user.id)


@router.get(
    "/templates/overdue/",
    response_model=List[OverdueTemplateResponse],
)
def list_overdue_templates(service: ServiceDep, current_user: CurrentUserDep):
    """Lista templates com due_date ou recurrence_end_date vencidos."""
    return service.get_overdue_templates(current_user.id)


@router.get("/templates/{template_id}", response_model=ActivityTemplateResponse)
def get_template(template_id: UUID, service: ServiceDep, current_user: CurrentUserDep):
    """Retorna um template com suas atividades."""
    result = service.get_template(template_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    return result


@router.put("/templates/{template_id}", response_model=ActivityTemplateResponse)
def update_template(
    template_id: UUID,
    template_in: ActivityTemplateUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza um template de atividades."""
    try:
        return service.update_template(template_id, current_user.id, template_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="Template não encontrado")


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: UUID, service: ServiceDep, current_user: CurrentUserDep
):
    """Remove um template de atividades."""
    try:
        service.delete_template(template_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    return None


# ── Template Activities (nested) ──


@router.post(
    "/templates/{template_id}/activities/",
    response_model=TemplateActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_activity(
    template_id: UUID,
    activity_in: TemplateActivityCreate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Adiciona uma atividade a um template."""
    try:
        return service.create_activity(template_id, current_user.id, activity_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="Template não encontrado")


@router.put(
    "/templates/{template_id}/activities/{activity_id}",
    response_model=TemplateActivityResponse,
)
def update_activity(
    template_id: UUID,
    activity_id: UUID,
    activity_in: TemplateActivityUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza uma atividade do template."""
    try:
        return service.update_activity(
            template_id, activity_id, current_user.id, activity_in
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete(
    "/templates/{template_id}/activities/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_activity(
    template_id: UUID,
    activity_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Remove uma atividade do template."""
    try:
        service.delete_activity(template_id, activity_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    return None


@router.post(
    "/templates/{template_id}/activities/reorder",
    response_model=List[TemplateActivityResponse],
)
def reorder_activities(
    template_id: UUID,
    ordered_ids: list[UUID],
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Reordena as atividades de um template."""
    try:
        return service.reorder_activities(template_id, current_user.id, ordered_ids)
    except ValueError:
        raise HTTPException(status_code=404, detail="Template não encontrado")


# ================================================================
# Client Template Assignment Endpoints
# ================================================================


@router.post("/client-templates/", status_code=status.HTTP_201_CREATED)
def assign_template(
    assignment_in: ClientTemplateAssignmentCreate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Vincula um template a um cliente e gera tarefas automaticamente."""
    try:
        result = service.assign_template_to_client(assignment_in, current_user.id)
        log.info(
            f"🚀 Template vinculado ao cliente {assignment_in.client_id} por {current_user.email}"
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/client-templates/", response_model=List[ClientTemplateAssignmentResponse])
def list_client_assignments(
    client_id: UUID, service: ServiceDep, current_user: CurrentUserDep
):
    """Lista os templates vinculados a um cliente."""
    return service.get_client_assignments(client_id)


@router.delete(
    "/client-templates/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_client_assignment(
    assignment_id: UUID, service: ServiceDep, current_user: CurrentUserDep
):
    """Remove o vínculo de um template com um cliente."""
    try:
        service.remove_client_assignment(assignment_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado")
    return None


@router.post("/client-templates/{assignment_id}/regenerate")
def regenerate_client_tasks(
    assignment_id: UUID, service: ServiceDep, current_user: CurrentUserDep
):
    """Regenera tarefas para o próximo período de um vínculo."""
    try:
        return service.regenerate_client_tasks(assignment_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/scheduler/run")
def run_scheduler(service: ServiceDep, current_user: CurrentUserDep):
    """Executa o scheduler de rotinas — gera tarefas pendentes com base na recorrência."""
    result = service.run_scheduler(user_id=current_user.id)
    return result


@router.post("/scheduler/cron")
def run_scheduler_cron(
    service: ServiceDep,
    x_cron_secret: Annotated[str, Header(alias="x-cron-secret")] = "",
):
    """Executa o scheduler para TODOS os usuários (chamado por cron job).

    Protegido pelo header X-Cron-Secret que deve bater com CRON_SECRET no .env.
    """
    settings = get_settings()
    if not settings.cron_secret:
        raise HTTPException(
            status_code=501,
            detail="Endpoint de cron não configurado. Defina CRON_SECRET no .env.",
        )
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(
            status_code=401,
            detail="X-Cron-Secret inválido.",
        )
    result = service.run_scheduler()
    return result


@router.post("/scheduler/pre-generate")
def run_scheduler_pre_generate(
    service: ServiceDep,
    x_cron_secret: Annotated[str, Header(alias="x-cron-secret")] = "",
):
    """Pré-gera tarefas do mês seguinte para rotinas semanais, mensais e anuais.

    Deve ser chamado por cron job no último dia útil de cada mês.
    Protegido pelo header X-Cron-Secret que deve bater com CRON_SECRET no .env.
    """
    settings = get_settings()
    if not settings.cron_secret:
        raise HTTPException(
            status_code=501,
            detail="Endpoint de cron não configurado. Defina CRON_SECRET no .env.",
        )
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(
            status_code=401,
            detail="X-Cron-Secret inválido.",
        )
    result = service.run_pre_generate_for_next_month()
    return result


# ================================================================
# RoutineType Endpoints
# ================================================================


@router.get("/routine-types/", response_model=List[RoutineTypeResponse])
def list_routine_types(service: ServiceDep, current_user: CurrentUserDep):
    """Lista os tipos de rotina do usuário."""
    return service.list_routine_types(current_user.id)


@router.post(
    "/routine-types/",
    response_model=RoutineTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_routine_type(
    data: RoutineTypeCreate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Cria um novo tipo de rotina."""
    return service.create_routine_type(current_user.id, data)


@router.put("/routine-types/{type_id}", response_model=RoutineTypeResponse)
def update_routine_type(
    type_id: UUID,
    data: RoutineTypeUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza um tipo de rotina."""
    try:
        return service.update_routine_type(type_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/routine-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine_type(
    type_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Remove um tipo de rotina (desvincula dos templates)."""
    try:
        service.delete_routine_type(type_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ================================================================
# SLA Endpoints
# ================================================================


@router.get("/sla/", response_model=List[ClientSLAResponse])
def list_client_slas(
    client_id: UUID, service: ServiceDep, current_user: CurrentUserDep
):
    """Lista as configurações de SLA de um cliente."""
    return service.get_client_slas(client_id)


@router.post(
    "/sla/", response_model=ClientSLAResponse, status_code=status.HTTP_201_CREATED
)
def create_sla(
    sla_in: ClientSLACreate, service: ServiceDep, current_user: CurrentUserDep
):
    """Cria configuração de SLA para um cliente."""
    return service.create_sla(sla_in, current_user.id)


@router.put("/sla/{sla_id}", response_model=ClientSLAResponse)
def update_sla(
    sla_id: UUID,
    sla_in: ClientSLAUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza configuração de SLA."""
    try:
        return service.update_sla(sla_id, current_user.id, sla_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="SLA não encontrado")


@router.delete("/sla/{sla_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sla(sla_id: UUID, service: ServiceDep, current_user: CurrentUserDep):
    """Remove configuração de SLA."""
    try:
        service.delete_sla(sla_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="SLA não encontrado")
    return None


# ================================================================
# Client Timeline Endpoint
# ================================================================


@router.get("/client-timeline/{client_id}", response_model=ClientTimelineResponse)
def get_client_timeline(
    client_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep,
    month: Optional[str] = None,
):
    """Retorna a timeline de tarefas de um cliente para um mês específico."""
    try:
        return service.get_client_timeline(client_id, current_user.id, month)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ================================================================
# Task Attachment Endpoints
# ================================================================


@router.post(
    "/{task_id}/attachments/",
    response_model=TaskAttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    task_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep,
    file: UploadFile,
):
    """Faz upload de arquivo como anexo de tarefa."""
    import os

    # Ensure storage directory exists
    storage_dir = "storage/tasks"
    os.makedirs(storage_dir, exist_ok=True)

    # Generate unique filename
    ext = os.path.splitext(file.filename or "file")[1] if file.filename else ""
    import uuid as uuid_gen

    safe_name = f"{uuid_gen.uuid4().hex}{ext}"
    file_path = os.path.join(storage_dir, safe_name)

    # Save file synchronously inside async def via thread
    file_size = 0
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
            file_size = len(content)
    except Exception:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail="Erro ao salvar arquivo")

    try:
        att = service.upload_attachment(
            task_id=task_id,
            user_id=current_user.id,
            file_name=file.filename or "unknown",
            file_path=file_path,
            file_size=file_size,
            content_type=file.content_type,
        )
        return att
    except ValueError as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{task_id}/attachments/", response_model=List[TaskAttachmentResponse])
def list_attachments(task_id: UUID, service: ServiceDep, current_user: CurrentUserDep):
    """Lista os anexos de uma tarefa."""
    try:
        return service.get_task_attachments(task_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")


@router.delete(
    "/{task_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_attachment(
    task_id: UUID,
    attachment_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Remove um anexo de uma tarefa."""
    try:
        service.delete_attachment(attachment_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return None


# ================================================================
# Email Endpoint
# ================================================================


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


# ================================================================
# Dashboard SLA Alerts
# ================================================================


@router.get("/alerts/sla", response_model=SLAAlertsResponse)
def get_sla_alerts(service: ServiceDep, current_user: CurrentUserDep):
    """Retorna alertas de SLA para o dashboard (tarefas atrasadas e próximas)."""
    return service.get_sla_alerts(current_user.id)
