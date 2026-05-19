# Client-Centric Task Manager — Design Spec

## Overview

Evolução do módulo de tarefas existente para um sistema de gestão de entregas
focado em BPO, com templates de atividades recorrentes, timeline por cliente,
controle de SLA, anexos e envio de arquivos por email.

**Público**: interno (BPO) — sem portal do cliente nesta fase.

## Architecture

### New Models

```python
ActivityTemplate(Base):
    """Pacote de serviços recorrentes (ex: 'Fiscal Mensal')"""
    __tablename__ = "activity_templates"

    id: UUID (PK)
    user_id: UUID (FK → users)
    name: str(100)            # "Fiscal Mensal"
    description: Text         # opcional
    process_type: str(50)     # fiscal, contabil, dp, financeiro
    recurrence: str(50)       # monthly, quarterly, yearly
    is_active: bool           # default true
    created_at, updated_at


TemplateActivity(Base):
    """Cada atividade DENTRO de um template"""
    __tablename__ = "template_activities"

    id: UUID (PK)
    template_id: UUID (FK → activity_templates, CASCADE)
    name: str(255)            # "Apuração de tributos"
    description: Text         # opcional
    due_day: int              # dia do mês (1-31)
    estimated_hours: int      # horas estimadas
    order: int                # ordenação
    phase_id: UUID (FK → task_phases, SET NULL)  # fase inicial sugerida


ClientTemplateAssignment(Base):
    """Liga um cliente a um template"""
    __tablename__ = "client_template_assignments"

    id: UUID (PK)
    client_id: UUID (FK → clients, CASCADE)
    template_id: UUID (FK → activity_templates, CASCADE)
    user_id: UUID (FK → users)
    start_date: DateTime       # quando começa a gerar tarefas
    is_active: bool            # default true
    created_at


ClientSLA(Base):
    """SLA por cliente + tipo de processo"""
    __tablename__ = "client_slas"

    id: UUID (PK)
    client_id: UUID (FK → clients, CASCADE)
    process_type: str(50)      # fiscal, contabil, dp, etc.
    sla_days: int              # dias úteis para executar
    warning_threshold: float   # 0.8 = alerta com 80% do prazo
    created_at, updated_at


TaskAttachment(Base):
    """Arquivos anexados a uma tarefa"""
    __tablename__ = "task_attachments"

    id: UUID (PK)
    task_id: UUID (FK → tasks, CASCADE)
    file_name: str(255)
    file_path: str(500)        # caminho no storage
    file_size: int             # bytes
    content_type: str(100)     # MIME type
    uploaded_by: UUID (FK → users)
    sent_to_client: bool       # default false
    sent_at: DateTime          # nullable
    created_at
```

### Changes to Existing Models

- **Task**: adicionar coluna `sla_status` (computed/virtual, ou calculado em
  tempo real): `on_time | warning | overdue`
- **Task**: relacionamento com `TaskAttachment`

### New Tables

| Table | Purpose |
|-------|---------|
| `activity_templates` | Pacotes de serviços |
| `template_activities` | Atividades dentro de cada pacote |
| `client_template_assignments` | Vínculo cliente → template |
| `client_slas` | SLA por cliente + processo |
| `task_attachments` | Arquivos anexados às tarefas |

## API Endpoints

All endpoints under `/tasks/`, module `tasks`.

### Activity Templates CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/templates/` | List templates (by user) |
| POST | `/tasks/templates/` | Create template |
| GET | `/tasks/templates/{id}` | Get template + activities |
| PUT | `/tasks/templates/{id}` | Update template |
| DELETE | `/tasks/templates/{id}` | Soft delete |
| POST | `/tasks/templates/{id}/activities/` | Add activity |
| PUT | `/tasks/templates/{id}/activities/{act_id}` | Update activity |
| DELETE | `/tasks/templates/{id}/activities/{act_id}` | Remove activity |
| POST | `/tasks/templates/{id}/activities/reorder` | Reorder activities |

### Client Template Assignment

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tasks/client-templates/` | Assign template → auto-generate tasks |
| GET | `/tasks/client-templates/?client_id=X` | List assignments |
| DELETE | `/tasks/client-templates/{id}` | Unlink template |
| POST | `/tasks/client-templates/{id}/regenerate` | Force regenerate for next period |

### SLA

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/sla/?client_id=X` | Get SLA configs for client |
| POST | `/tasks/sla/` | Create SLA config |
| PUT | `/tasks/sla/{id}` | Update SLA config |
| DELETE | `/tasks/sla/{id}` | Delete SLA config |

### Client Timeline

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/client-timeline/{client_id}?month=2026-05` | All tasks + SLA status |

### Attachments & Email

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tasks/{task_id}/attachments/` | Upload file |
| GET | `/tasks/{task_id}/attachments/` | List attachments |
| DELETE | `/tasks/{task_id}/attachments/{att_id}` | Delete attachment |
| POST | `/tasks/{task_id}/send-email` | Send email with attachments |

## Core Flows

### Flow 1: Auto-generation on Client Onboarding

```
POST /tasks/client-templates/ { client_id, template_id, start_date }
  ↓
1. Busca template + template_activities (ordered by order)
2. For each TemplateActivity:
   - Calculate deadline: due_day of current/next month
   - Create Task with:
     - title, description from TemplateActivity
     - client_id from assignment
     - user_id = current user
     - deadline = calculated date
     - time_estimate_hours = estimated_hours
     - phase_id = "A Fazer" (default)
     - priority = medium
     - process_type from template
3. Return created tasks
```

