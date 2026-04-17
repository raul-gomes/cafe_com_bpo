from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from .models import Task
from .schemas import TaskCreate, TaskUpdate

class TaskRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, task_id: UUID, user_id: UUID) -> Optional[Task]:
        return self.session.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()

    def get_by_user(self, user_id: UUID) -> List[Task]:
        return self.session.query(Task).filter(
            Task.user_id == user_id, 
            Task.deleted_at.is_(None)
        ).order_by(Task.deadline.asc().nullslast()).all()

    def create(self, task_in: TaskCreate, user_id: UUID) -> Task:
        task_data = task_in.model_dump()
        new_task = Task(**task_data, user_id=user_id)
        self.session.add(new_task)
        self.session.commit()
        self.session.refresh(new_task)
        return new_task

    def update(self, task: Task, task_in: TaskUpdate) -> Task:
        update_data = task_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)
        self.session.commit()
        self.session.refresh(task)
        return task

    def delete(self, task: Task) -> None:
        task.deleted_at = datetime.now(timezone.utc)
        self.session.commit()
