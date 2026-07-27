"""
task_manager — Routines & Tasks Module

Sub-packages by domain:
  task/           Task + Phase CRUD, Timeline, Conflicts, SLA Alerts, Client Timeline, Email
  templates/      ActivityTemplate + TemplateActivity CRUD
  assignments/    ClientTemplateAssignment lifecycle (assign / unassign / regenerate)
  routine_types/  RoutineType CRUD
  sla/            ClientSLA CRUD
  attachments/    TaskAttachment CRUD + upload

Each sub-package follows: repository.py → service.py → router.py.
Models and schemas are shared at this root level.
"""

from fastapi import APIRouter
from .task.router import router as task_router
from .templates.router import router as templates_router
from .assignments.router import router as assignments_router
from .routine_types.router import router as routine_types_router
from .sla.router import router as sla_router
from .attachments.router import router as attachments_router
from .scheduler import trigger_router

router = APIRouter()
router.include_router(task_router)
router.include_router(templates_router)
router.include_router(assignments_router)
router.include_router(routine_types_router)
router.include_router(sla_router)
router.include_router(attachments_router)
router.include_router(trigger_router)
