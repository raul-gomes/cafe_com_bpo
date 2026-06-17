# Sprint 3 — Rotinas: Gaps Implementation Design

## Overview

The Routines system (`activity_templates`) already exists with full CRUD, UI pages, and auto-generation of tasks when assigned to a client. This sprint fills the remaining gaps from `docs/implemantation_plan_todo_2.md` items **15, 16, 23, 24** plus a `template_id` FK on the Task model for traceability.

No existing functionality is removed or broken. All changes are additive.

---

## Section 1 – `next_business_day` utility + `due_days` (Items 15, 16)

### `next_business_day`
- **File**: `apps/backend/src/core/utils.py`
- Pure function; no dependencies
- Logic: advance date by 1 day while `weekday() >= 5`
- Signature: `def next_business_day(date: datetime) -> datetime`
- Applied inside `TaskService._calculate_activity_deadline()` after computing the candidate deadline

### `due_days` on TemplateActivity
- **Model**: Add column `due_days` (Integer, nullable) to `template_activities` table
- **Schema**: `TemplateActivityCreate` / `TemplateActivityUpdate` get `due_days: Optional[int]`
- **Calculation logic** in `_calculate_activity_deadline`:
  - If `activity.due_days` is set → deadline = `start_date + timedelta(days=activity.due_days)`, then apply `next_business_day`
  - Else → existing behavior using `activity.due_day` (day of month)
- **Migration**: `alembic revision --autogenerate -m "add due_days to template_activities"`
- **UI**: TemplateDetailPage shows an optional "Dias após início" input next to "Dia do mês"

### Test Plan
- `test_next_business_day_weekday`: Saturday → Monday
- `test_next_business_day_sunday`: Sunday → Monday
- `test_next_business_day_friday`: Friday stays Friday
- `test_due_days_calculation`: with `due_days=5`, deadline = start + 5 (skipping weekend)
- `test_due_days_fallback`: if `due_days` is None, uses existing `due_day` behavior

---

## Section 2 – Custom Routine Type (Item 23)

### New model `RoutineType`

```sql
CREATE TABLE routine_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(10),          -- hex color for badge
    suggestions JSON,           -- optional array of suggested activity names
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Backend
- **Model**: `RoutineType` in `apps/backend/src/modules/tasks/models.py`
- **Schemas**: `RoutineTypeCreate`, `RoutineTypeUpdate`, `RoutineTypeResponse`
- **Repository**: `RoutineTypeRepository` (or add methods to `TaskRepository`)
  - `create(user_id, data)`, `list_by_user(user_id)`, `get_by_id(id)`, `update(id, data)`, `delete(id)`
- **Service**: Methods in `TaskService`
- **Router**: `GET/POST/PUT/DELETE /tasks/routine-types/`
- **ActivityTemplate FK**: Add `routine_type_id` (UUID, nullable, FK → `routine_types.id`) to `activity_templates` table
- **Schema update**: `ActivityTemplateCreate`/`Update` gain `routine_type_id: Optional[UUID]`

### Frontend
- **New page/modal**: "Gerenciar Tipos" modal accessible from `TemplateListPage`
  - List of existing types with name + color swatch
  - "Novo Tipo" button → inline form: name input + ColorPicker
  - Edit/delete actions
- **TemplateDetailPage**: Add "Tipo" dropdown (optional) when creating/editing template
- **TemplateListPage**: Show color badge next to each template name

### Test Plan
- `test_create_routine_type`: POST creates and returns type
- `test_list_routine_types`: GET returns user's types
- `test_delete_routine_type_unlinks_templates`: setting FK to NULL on templates
- `test_routine_type_color_badge`: UI renders color swatch

---

## Section 3 – FK `template_id` on Tasks + TaskCard Badge (Item 24)

### Database changes on `tasks` table
- Add columns:
  - `template_id` UUID, nullable, FK → `activity_templates(id)` ON DELETE SET NULL
  - `assignment_id` UUID, nullable, FK → `client_template_assignments(id)` ON DELETE SET NULL

### Backend
- **Model**: `Task` gains `template_id` and `assignment_id` columns (Optional[UUID])
- **Schema**: `TaskResponse` gains `template_id`, `assignment_id`, `template_name: Optional[str]`
- **Service**: In `assign_template_to_client()`, populate `template_id` and `assignment_id` when creating tasks
- **Query**: `get_tasks()` in repository can optionally LEFT JOIN `activity_templates` to include `template_name`

### Frontend
- **TaskCard**: If `task.template_name` is present, render a badge:
  ```tsx
  {task.template_name && (
    <span className="task-card__template-badge">
      {task.template_name}
    </span>
  )}
  ```
- Badge style: small pill, subtle background, positioned below client name
- **TasksPage**: The badge appears in both Kanban and list views

### Test Plan
- `test_task_has_template_fk`: after assignment, tasks have template_id set
- `test_task_response_includes_template_name`: API returns template_name
- `test_task_card_renders_badge`: UI shows badge when template_name is present
- `test_task_card_hides_badge`: UI hides badge when template_name is absent

---

## Backend file changes summary

| File | Change |
|------|--------|
| `src/core/utils.py` | Add `next_business_day()` |
| `src/modules/tasks/models.py` | Add `RoutineType` model; add `due_days`, `routine_type_id`, `template_id`, `assignment_id` columns |
| `src/modules/tasks/schemas.py` | Add RoutineType schemas; update TemplateActivity/Task/ActivityTemplate schemas |
| `src/modules/tasks/repository.py` | Add RoutineType CRUD methods; update task queries for join |
| `src/modules/tasks/service.py` | Update `_calculate_activity_deadline` with due_days + next_business_day; update `assign_template_to_client` to populate FKs |
| `src/modules/tasks/router.py` | Add routine-types endpoints |
| `src/main.py` | No change (tasks router already registered) |

## Frontend file changes summary

| File | Change |
|------|--------|
| `src/components/tasks/TaskCard.tsx` | Add template_name badge |
| `src/pages/panel/TemplateListPage.tsx` | Add "Gerenciar Tipos" button + modal |
| `src/pages/panel/TemplateDetailPage.tsx` | Add routine_type dropdown; add due_days input |
| `src/api/hooks/useTasks.ts` | Add `useRoutineTypes` hook (CRUD) |
| `src/schemas/tasks.ts` | Add RoutineType types |
| `src/context/AuthContext.tsx` | No change needed |

## Migration order
1. `add routine_type_id + due_days to template_activities` (adds columns)
2. `add template_id + assignment_id to tasks` (adds columns)
3. `create routine_types table` (new table)

All three can be combined into one migration, or separate — either works since they are independent.
