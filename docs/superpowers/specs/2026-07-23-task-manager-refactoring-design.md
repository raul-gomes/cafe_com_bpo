# Task Manager Module Refactoring

**Date:** 2026-07-23
**Status:** Design (pending implementation)
**Drivers:** raul

## Problem

The `modules/tasks/` module has grown to ~4,300 lines across 6 files, handling 10+ distinct concerns:

| File | Lines | Concerns |
|------|-------|----------|
| `models.py` | 361 | 8 models |
| `schemas.py` | 437 | 32 schemas |
| `repository.py` | 703 | 1 class, ~55 methods |
| `service.py` | 1,277 | 1 class, ~30 methods |
| `router.py` | 790 | 29 endpoints |
| `scheduler.py` | 743 | 1 class + 12 standalone functions |

This monolithic structure makes it hard to:
- Understand what belongs where
- Test in isolation
- Reason about dependencies between concerns
- Onboard new developers

## Solution

Replace `modules/tasks/` with `modules/task_manager/`, organized into **sub-packages by bounded context**. Each sub-package follows the project's established pattern (models → schemas → repository → service → router), keeping models and schemas at the root level since they are shared.

## Structure

```
apps/backend/src/modules/task_manager/
├── __init__.py              # Composite router (aggregates all sub-routers)
├── models.py                # All 8 SQLAlchemy models (Alembic discovery)
├── schemas.py               # All 32 Pydantic schemas (shared across domains)
├── scheduler.py             # Rocketry TaskScheduler + trigger endpoints
│
├── task/                    # Task CRUD + Kanban phases + Timeline + Conflicts + SLA alerts
│   ├── __init__.py
│   ├── repository.py
│   ├── service.py
│   └── router.py
│
├── templates/               # Activity Templates + Template Activities
│   ├── __init__.py
│   ├── repository.py
│   ├── service.py
│   └── router.py
│
├── routine_types/           # Routine Types (custom categories for templates)
│   ├── __init__.py
│   ├── repository.py
│   ├── service.py
│   └── router.py
│
├── assignments/             # Client-Template Assignment + Task Generation
│   ├── __init__.py
│   ├── repository.py
│   ├── service.py
│   └── router.py
│
├── sla/                     # SLA configuration
│   ├── __init__.py
│   ├── repository.py
│   ├── service.py
│   └── router.py
│
└── attachments/             # File upload/download + Email sending
    ├── __init__.py
    ├── repository.py
    ├── service.py
    └── router.py
```

## Sub-package Contents

### `task/` — Task CRUD + Phases + Timeline + Conflicts + SLA Alerts

**Repository** (~20 methods from current `TaskRepository`):
- `get_by_id`, `get_by_user` (with filters: status, process_type, today, overdue, client_id)
- `create`, `update`, `delete` (soft-delete), `cancel`
- `get_phases_by_user`, `get_phase_by_id`, `create_phase`, `update_phase`, `delete_phase`
- `create_default_phases`, `count_phases`, `migrate_tasks_from_phase`
- `get_tasks_for_phase`, `get_tasks_with_deadline`, `get_tasks_in_date_range`
- `get_tasks_overdue`, `get_tasks_near_deadline`, `get_tasks_completed_in_range`
- `get_tasks_by_client_and_month` (for client timeline)

**Service** (~12 methods from current `TaskService`):
- `create_task` (with notification), `update_task` (with completed_at logic + notification), `delete_task`
- `get_timeline`, `detect_conflicts`, `get_client_timeline` (per-client monthly view with SLA)
- `get_sla_alerts` (dashboard: overdue + near-deadline tasks grouped by client)

**Router** (~19 endpoints):
- `GET/POST /tasks/`, `GET/PUT/DELETE /tasks/{task_id}`
- `PUT /tasks/{task_id}/cancel`
- `GET/POST /tasks/phases/`, `PUT/DELETE /tasks/phases/{phase_id}`, `POST /tasks/phases/reorder`
- `GET /tasks/timeline/`, `GET /tasks/conflicts/`
- `GET /tasks/alerts/sla`
- `GET /tasks/client-timeline/{client_id}`

### `templates/` — Activity Templates + Activities

**Repository** (~11 methods):
- `get_templates_by_user`, `get_template_by_id`, `create_template`, `update_template`, `delete_template`
- `get_activities_by_template`, `get_activity_by_id`, `create_activity`, `update_activity`, `delete_activity`, `reorder_activities`

**Service** (~11 methods):
- `get_templates` (with `activity_count`, `is_overdue`, routine_type enrichment)
- `get_overdue_templates`, `get_template` (with nested activities)
- CRUD for templates and activities

**Router** (~11 endpoints):
- `GET/POST /tasks/templates/`, `GET/PUT/DELETE /tasks/templates/{template_id}`
- `GET /tasks/templates/overdue/`
- `POST /tasks/templates/{template_id}/activities/`
- `PUT/DELETE /tasks/templates/{template_id}/activities/{activity_id}`
- `POST /tasks/templates/{template_id}/activities/reorder`

### `routine_types/` — Routine Type CRUD

**Repository** (~5 methods):
- `create_routine_type`, `list_routine_types`, `get_routine_type`, `update_routine_type`, `delete_routine_type`

**Service** (~5 methods, thin delegation):
- CRUD + logging

**Router** (~4 endpoints):
- `GET/POST /tasks/routine-types/`, `PUT/DELETE /tasks/routine-types/{type_id}`

### `assignments/` — Client-Template Assignment + Generation

