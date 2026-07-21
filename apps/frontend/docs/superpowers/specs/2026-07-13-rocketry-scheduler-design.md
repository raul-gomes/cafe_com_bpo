# Rocketry Scheduler Integration

**Date:** 2026-07-13
**Status:** Approved

## Summary

Substituir o sistema atual de scheduler baseado em endpoints externos (`/tasks/scheduler/cron`, `/tasks/scheduler/run`, `/tasks/scheduler/pre-generate`) pelo Rocketry — um scheduler Python in-process que gerencia a geração de tasks a partir de rotinas (ActivityTemplate + ClientTemplateAssignment) automaticamente.

## Architecture

```
FastAPI app factory (create_app)
  │
  ├── lifespan → TaskScheduler.start() em thread daemon
  │   └── sync_assignments() → registra FuncTask para cada assignment ativo
  │
  ├── rotina normal → assign_template_to_client()
  │   ├── gera tasks imediatamente (síncrono)
  │   └── chama sync_assignments() para registrar no Rocketry
  │
  └── removal/unlink → remove_assignment()
      └── chama sync_assignments() para remover do Rocketry
```

## Changes

### 1. `requirements.txt`
Add: `rocketry>=2.8.0`

### 2. New file: `src/modules/tasks/scheduler.py`
Class `TaskScheduler`:
- `__init__()`: creates `Rocketry` app with config (log level, etc.)
- `start()`: launches Rocketry in a daemon thread
- `stop()`: shuts down Rocketry gracefully
- `sync_assignments(session)`: queries DB for active assignments, reconciles with Rocketry's task set
- `_build_task_func(assignment_id)`: returns a callable that loads the assignment + activities, checks `should_generate_today()` for each, and creates tasks
- `_condition_for_template(template)`: returns `daily.after("06:00").before("07:00")` for all — the function internally checks recurrence

### 3. Modified: `src/core/config.py`
Remove `cron_secret` setting (no longer needed).

### 4. Modified: `src/main.py`
Add Rocketry lifespan:
```python
from src.modules.tasks.scheduler import TaskScheduler

_scheduler = TaskScheduler()

@asynccontextmanager
async def lifespan(app):
    _scheduler.start()
    yield
    _scheduler.stop()
```

### 5. Modified: `src/modules/tasks/service.py`
- **Remove**: `run_scheduler()`, `_should_generate_today()`, `run_pre_generate_for_next_month()`, `_get_weekly_deadlines_for_month()`, `_get_weekly_deadlines_for_year_month()` — entire scheduler block
- **Keep**: `assign_template_to_client()` (immediate generation), `regenerate_client_tasks()`
- **Modify**: `assign_template_to_client()` and `delete_assignment()` call `scheduler.sync_assignments()` via a callback or imported function

### 6. Modified: `src/modules/tasks/router.py`
- **Remove**: `POST /tasks/scheduler/run`, `POST /tasks/scheduler/cron`, `POST /tasks/scheduler/pre-generate`
- **Keep**: all other task/routine endpoints

### 7. Modified: `docker-compose.yml` & `.env`
Remove `CRON_SECRET` references (cleanup).

### 8. Modified: `src/core/database.py`
Expose `get_db_session` generator for Rocketry tasks to use (Rocketry tasks need their own DB sessions since they run in a separate thread).

## Rocketry Task Design

Each active `ClientTemplateAssignment` gets **one** `FuncTask`:

```python
from rocketry import Rocketry
from rocketry.conds import daily
from rocketry.args import Session as RocketrySession

app = Rocketry()

@app.task(daily.after("06:00").before("07:00"), execution="thread")
def generate_tasks(assignment_id: str):
    """Generates tasks for a single assignment if today matches recurrence."""
    db = next(get_db_session())
    try:
        assignment = repo.get_assignment_by_id(assignment_id)
        if not assignment or not assignment.is_active:
            return
        template = repo.get_template_by_id(assignment.template_id)
        if not template or not template.is_active:
            return
        activities = repo.get_activities_by_template(template.id)
        for activity in activities:
            if should_generate_today(template, activity):
                deadline = calculate_deadline(template, activity)
                if not has_pending_task(...):
                    repo.create_task(...)
        repo.update_assignment_last_generated(assignment.id)
        db.commit()
    finally:
        db.close()
```

The `should_generate_today()` and `calculate_deadline()` are extracted from the existing service into standalone helper functions in `scheduler.py`, so they can be used by both the Rocketry task and the synchronous `assign_template_to_client()`.

## Files Changed

| File | Change |
|------|--------|
| `apps/backend/requirements.txt` | + `rocketry` |
| `apps/backend/src/modules/tasks/scheduler.py` | NEW — TaskScheduler class |
| `apps/backend/src/main.py` | Lifespan start/stop scheduler |
| `apps/backend/src/modules/tasks/service.py` | Remove scheduler methods, keep sync generation |
| `apps/backend/src/modules/tasks/router.py` | Remove 3 scheduler endpoints |
| `apps/backend/src/core/config.py` | Remove `cron_secret` |
| `apps/backend/src/core/database.py` | Ensure `get_db_session` is thread-safe |

## Testing

- Backend: existing task generation tests + verify no regression
- No scheduler endpoints to test (they're removed)
- Rocketry task logic tested via unit tests of extracted helper functions
