"""
Task Module - Service Layer

Business logic for task CRUD, phases, timeline, conflicts, SLA alerts,
client timeline, and email sending.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.core.deadline import days_remaining
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.companies.models import Company
from src.modules.companies.repository import CompanyRepository
from src.modules.notifications.repository import NotificationRepository
from src.modules.notifications.schemas import NotificationCreate
from src.modules.team.repository import TeamRepository

from ..attachments.repository import AttachmentRepository
from ..models import get_done_phase
from ..schemas import (
    ClientTimelineResponse,
    ClientTimelineStats,
    ClientTimelineTask,
    ConflictResponse,
    ConflictsResponse,
    SLAAlert,
    SLAAlertsResponse,
    TaskCreate,
    TaskPhaseCreate,
    TaskPhaseReorder,
    TaskPhaseResponse,
    TaskPhaseUpdate,
    TaskResponse,
    TaskUpdate,
    TimelineDayResponse,
    TimelineResponse,
    TimelineTaskResponse,
)
from ..sla.repository import SLARepository
from ..task.repository import TaskRepository


class TaskService:
    """Service layer for task operations."""

    def __init__(
        self,
        repository: TaskRepository,
        companies: CompanyRepository,
        sla_repo: SLARepository | None = None,
        attachment_repo: AttachmentRepository | None = None,
        notification_repo: NotificationRepository | None = None,
    ):
        """Monta o serviço com o repositório de tarefas e a facade de empresas.

        `companies` é a `CompanyRepository` — a fonte única do vínculo e da
        posse (Fase 3, item 6). A checagem de posse mora aqui, e não no router:
        o id da rota é o do cliente, mas quem responde "esta empresa é sua" é a
        empresa, não a linha legada `clients`.
        """
        self.repository = repository
        self.companies = companies
        self.sla_repo = sla_repo or SLARepository(repository.session)
        self.attachment_repo = attachment_repo or AttachmentRepository(
            repository.session
        )
        self.notification_repo = notification_repo

    def _company(self, client_id: UUID) -> Company | None:
        """Empresa (estágio `client`) por trás do id da rota, ou `None`.

        Tarefa, SLA e rotina só existem para cliente — a garantia é do banco (FK
        composta). Esta leitura carrega a mesma premissa para o serviço, que
        responde "não encontrado" em vez de montar payload para uma empresa em
        prospecção.
        """
        return self.companies.get_client_by_id(client_id)

    def _owned_company(self, client_id: UUID, user_id: UUID) -> Company | None:
        """Empresa do usuário, ou `None` se não for dele.

        `CompanyRepository.get_by_id` não filtra por dono — é uma leitura de
        etapa, e quem pede é que sabe se a empresa é sua. O filtro do legado
        (`Client.user_id == user_id`) precisa ser reposto aqui, explicitamente,
        ou a troca de origem viraria escalada de privilégio.
        """
        company = self._company(client_id)
        if company is None or company.user_id != user_id:
            return None
        return company

    def _notify(
        self,
        user_id: UUID,
        title: str,
        message: str,
        notif_type: str,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
    ):
        """Send a notification if notification repo is available."""
        if self.notification_repo:
            self.notification_repo.create(
                NotificationCreate(
                    title=title,
                    message=message,
                    type=notif_type,
                    related_entity_type=entity_type,
                    related_entity_id=entity_id,
                ),
                user_id,
            )

    def get_user_tasks(
        self,
        user_id: UUID,
        process_type: str | None = None,
    ) -> list[TaskResponse]:
        """Get all tasks for a user with optional filters."""
        return self.repository.get_by_user(user_id, process_type_filter=process_type)

    def create_task(self, task_data: TaskCreate, user_id: UUID) -> TaskResponse:
        """Create a new task."""
        if task_data.phase_id is None:
            phases = self.get_phases()
            if phases:
                task_data.phase_id = phases[0].id
        new_task = self.repository.create(task_data, user_id)
        self._notify(
            user_id,
            "Nova tarefa criada",
            f"A tarefa '{new_task.title}' foi criada.",
            "task_assigned",
            "task",
            new_task.id,
        )
        return new_task

    def update_task(
        self, task_id: UUID, user_id: UUID, task_data: TaskUpdate
    ) -> TaskResponse:
        """Update an existing task."""
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found for user {user_id}")

        old_phase_id = task.phase_id
        old_deadline = task.deadline

        # Get phases for completed_at detection (fases globais)
        phases = self.repository.get_all_phases()
        done_phase = get_done_phase(phases)
        old_is_done = (
            old_phase_id is not None
            and done_phase is not None
            and str(old_phase_id) == str(done_phase.id)
        )

        updated_task = self.repository.update(task, task_data)

        # ── completed_at logic: moving to/from the done (final) phase ──
        if task_data.phase_id and task_data.phase_id != old_phase_id:
            new_phase = next(
                (p for p in phases if str(p.id) == str(task_data.phase_id)), None
            )
            if new_phase:
                self._notify(
                    user_id,
                    "Tarefa movida",
                    f"'{updated_task.title}' foi movida para '{new_phase.name}'.",
                    "phase_change",
                    "task",
                    updated_task.id,
                )

                # Moving to the done phase → set completed_at
                if done_phase and str(new_phase.id) == str(done_phase.id):
                    updated_task.completed_at = datetime.now(timezone.utc)
                # Moving from the done phase → clear completed_at
                elif old_is_done:
                    updated_task.completed_at = None

            self.repository.session.commit()
            self.repository.session.refresh(updated_task)

        if task_data.deadline and task_data.deadline != old_deadline:
            self._notify(
                user_id,
                "Prazo atualizado",
                f"O prazo de '{updated_task.title}' foi alterado.",
                "task_deadline",
                "task",
                updated_task.id,
            )

        return updated_task

    def delete_task(self, task_id: UUID, user_id: UUID) -> None:
        """Delete a task."""
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found for user {user_id}")
        self.repository.delete(task)

    # ── Phase operations ──

    def get_phases(self) -> list[TaskPhaseResponse]:
        """Get the 3 global canonical phases, normalizing leftovers."""
        return self.repository.ensure_canonical_phases()

    def create_phase(self, phase_data: TaskPhaseCreate) -> TaskPhaseResponse:
        """Custom phases are no longer allowed — only the 3 canonical ones."""
        raise ValueError("As fases são fixas: apenas as 3 fases padrão são permitidas")

    def update_phase(
        self, phase_id: UUID, phase_data: TaskPhaseUpdate
    ) -> TaskPhaseResponse:
        """Update an existing phase. Only name/color can change."""
        phase = self.repository.get_phase_by_id(phase_id)
        if not phase:
            raise ValueError(f"Phase {phase_id} not found")
        if phase_data.order is not None or phase_data.is_done is not None:
            raise ValueError("A ordem e a flag de conclusão das fases padrão são fixas")
        return self.repository.update_phase(phase, phase_data)

    def delete_phase(self, phase_id: UUID) -> None:
        """Canonical phases cannot be deleted."""
        raise ValueError("As fases padrão não podem ser excluídas")

    def reorder_phases(self, phase_orders: TaskPhaseReorder) -> list[TaskPhaseResponse]:
        """Canonical phases cannot be reordered."""
        raise ValueError("As fases padrão não podem ser reordenadas")

    # ── Timeline ──

    def get_timeline(
        self,
        user_id: UUID,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> TimelineResponse:
        """Get timeline view of tasks grouped by deadline date."""
        if start_date and end_date:
            tasks = self.repository.get_tasks_in_date_range(
                user_id, start_date, end_date
            )
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
            timeline[date_key].append(
                TimelineTaskResponse(
                    id=task.id,
                    title=task.title,
                    client_id=task.client_id,
                    deadline=task.deadline,
                    time_estimate_minutes=task.time_estimate_minutes,
                    priority=task.priority,
                    process_type=task.process_type,
                    phase=task.phase,
                )
            )

        timeline_days = []
        for date_str, day_tasks in sorted(timeline.items()):
            total_minutes = sum(t.time_estimate_minutes or 0 for t in day_tasks)
            timeline_days.append(
                TimelineDayResponse(
                    date=date_str,
                    tasks=day_tasks,
                    total_minutes=total_minutes,
                )
            )

        return TimelineResponse(timeline=timeline_days)

    def detect_conflicts(
        self, user_id: UUID, max_minutes_per_day: int = 480
    ) -> ConflictsResponse:
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
            total_minutes = sum(t.time_estimate_minutes or 0 for t in day_tasks)
            if total_minutes > max_minutes_per_day:
                conflicts.append(
                    ConflictResponse(
                        date=date_str,
                        tasks=[
                            {
                                "id": str(t.id),
                                "title": t.title,
                                "time_estimate_minutes": t.time_estimate_minutes,
                                "deadline": t.deadline.isoformat()
                                if t.deadline
                                else None,
                            }
                            for t in day_tasks
                        ],
                        total_minutes=total_minutes,
                    )
                )

        return ConflictsResponse(conflicts=conflicts)

    # ── SLA Alerts ──

    def get_sla_alerts(self, user_id: UUID) -> SLAAlertsResponse:
        """Alertas de SLA do painel, com o nome saindo da empresa.

        Os alertas são agrupados por empresa e o nome vem de `companies` (Fase 3,
        item 6). Como as tarefas consultadas já são do usuário, a posse vem junto
        no filtro de dono.
        """
        overdue_tasks = self.repository.get_tasks_overdue(user_id)
        warning_tasks = self.repository.get_tasks_near_deadline(user_id, days_ahead=2)

        # Group overdue by client
        overdue_by_client = {}
        for task in overdue_tasks:
            cid = str(task.client_id)
            if cid not in overdue_by_client:
                overdue_by_client[cid] = []
            overdue_by_client[cid].append(task)

        overdue_alerts = []
        for cid, tasks in overdue_by_client.items():
            company = self._owned_company(UUID(cid), user_id)
            client_name = company.name if company else "Cliente"
            # Dias de calendario, nao fracao de instante: `.days` de um
            # timedelta trunca em direcao a zero e reportava "0d em atraso" para
            # tarefas atrasadas ha poucas horas.
            total_days = sum(
                -(days_remaining(t.deadline) or 0) for t in tasks if t.deadline
            )
            overdue_alerts.append(
                SLAAlert(
                    type="overdue",
                    message=f"{len(tasks)} tarefa(s) atrasada(s) — {client_name} (Total: {total_days}d em atraso)",
                    count=len(tasks),
                    tasks=[
                        {"id": str(t.id), "title": t.title, "client_name": client_name}
                        for t in tasks
                    ],
                )
            )

        # Group warning by client
        warning_by_client = {}
        for task in warning_tasks:
            cid = str(task.client_id)
            if cid not in warning_by_client:
                warning_by_client[cid] = []
            warning_by_client[cid].append(task)

        warning_alerts = []
        for cid, tasks in warning_by_client.items():
            company = self._owned_company(UUID(cid), user_id)
            client_name = company.name if company else "Cliente"
            warning_alerts.append(
                SLAAlert(
                    type="warning",
                    message=f"{len(tasks)} tarefa(s) próxima(s) do vencimento — {client_name}",
                    count=len(tasks),
                    tasks=[
                        {"id": str(t.id), "title": t.title, "client_name": client_name}
                        for t in tasks
                    ],
                )
            )

        return SLAAlertsResponse(
            overdue=overdue_alerts,
            warning=warning_alerts,
            total_overdue=len(overdue_tasks),
            total_warning=len(warning_tasks),
        )

    # ── Client Timeline ──

    def get_client_timeline(
        self, client_id: UUID, user_id: UUID, month: str | None = None
    ) -> ClientTimelineResponse:
        """Timeline de tarefas de uma empresa, no mês, com o selo do SLA.

        A empresa vem de `companies` (Fase 3, item 6) e a posse é exigida: o
        id da rota é do cliente, e quem valida é o dono da empresa.
        """
        company = self._owned_company(client_id, user_id)
        if not company:
            raise ValueError(f"Client {client_id} not found")

        # Parse month or use current
        if month and len(month) == 7:
            year, mon = int(month.split("-")[0]), int(month.split("-")[1])
        else:
            now = datetime.now(timezone.utc)
            year, mon = now.year, now.month

        start_date = datetime(year, mon, 1, tzinfo=timezone.utc)
        if mon == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(
                seconds=1
            )
        else:
            end_date = datetime(year, mon + 1, 1, tzinfo=timezone.utc) - timedelta(
                seconds=1
            )

        tasks = self.repository.get_tasks_by_client_and_month(
            client_id, start_date, end_date
        )

        # Get SLA configs for this client
        slas = self.sla_repo.get_slas_by_client(client_id)
        sla_list = [
            {
                "process_type": s.process_type,
                "sla_days": s.sla_days,
                "warning_threshold": s.warning_threshold,
            }
            for s in slas
        ]

        stats = ClientTimelineStats()
        timeline_tasks = []

        for task in tasks:
            sla_status, days_used, days_limit = self._calculate_sla_status(task, slas)
            attachment_count = (
                len(task.attachments) if hasattr(task, "attachments") else 0
            )

            t = ClientTimelineTask(
                id=task.id,
                title=task.title,
                description=task.description,
                phase_id=task.phase_id,
                phase=task.phase,
                priority=task.priority,
                process_type=task.process_type,
                deadline=task.deadline,
                time_estimate_minutes=task.time_estimate_minutes,
                sla_status=sla_status,
                sla_days_used=int(days_used) if days_used is not None else None,
                sla_days_limit=days_limit,
                attachment_count=attachment_count,
                created_at=task.created_at,
                updated_at=task.updated_at,
            )
            timeline_tasks.append(t)

            # Update stats
            stats.total += 1
            if sla_status == "overdue":
                stats.overdue += 1
            elif sla_status == "warning":
                stats.warning += 1
            else:
                stats.on_time += 1

            if task.completed_at is not None:
                stats.completed += 1
            else:
                stats.in_progress += 1

        month_str = f"{year:04d}-{mon:02d}"
        return ClientTimelineResponse(
            client_id=client_id,
            client_name=company.name,
            client_email=getattr(company, "email", None),
            month=month_str,
            stats=stats,
            slas=sla_list,
            tasks=timeline_tasks,
        )

    def _calculate_sla_status(self, task, slas: list) -> tuple:
        """Calculate SLA status for a single task.
        Returns (sla_status: str, days_used: int, days_limit: int).
        """
        if not task.deadline:
            return "on_time", None, None

        # Check if task is in the done (final) phase
        is_done = False
        if task.phase_id:
            phases = self.repository.get_all_phases()
            done_phase = get_done_phase(phases)
            if done_phase and str(task.phase_id) == str(done_phase.id):
                is_done = True

        deadline = task.deadline

        # Find matching SLA
        sla_config = None
        if task.process_type:
            sla_config = self.sla_repo.get_sla_by_client_and_process(
                task.client_id, task.process_type
            )

        if not sla_config:
            return "on_time", None, None

        sla_limit = sla_config.sla_days
        warning_at = sla_limit * sla_config.warning_threshold

        if is_done:
            return "on_time", 0, sla_limit

        # Mesma regra da lista de tarefas: dias de calendario no fuso de negocio.
        # A conta anterior (`instante / 86400`) dava fracionario e marcava como
        # atrasada qualquer coisa que vence hoje antes do horario atual — o selo
        # e a lista discordavam na mesma tela.
        days_left = days_remaining(deadline) or 0
        days_used = sla_limit - days_left

        if days_left < 0:
            return "overdue", abs(days_left), sla_limit
        elif days_left <= (sla_limit - warning_at):
            return "warning", days_used, sla_limit
        else:
            return "on_time", days_used, sla_limit

    # ── Email Sending ──

    def send_task_email(
        self,
        task_id: UUID,
        user_id: UUID,
        subject: str,
        body: str,
        attachment_ids: list[UUID],
    ) -> dict:
        """Envia e-mail com os anexos da tarefa para o contato da empresa.

        O contato sai de `companies` (Fase 3, item 6). Sem e-mail cadastrado
        ali, a empresa não recebe a mensagem — o mesmo aviso de antes, agora
        dito em cima da fonte nova.
        """
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        # Contato da empresa dona da tarefa
        company = self._owned_company(task.client_id, user_id)
        if not company:
            raise ValueError(f"Client {task.client_id} not found")

        client_email = getattr(company, "email", None)
        if not client_email:
            raise ValueError(f"Client {task.client_id} has no email configured")

        # Get requested attachments
        attachments = []
        for att_id in attachment_ids:
            att = self.attachment_repo.get_attachment_by_id(att_id)
            if att and str(att.task_id) == str(task_id):
                attachments.append(att)

        # Send email
        success = self._send_email_resend(
            to_email=client_email,
            subject=subject or f"Entrega: {task.title}",
            body=body or f"Segue anexo referente à tarefa: {task.title}",
            attachments=attachments,
        )

        if not success:
            raise RuntimeError(
                "Falha ao enviar email. Verifique as configurações de SMTP."
            )

        # Mark attachments as sent
        sent_count = 0
        for att in attachments:
            self.attachment_repo.mark_attachment_sent(att)
            sent_count += 1

        # Create notification
        self._notify(
            user_id,
            "Email enviado",
            f"Arquivo(s) enviado(s) para {company.name} ({client_email})",
            "email_sent",
            "task",
            task_id,
        )

        log.info(f"📧 Email enviado para {client_email} — {len(attachments)} anexo(s)")

        return {
            "success": True,
            "to": client_email,
            "client_name": company.name,
            "attachments_sent": sent_count,
        }

    def _send_email_resend(
        self,
        to_email: str,
        subject: str,
        body: str,
        attachments: list,
    ) -> bool:
        """Send email via Resend. Returns True if successful."""
        import base64

        import resend

        from src.core.email import _get_api_key

        if not _get_api_key():
            log.warning("⚠️ Resend não configurado. Email não enviado.")
            return False

        try:
            resend.api_key = _get_api_key()

            send_attachments = []
            for att in attachments:
                try:
                    with open(att.file_path, "rb") as f:
                        content = f.read()
                        send_attachments.append(
                            {
                                "filename": att.file_name,
                                "content": base64.b64encode(content).decode(),
                            }
                        )
                except FileNotFoundError:
                    log.warning(f"Arquivo não encontrado: {att.file_path}")
                    continue

            params: dict = {
                "from": get_settings().resend_from_email,
                "to": [to_email],
                "subject": subject,
                "text": body,
            }
            if send_attachments:
                params["attachments"] = send_attachments

            resend.Emails.send(params)
            return True
        except Exception as e:
            log.error(f"❌ Falha ao enviar email: {e}")
            return False


def _client_id_for_invitation(session: Session, invitation_id: UUID) -> UUID | None:
    team_repo = TeamRepository(session)
    if invitation_id is None:
        return None
    invitation = team_repo.get_invitation_by_id(invitation_id)
    if invitation is None:
        return None
    return team_repo.get_client_id_by_team_id(invitation.team_id)


def _as_uuid(value) -> UUID | None:
    try:
        return UUID(value)
    except (TypeError, ValueError, AttributeError):
        return None


def _owns_client(session: Session, client_id: UUID, user_id: UUID) -> bool:
    """Diz se a empresa do id é do usuário — a checagem que protege o SSE.

    Filtra por dono na empresa (`companies`), e não na linha legada: é a mesma
    regra de `TaskService._owned_company`, no caminho do evento. Sem empresa
    ativa, o evento é de alguém que não existe mais e não é entregue.
    """
    company = CompanyRepository(session).get_client_by_id(client_id)
    if company is None:
        return False
    return company.user_id == user_id


def event_relevant_for_user(
    session: Session,
    current_user: UserResponse,
    channel: str,
    data: dict,
) -> bool:
    """Decide se um evento SSE deve ser entregue ao usuário conectado.

    Só eventos de clients que o usuário é dono (de todos) ou de times em que
    participa são relevantes. Eventos alheios são descartados no gerador SSE —
    a proteção cross-tenant fica no servidor, não no client.
    """
    if not isinstance(data, dict):
        return False

    team_repo = TeamRepository(session)

    if channel == "task_updates":
        client_id = _as_uuid(data.get("client_id"))
        template_id = _as_uuid(data.get("template_id"))
        if client_id is None:
            return False
        if _owns_client(session, client_id, current_user.id):
            return True
        if template_id is None:
            return False
        granted = [
            t.id for t in team_repo.get_routines_for_member(client_id, current_user.id)
        ]
        return template_id in granted

    if channel == "team_updates":
        event_type = data.get("type")
        if event_type == "routine_changed":
            client_id = _client_id_for_invitation(
                session, _as_uuid(data.get("invitation_id"))
            )
        else:
            team_id = _as_uuid(data.get("team_id"))
            client_id = team_repo.get_client_id_by_team_id(team_id) if team_id else None

        if client_id is None:
            return False
        if _owns_client(session, client_id, current_user.id):
            return True

        if event_type == "invitation_changed":
            invited = (data.get("invited_email") or "").strip().lower()
            if invited and invited == current_user.email.strip().lower():
                # O convidado precisa ver sua própria mudança de convite
                return True
        elif event_type == "member_changed":
            if str(data.get("user_id")) == str(current_user.id):
                # O próprio membro precisa ver a mudança na própria conta
                return True

        return team_repo.is_team_member(client_id, current_user.id)

    return False
