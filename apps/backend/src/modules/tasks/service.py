"""
Tasks Module - Service Layer

Business logic for task and routine management.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta

from src.modules.tasks.repository import TaskRepository
from src.modules.tasks.schemas import TaskCreate, TaskUpdate, TaskResponse, RoutineCreate, RoutineUpdate, RoutineResponse, TaskPhaseCreate, TaskPhaseUpdate, TaskPhaseReorder, TaskPhaseResponse, TaskAIAnalyzeInput, TaskAIAnalyzeResponse, TaskAISuggestResponse, TimelineResponse, TimelineDayResponse, TimelineTaskResponse, ConflictsResponse, ConflictResponse
from src.modules.notifications.repository import NotificationRepository
from src.modules.notifications.schemas import NotificationCreate
from src.modules.auth.schemas import UserResponse
from src.core.logger import log


class TaskService:
    """Service layer for task operations."""
    
    def __init__(self, repository: TaskRepository, notification_repo: Optional[NotificationRepository] = None):
        self.repository = repository
        self.notification_repo = notification_repo
    
    def _notify(self, user_id: UUID, title: str, message: str, notif_type: str, entity_type: Optional[str] = None, entity_id: Optional[UUID] = None):
        """Send a notification if notification repo is available."""
        if self.notification_repo:
            self.notification_repo.create(NotificationCreate(title=title, message=message, type=notif_type, related_entity_type=entity_type, related_entity_id=entity_id), user_id)
    
    def get_user_tasks(
        self, 
        user_id: UUID,
        status: Optional[str] = None,
        process_type: Optional[str] = None
    ) -> List[TaskResponse]:
        """Get all tasks for a user with optional filters."""
        return self.repository.get_by_user(
            user_id, 
            status_filter=status,
            process_type_filter=process_type
        )
    
    def create_task(self, task_data: TaskCreate, user_id: UUID) -> TaskResponse:
        """Create a new task."""
        new_task = self.repository.create(task_data, user_id)
        self._notify(user_id, "Nova tarefa criada", f"A tarefa '{new_task.title}' foi criada.", "task_assigned", "task", new_task.id)
        return new_task
    
    def update_task(
        self,
        task_id: UUID,
        user_id: UUID,
        task_data: TaskUpdate
    ) -> TaskResponse:
        """Update an existing task."""
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found for user {user_id}")
        
        old_phase_id = task.phase_id
        old_deadline = task.deadline
        
        updated_task = self.repository.update(task, task_data)
        
        if task_data.phase_id and task_data.phase_id != old_phase_id:
            phases = self.repository.get_phases_by_user(user_id)
            new_phase = next((p for p in phases if str(p.id) == str(task_data.phase_id)), None)
            if new_phase:
                self._notify(user_id, "Tarefa movida", f"'{updated_task.title}' foi movida para '{new_phase.name}'.", "phase_change", "task", updated_task.id)
        
        if task_data.deadline and task_data.deadline != old_deadline:
            self._notify(user_id, "Prazo atualizado", f"O prazo de '{updated_task.title}' foi alterado.", "task_deadline", "task", updated_task.id)
        
        return updated_task
    
    def delete_task(self, task_id: UUID, user_id: UUID) -> None:
        """Delete a task."""
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found for user {user_id}")
        self.repository.delete(task)
    
    def get_user_routines(self, user_id: UUID) -> List[RoutineResponse]:
        """Get all routines for a user."""
        return self.repository.get_routines_by_user(user_id)
    
    def get_routine(self, routine_id: UUID, user_id: UUID) -> Optional[RoutineResponse]:
        """Get a specific routine."""
        return self.repository.get_routine_by_id(routine_id, user_id)
    
    def create_routine(self, routine_data: RoutineCreate, user_id: UUID) -> RoutineResponse:
        """Create a new routine."""
        return self.repository.create_routine(routine_data, user_id)
    
    def update_routine(
        self,
        routine_id: UUID,
        user_id: UUID,
        routine_data: RoutineUpdate
    ) -> RoutineResponse:
        """Update an existing routine."""
        routine = self.repository.get_routine_by_id(routine_id, user_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found for user {user_id}")
        return self.repository.update_routine(routine, routine_data)
    
    def delete_routine(self, routine_id: UUID, user_id: UUID) -> None:
        """Delete a routine."""
        routine = self.repository.get_routine_by_id(routine_id, user_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found for user {user_id}")
        self.repository.delete_routine(routine)
    
    def _calculate_next_deadline(self, routine) -> Optional[datetime]:
        """Calculate the next deadline based on recurrence pattern."""
        now = datetime.now(timezone.utc)
        
        if routine.recurrence == "daily":
            next_date = now + timedelta(days=1)
        elif routine.recurrence == "weekly":
            if routine.day_of_week is not None:
                days_ahead = routine.day_of_week - now.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                next_date = now + timedelta(days=days_ahead)
            else:
                next_date = now + timedelta(weeks=1)
        elif routine.recurrence == "monthly":
            if routine.day_of_month is not None:
                next_date = now.replace(day=min(routine.day_of_month, 28)) + relativedelta(months=1)
            else:
                next_date = now + relativedelta(months=1)
        elif routine.recurrence == "yearly":
            next_date = now + relativedelta(years=1)
        else:
            return None
        
        if routine.deadline_time:
            try:
                hour, minute = map(int, routine.deadline_time.split(":"))
                next_date = next_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
            except (ValueError, AttributeError):
                next_date = next_date.replace(hour=9, minute=0, second=0, microsecond=0)
        else:
            next_date = next_date.replace(hour=9, minute=0, second=0, microsecond=0)
        
        return next_date
    
    def generate_recurring_tasks(self, routine_id: UUID) -> List[TaskResponse]:
        """Generate tasks from a recurring routine."""
        routine = self.repository.get_routine_by_id(routine_id, None)
        if not routine or not routine.is_active:
            return []
        
        next_deadline = self._calculate_next_deadline(routine)
        if not next_deadline:
            return []
        
        deadline = next_deadline - timedelta(days=routine.days_before_deadline)
        
        task_data = TaskCreate(
            title=routine.title,
            description=routine.description,
            client_id=routine.client_id,
            status="todo",
            priority=routine.priority,
            process_type=routine.process_type,
            deadline=deadline,
        )
        
        new_task = self.repository.create(task_data, routine.user_id)
        new_task.routine_id = routine.id
        self.repository.session.commit()
        self.repository.session.refresh(new_task)
        
        routine.last_generated = datetime.now(timezone.utc)
        self.repository.session.commit()
        
        log.info(f"🔄 Tarefa recorrente gerada da rotina '{routine.title}' | ID: {new_task.id}")
        
        return [new_task]
    
    def process_all_pending_routines(self) -> int:
        """Process all active routines and generate tasks where needed."""
        routines = self.repository.get_pending_routines()
        generated_count = 0
        
        for routine in routines:
            should_generate = False
            now = datetime.now(timezone.utc)
            
            if not routine.last_generated:
                should_generate = True
            else:
                if routine.recurrence == "daily":
                    should_generate = (now - routine.last_generated).days >= 1
                elif routine.recurrence == "weekly":
                    should_generate = (now - routine.last_generated).days >= 7
                elif routine.recurrence == "monthly":
                    should_generate = (now - routine.last_generated).days >= 28
                elif routine.recurrence == "yearly":
                    should_generate = (now - routine.last_generated).days >= 365
            
            if should_generate:
                self.generate_recurring_tasks(routine.id)
                generated_count += 1
        
        return generated_count

    def get_phases(self, user_id: UUID) -> List[TaskPhaseResponse]:
        """Get all phases for a user, creating defaults if none exist."""
        phases = self.repository.get_phases_by_user(user_id)
        if not phases:
            phases = self.repository.create_default_phases(user_id)
        return phases

    def create_phase(self, user_id: UUID, phase_data: TaskPhaseCreate) -> TaskPhaseResponse:
        """Create a new custom phase."""
        # Ensure default phases exist
        self.get_phases(user_id)
        return self.repository.create_phase(phase_data, user_id)

    def update_phase(self, user_id: UUID, phase_id: UUID, phase_data: TaskPhaseUpdate) -> TaskPhaseResponse:
        """Update an existing phase."""
        phase = self.repository.get_phase_by_id(phase_id, user_id)
        if not phase:
            raise ValueError(f"Phase {phase_id} not found for user {user_id}")
        return self.repository.update_phase(phase, phase_data)

    def delete_phase(self, user_id: UUID, phase_id: UUID) -> None:
        """Delete a phase and migrate its tasks to another phase."""
        phase = self.repository.get_phase_by_id(phase_id, user_id)
        if not phase:
            raise ValueError(f"Phase {phase_id} not found for user {user_id}")

        # Check if this is the last phase
        phase_count = self.repository.count_phases(user_id)
        if phase_count <= 1:
            raise ValueError("Cannot delete the last remaining phase")

        # Find a target phase to migrate tasks to
        phases = self.repository.get_phases_by_user(user_id)
        target_phase = next((p for p in phases if p.id != phase_id), None)
        if target_phase:
            self.repository.migrate_tasks_from_phase(phase_id, target_phase.id)

        self.repository.delete_phase(phase)

    def reorder_phases(self, user_id: UUID, phase_orders: TaskPhaseReorder) -> List[TaskPhaseResponse]:
        """Reorder phases based on the provided order."""
        from uuid import UUID as UUIDType
        for item in phase_orders.phases:
            phase_id = item["id"]
            if isinstance(phase_id, str):
                phase_id = UUIDType(phase_id)
            phase = self.repository.get_phase_by_id(phase_id, user_id)
            if phase:
                phase.order = item["order"]
        self.repository.session.commit()
        self.repository.session.flush()

        return self.repository.get_phases_by_user(user_id)

    async def analyze_task_with_ai(self, task_data: TaskAIAnalyzeInput) -> TaskAIAnalyzeResponse:
        """Use AI to analyze a task and suggest priority, process type, and deadline."""
        from src.modules.ai.llm_service import LLMService
        llm = LLMService()

        prompt = (
            f"Analise esta tarefa de BPO e sugira:\n"
            f"- Prioridade: low, medium, ou high\n"
            f"- Tipo de processo: fiscal, contabil, dp, financeiro, administrativo, ou null\n"
            f"- Prazo estimado em dias: numero inteiro ou null\n"
            f"- Raciocínio: explicação curta em português\n\n"
            f"Título: {task_data.title}\n"
            f"Descrição: {task_data.description or 'N/A'}\n"
            f"Tipo informado: {task_data.process_type or 'N/A'}"
        )

        result = await llm.generate_structured(
            prompt=prompt,
            schema_description='{"suggested_priority": "string (low|medium|high)", "suggested_process_type": "string or null", "estimated_deadline_days": "integer or null", "reasoning": "string"}'
        )

        if result:
            return TaskAIAnalyzeResponse(
                suggested_priority=result.get("suggested_priority", "medium"),
                suggested_process_type=result.get("suggested_process_type"),
                estimated_deadline_days=result.get("estimated_deadline_days"),
                reasoning=result.get("reasoning", ""),
            )

        return TaskAIAnalyzeResponse(
            suggested_priority="medium",
            suggested_process_type=task_data.process_type,
            estimated_deadline_days=None,
            reasoning="Não foi possível analisar com IA. Use valores padrão.",
        )

    async def get_ai_task_suggestions(self, user_id: UUID) -> TaskAISuggestResponse:
        """Get AI-powered task suggestions based on user's existing tasks and patterns."""
        from src.modules.ai.llm_service import LLMService
        from src.modules.clients.repository import ClientRepository

        tasks = self.repository.get_by_user(user_id)
        client_repo = ClientRepository(self.repository.session)
        clients = client_repo.get_by_user(user_id)

        task_context = "\n".join([f"- {t.title} ({t.process_type or 'sem tipo'}, {t.priority})" for t in tasks[:10]])
        client_context = "\n".join([f"- {c.name}" for c in clients[:5]]) if clients else "Nenhum cliente cadastrado"

        llm = LLMService()
        prompt = (
            f"Com base nas tarefas recentes e clientes deste usuário BPO, sugira 3 tarefas úteis.\n\n"
            f"TAREFAS RECENTES:\n{task_context or 'Nenhuma tarefa existente'}\n\n"
            f"CLIENTES:\n{client_context}\n\n"
            f"Retorne um array de 3 sugestões de tarefas com título, descrição curta, tipo de processo sugerido e prioridade."
        )

        result = await llm.generate_structured(
            prompt=prompt,
            schema_description='{"suggestions": [{"title": "string", "description": "string", "process_type": "string", "priority": "string (low|medium|high)"}]}'
        )

        if result and "suggestions" in result:
            return TaskAISuggestResponse(suggestions=result["suggestions"])

        return TaskAISuggestResponse(suggestions=[])

    def get_timeline(
        self,
        user_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> TimelineResponse:
        """Get timeline view of tasks grouped by deadline date."""
        if start_date and end_date:
            tasks = self.repository.get_tasks_in_date_range(user_id, start_date, end_date)
        else:
            tasks = self.repository.get_by_user(user_id)
            tasks = [t for t in tasks if t.deadline is not None]

        timeline = {}
        for task in tasks:
            if task.deadline is None:
                continue
            date_key = task.deadline.strftime("%Y-%m-%d")
            if date_key not in timeline:
                timeline[date_key] = []
            timeline[date_key].append(TimelineTaskResponse(
                id=task.id,
                title=task.title,
                client_id=task.client_id,
                deadline=task.deadline,
                time_estimate_hours=task.time_estimate_hours,
                priority=task.priority,
                process_type=task.process_type,
                status=task.status,
            ))

        timeline_days = []
        for date_str, day_tasks in sorted(timeline.items()):
            total_hours = sum(t.time_estimate_hours or 0 for t in day_tasks)
            timeline_days.append(TimelineDayResponse(
                date=date_str,
                tasks=day_tasks,
                total_hours=total_hours,
            ))

        return TimelineResponse(timeline=timeline_days)

    def detect_conflicts(self, user_id: UUID, max_hours_per_day: int = 8) -> ConflictsResponse:
        """Detect scheduling conflicts where total estimated hours exceed threshold."""
        tasks = self.repository.get_tasks_with_deadline(user_id)

        daily_load = {}
        for task in tasks:
            if task.deadline is None:
                continue
            date_key = task.deadline.strftime("%Y-%m-%d")
            if date_key not in daily_load:
                daily_load[date_key] = []
            daily_load[date_key].append(task)

        conflicts = []
        for date_str, day_tasks in sorted(daily_load.items()):
            total_hours = sum(t.time_estimate_hours or 0 for t in day_tasks)
            if total_hours > max_hours_per_day:
                conflicts.append(ConflictResponse(
                    date=date_str,
                    tasks=[{
                        "id": str(t.id),
                        "title": t.title,
                        "time_estimate_hours": t.time_estimate_hours,
                        "deadline": t.deadline.isoformat() if t.deadline else None,
                    } for t in day_tasks],
                    total_hours=total_hours,
                ))

        return ConflictsResponse(conflicts=conflicts)
