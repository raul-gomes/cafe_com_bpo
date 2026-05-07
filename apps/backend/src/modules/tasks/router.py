from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.notifications.repository import NotificationRepository

from .schemas import TaskCreate, TaskUpdate, TaskResponse, RoutineCreate, RoutineUpdate, RoutineResponse, TaskPhaseCreate, TaskPhaseUpdate, TaskPhaseReorder, TaskPhaseResponse, TaskAIAnalyzeInput, TaskAIAnalyzeResponse, TaskAISuggestResponse, TimelineResponse, ConflictsResponse
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
    current_user: CurrentUserDep
):
    """Retorna tarefas cadastradas pelo usuário atual"""
    return repo.get_by_user(current_user.id)

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    repo: RepoDep,
    current_user: CurrentUserDep
):
    """Cria uma nova tarefa para o usuário atual"""
    new_task = repo.create(task_in, current_user.id)
    log.info(f"📋 Tarefa criada: {task_in.title} por usuário {current_user.email}")
    return new_task

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    repo: RepoDep,
    current_user: CurrentUserDep
):
    """Atualiza dados da tarefa"""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    updated_task = repo.update(task, task_in)
    return updated_task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep
):
    """Remove uma tarefa"""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    repo.delete(task)
    return None


# Routine endpoints

@router.get("/rotinas", response_model=List[RoutineResponse])
def get_routines(
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Retorna rotinas do usuário atual"""
    return service.get_user_routines(current_user.id)

@router.post("/rotinas", response_model=RoutineResponse, status_code=status.HTTP_201_CREATED)
def create_routine(
    routine_in: RoutineCreate,
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Cria uma nova rotina recorrente"""
    new_routine = service.create_routine(routine_in, current_user.id)
    log.info(f"🔄 Rotina criada: {routine_in.title} por usuário {current_user.email}")
    return new_routine

@router.put("/rotinas/{routine_id}", response_model=RoutineResponse)
def update_routine(
    routine_id: UUID,
    routine_in: RoutineUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Atualiza uma rotina"""
    try:
        return service.update_routine(routine_id, current_user.id, routine_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")

@router.delete("/rotinas/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine(
    routine_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Remove uma rotina"""
    try:
        service.delete_routine(routine_id, current_user.id)
        log.info(f"🗑️ Rotina excluída: {routine_id} por {current_user.email}")
    except ValueError:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")

@router.post("/rotinas/{routine_id}/generate", response_model=List[TaskResponse])
def generate_tasks_from_routine(
    routine_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Gera tarefas manualmente a partir de uma rotina"""
    routine = service.get_routine(routine_id, current_user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")
    
    tasks = service.generate_recurring_tasks(routine_id)
    return tasks

@router.post("/rotinas/process-all")
def process_all_routines(
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Processa todas as rotinas pendentes e gera tarefas"""
    count = service.process_all_pending_routines()
    return {"tasks_generated": count}


# Phase endpoints

@router.get("/phases/", response_model=List[TaskPhaseResponse])
def get_phases(
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Retorna as fases/colunas Kanban do usuário, criando padrões se necessário"""
    return service.get_phases(current_user.id)

@router.post("/phases/", response_model=TaskPhaseResponse, status_code=status.HTTP_201_CREATED)
def create_phase(
    phase_in: TaskPhaseCreate,
    service: ServiceDep,
    current_user: CurrentUserDep
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
    current_user: CurrentUserDep
):
    """Atualiza uma fase existente"""
    try:
        return service.update_phase(current_user.id, phase_id, phase_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="Fase não encontrada")

@router.delete("/phases/{phase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_phase(
    phase_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Remove uma fase e migra suas tarefas"""
    try:
        service.delete_phase(current_user.id, phase_id)
        log.info(f"🗑️ Fase excluída: {phase_id} por {current_user.email}")
    except ValueError as e:
        if "last remaining phase" in str(e):
            raise HTTPException(status_code=400, detail="Cannot delete the last remaining phase")
        raise HTTPException(status_code=404, detail="Fase não encontrada")
    return None

@router.post("/phases/reorder")
def reorder_phases(
    phase_orders: TaskPhaseReorder,
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Reordena as fases do usuário"""
    return service.reorder_phases(current_user.id, phase_orders)


# AI endpoints

@router.post("/ai/analyze", response_model=TaskAIAnalyzeResponse)
async def analyze_task(
    task_data: TaskAIAnalyzeInput,
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Analisa uma tarefa com IA e sugere prioridade, tipo e prazo."""
    return await service.analyze_task_with_ai(task_data)

@router.get("/ai/suggestions", response_model=TaskAISuggestResponse)
async def get_task_suggestions(
    service: ServiceDep,
    current_user: CurrentUserDep
):
    """Recebe sugestões de tarefas baseadas no histórico do usuário."""
    return await service.get_ai_task_suggestions(current_user.id)


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
    max_hours: int = 8,
):
    """Detecta conflitos de agendamento onde horas estimadas excedem o limite."""
    return service.detect_conflicts(current_user.id, max_hours)