**Repository** (~10 methods):
- `create_assignment`, `get_assignment_by_id`, `get_assignments_by_client`, `get_assignments_by_user`
- `get_active_assignments`, `count_active_assignments`
- `delete_assignment`, `hard_delete_future_incomplete_tasks_by_assignment`
- `has_pending_task`, `task_exists_by_instance_id`, `update_assignment_last_generated`

**Service** (~4 methods):
- `assign_template_to_client` (generates only for daily/once; weekly/monthly/yearly defer to scheduler)
- `get_client_assignments`, `remove_client_assignment` (cleans up future tasks first)
- `regenerate_client_tasks`

**Router** (~4 endpoints):
- `POST /tasks/client-templates/` (assign)
- `GET /tasks/client-templates/` (list by `client_id`)
- `DELETE /tasks/client-templates/{assignment_id}`
- `POST /tasks/client-templates/{assignment_id}/regenerate`

### `sla/` — SLA Configuration

**Repository** (~6 methods):
- `get_slas_by_client`, `get_sla_by_id`, `get_sla_by_client_and_process`
- `create_sla`, `update_sla`, `delete_sla`

**Service** (~4 methods):
- CRUD + logging

**Router** (~4 endpoints):
- `GET/POST /tasks/sla/`, `PUT/DELETE /tasks/sla/{sla_id}`

### `attachments/` — File Upload + Email

**Repository** (~5 methods):
- `get_attachments_by_task`, `get_attachment_by_id`
- `create_attachment`, `delete_attachment`, `mark_attachment_sent`

**Service** (~4 methods):
- `get_task_attachments`, `upload_attachment` (validates type/size, saves to disk)
- `delete_attachment` (removes from disk)
- `send_task_email` (SMTP with attachments)

**Router** (~4 endpoints):
- `GET/POST /tasks/{task_id}/attachments/`
- `DELETE /tasks/{task_id}/attachments/{attachment_id}`
- `POST /tasks/{task_id}/send-email`

## Scheduler

The `scheduler.py` file stays at the module root (it's a standalone background process, not a REST sub-domain). It contains:

- `TaskScheduler` class (Rocketry integration)
- Standalone helpers: `calculate_activity_deadline`, `get_effective_due_day`, `get_weekly_deadlines_for_year_month`, `build_routine_instance_id`, `last_business_day`, etc.
- A `trigger_router` (APIRouter) with 5 manual-trigger endpoints: `POST /tasks/scheduler/run`, `/run-daily`, `/run-weekly`, `/run-monthly`, `/run-yearly` (moved from `main.py`)

The `trigger_router` is included in the composite `__init__.py` so all endpoints are registered under `/tasks`. The `TaskScheduler` class is still instantiated and managed in `main.py`'s lifespan.

The scheduler depends on `assignments/` repository to query active assignments and `task/` repository to create tasks. It imports repository classes directly (not via services).

## Integration

### `__init__.py` (composite router)
```python
from fastapi import APIRouter

router = APIRouter()

from .task.router import router as task_router
from .templates.router import router as templates_router
from .routine_types.router import router as routine_types_router
from .assignments.router import router as assignments_router
from .sla.router import router as sla_router
from .attachments.router import router as attachments_router
from .scheduler import trigger_router

router.include_router(task_router)
router.include_router(templates_router)
router.include_router(routine_types_router)
router.include_router(assignments_router)
router.include_router(sla_router)
router.include_router(attachments_router)
router.include_router(trigger_router)
```

### `main.py` changes
```python
# Before:
from src.modules.tasks.router import router as tasks_router
from src.modules.tasks.scheduler import TaskScheduler

# After:
from src.modules.task_manager import router as task_manager_router
from src.modules.task_manager.scheduler import TaskScheduler
```

### Cross-module import updates

| File | Old import | New import |
|------|-----------|------------|
| `dashboard/service.py` | `from src.modules.tasks.repository import TaskRepository` | `from src.modules.task_manager.task.repository import TaskRepository` |
| `dashboard/router.py` | `from src.modules.tasks.models import Task` | `from src.modules.task_manager.models import Task` |
| `team/repository.py` | `from src.modules.tasks.models import ActivityTemplate` | `from src.modules.task_manager.models import ActivityTemplate` |
| `clients/repository.py` | `from src.modules.tasks.models import Task` | `from src.modules.task_manager.models import Task` |

## Migration Order

1. Create `task_manager/` directory structure with all sub-packages
2. Copy `models.py` and `schemas.py` to `task_manager/`
3. Copy `scheduler.py` to `task_manager/` (with trigger endpoints as part of the file)
4. Extract `task/` sub-package (repository, service, router)
5. Extract `templates/` sub-package
6. Extract `routine_types/` sub-package
7. Extract `assignments/` sub-package
8. Extract `sla/` sub-package
9. Extract `attachments/` sub-package
10. Create `__init__.py` with composite router
11. Update `main.py` to import from `task_manager`
12. Update cross-module imports (dashboard, team, clients)
13. Remove old `tasks/` module
14. Run `ruff check .` + `ruff format --check .` + `pytest`

## Risks and Mitigations

- **Alembic model discovery**: Models must remain in `task_manager/models.py` (not spread across sub-packages) so Alembic's `Base.metadata` continues to auto-discover them
- **Circular imports**: Sub-packages should not import from each other's `service.py` or `router.py`. Cross-sub-package dependencies go through `repository.py` or shared `schemas.py`. The `scheduler.py` imports repository classes directly.
- **Test impact**: Tests that import from `src.modules.tasks` will break. All test imports must be updated. The `conftest.py` patches `src.core.database.engine` — as long as models are imported from `task_manager.models`, the SQLite patching still works.
- **Merge conflicts**: Since this is a pure refactoring (no behavior changes), it should be done as a single focused PR that doesn't mix with feature work.
