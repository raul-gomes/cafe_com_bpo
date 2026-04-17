from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated, List
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from .schemas import TaskCreate, TaskUpdate, TaskResponse
from .repository import TaskRepository

router = APIRouter(prefix="/tasks", tags=["tasks"])

def get_task_repository(session: Annotated[Session, Depends(get_db_session)]) -> TaskRepository:
    return TaskRepository(session)

TaskRepoDep = Annotated[TaskRepository, Depends(get_task_repository)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]

@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    repo: TaskRepoDep,
    current_user: CurrentUserDep
):
    """Retorna tarefas cadastradas pelo usuário atual"""
    return repo.get_by_user(current_user.id)

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    repo: TaskRepoDep,
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
    repo: TaskRepoDep,
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
    repo: TaskRepoDep,
    current_user: CurrentUserDep
):
    """Remove uma tarefa"""
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    repo.delete(task)
    return None