### Flow 2: Periodic Regeneration

```
Scheduled job OR manual trigger (regenerate):
  ↓
1. Get all active ClientTemplateAssignments
2. For each, check if tasks for the upcoming period exist
3. If not, generate as Flow 1
4. Uses logic similar to existing Routine system
```

### Flow 3: SLA Calculation

```
On GET /tasks/client-timeline/{client_id}?month=X:
  ↓
1. Fetch all tasks for client in that month
2. For each task, find matching ClientSLA (client_id + task.process_type)
3. Calculate days_used = deadline - completed_at (or today if not done)
4. Determine sla_status:
   - completed_before_deadline? → "on_time" (green)
   - days_used <= sla_days * warning_threshold? → "on_time"
   - days_used <= sla_days? → "warning" (yellow)
   - days_used > sla_days? → "overdue" (red)
5. Return enriched data with sla_status, stats
```

### Flow 4: Dashboard Alerts

```
On GET /dashboard/ (existing endpoint):
  ↓
1. Query tasks where deadline is within warning_threshold (warning)
2. Query tasks where deadline is past (overdue)
3. Group by client, count
4. Return alerts data for homepage + notification creation
```

### Flow 5: Email Sending

```
POST /tasks/{task_id}/send-email { subject, body, attachment_ids[] }
  ↓
1. Get task with client info (name, email)
2. Get requested attachments
3. Send via SMTP (config in env)
4. Mark attachments as sent_to_client = true
5. Create notification log
```

## Frontend UI

### New Routes (protected, under `/painel`)

| Route | Page | Description |
|-------|------|-------------|
| `/painel/templates-atividades` | TemplateListPage | List/Create/Edit templates |
| `/painel/templates-atividades/:id` | TemplateDetailPage | Detail + activities management |
| `/painel/clientes/:id/timeline` | ClientTimelinePage | Per-client delivery timeline |

### Changes to Existing Routes

- **Dashboard (`/painel`)**: Add SLA alerts section showing overdue/near-deadline tasks
- **Client detail page**: Add link to timeline
- **Task detail/modal**: Add attachments section + email button

### Key UI Components

| Component | Location | Description |
|-----------|----------|-------------|
| `TemplateCard` | `components/tasks/` | Card for template list |
| `TemplateActivityRow` | `components/tasks/` | Editable activity row (due_day, hours) |
| `ClientTimeline` | `components/tasks/` | Timeline view per client |
| `SLAIndicator` | `components/tasks/` | Badge: on_time/warning/overdue |
| `AttachmentUpload` | `components/tasks/` | File upload for task |
| `EmailComposeModal` | `components/tasks/` | Modal to compose and send email |
| `SLAAerts` | `components/dashboard/` | Dashboard widget for SLA alerts |

### UI Screens (approved in brainstorming)

1. **Template List**: Cards with name, activity count, recurrence, status toggle
2. **Template Detail**: Activities list with drag reorder, due_day inputs, hours
3. **Client Timeline**: Month navigation, stats bar (on_time/warning/overdue/em_andamento), task rows with SLA colors, attachment badges, email button
4. **Dashboard Alerts**: Red banner for overdue, yellow for near-deadline

## Integration Points

| Module | Integration |
|--------|-------------|
| **Dashboard** | SLA alerts widget |
| **Clients** | Link to timeline from client detail; new SLA tab |
| **Gallery** | Reuse file upload infrastructure for attachments |
| **Notifications** | Auto-create notifications for SLA warnings/overdue |
| **Auth** | All endpoints protected by existing JWT auth |

## Dependencies

- **Backend**: Python `smtplib` / `email` module for sending (or optional integration with SendGrid/Mailgun via env config)
- **Frontend**: Already has `@hello-pangea/dnd` for drag reorder; `axios` for file upload
- **Infra**: SMTP credentials in `.env`; file storage same as Gallery module

## Implementation Order

### Phase 1: Foundation (Backend models + core APIs)
1. Create migration with new tables
2. Implement ActivityTemplate + TemplateActivity (CRUD)
3. Implement ClientTemplateAssignment + auto-generation
4. Implement ClientSLA + SLA calculation
5. Attachments model + file upload/download

### Phase 2: Timeline + Email
6. Client Timeline endpoint (with SLA status)
7. Email sending (SMTP) + send-email endpoint
8. Dashboard alerts endpoint

### Phase 3: Frontend
9. Template management pages (list + detail)
10. Client Timeline page
11. Task attachments UI
12. Email compose modal
13. Dashboard alerts widget

## Risks & Trade-offs

- **Email reliability**: SMTP depende de configuração externa. Fallback necessário.
- **File storage**: Anexos de tarefas vs. Galeria — usar storage separado
  (`storage/tasks/`) para não misturar com arquivos da galeria.
- **SLA calculation**: Dias úteis vs. corridos? Definir como dias corridos por
  simplicidade inicial, configurável depois.
- **Regeneration frequency**: Tasks mensais precisam de job scheduler. Usar
  abordagem on-demand primeiro (botão "gerar próximo mês"), depois cron.

## Future Considerations (out of scope)

- Portal do cliente (client login + visualizar timeline)
- Aprovação do cliente como fase do fluxo
- Relatórios de produtividade por cliente/mês
- Integração com módulo de pagamentos (horas faturáveis)
- Notificações automáticas por email (disparo sem ação manual)
