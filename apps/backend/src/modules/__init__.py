"""
Café com BPO - Backend Modules

This package contains all feature modules following the Service-Repository pattern.
Each module is self-contained with its own models, schemas, repository, service, and router.
"""

from src.modules.auth import router as auth_router
from src.modules.pricing import router as pricing_router
from src.modules.proposals import router as proposals_router
from src.modules.clients import router as clients_router
from src.modules.dashboard import router as dashboard_router
from src.modules.gallery import router as gallery_router
from src.modules.network import router as network_router
from src.modules.tasks import router as tasks_router

__all__ = [
    "auth_router",
    "pricing_router",
    "proposals_router",
    "clients_router",
    "dashboard_router",
    "gallery_router",
    "network_router",
    "tasks_router",
]
