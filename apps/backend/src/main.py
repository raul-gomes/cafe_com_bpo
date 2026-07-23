from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import time
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from src.core.rate_limit import limiter

from src.core.config import get_settings
from src.core.logger import setup_logging, log
from src.core.database import engine
from src.modules.pricing.router import router as pricing_router
from src.modules.auth.router import router as auth_router
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.proposals.router import router as proposals_router
from src.modules.gallery.router import router as gallery_router
from src.modules.clients.router import router as clients_router
from src.modules.network.router import router as network_router
from src.modules.tasks.router import router as tasks_router
from src.modules.dashboard.router import router as dashboard_router
from src.modules.payments.router import router as payments_router
from src.modules.notifications.router import router as notifications_router
from src.modules.companies.router import router as companies_router
from src.modules.calendar.router import router as calendar_router
from src.modules.feedback.router import router as feedback_router
from src.modules.team.router import router as team_router
from src.modules.tasks.scheduler import TaskScheduler

_scheduler = TaskScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 Iniciando aplicação...")
    _scheduler.start()
    yield
    _scheduler.stop()
    log.info("🛑 Aplicação encerrada.")


def create_app() -> FastAPI:
    setup_logging()

    app = FastAPI(
        title="Café com BPO API",
        description="API de Precificação e Gestão de Propostas BPO (Arquitetura Modular)",
        version="1.1.0",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health_check():
        from sqlalchemy import text

        db_status = "connected"
        error_msg = None
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as e:
            db_status = "disconnected"
            error_msg = str(e)

        healthy = db_status == "connected"
        response = {
            "status": "healthy" if healthy else "unhealthy",
            "version": app.version,
            "mode": settings.mode,
            "database": db_status,
            "scheduler": "rocketry",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        if error_msg:
            response["error"] = error_msg

        status_code = 200 if healthy else 503
        return JSONResponse(content=response, status_code=status_code)

    # Registro de Roteadores Modulares
    app.include_router(pricing_router)
    app.include_router(auth_router)
    app.include_router(proposals_router)
    app.include_router(gallery_router)
    app.include_router(clients_router)
    app.include_router(network_router)
    app.include_router(tasks_router)
    app.include_router(dashboard_router)
    app.include_router(payments_router)
    app.include_router(notifications_router)
    app.include_router(companies_router)
    app.include_router(calendar_router)
    app.include_router(feedback_router)
    app.include_router(team_router)

    os.makedirs("storage/avatars", exist_ok=True)
    app.mount("/avatars", StaticFiles(directory="storage/avatars"), name="avatars")

    # ── Scheduler endpoints ──

    @app.post("/tasks/scheduler/run")
    def run_scheduler(_current_user: UserResponse = Depends(get_current_user)):
        """Run the scheduler check (auto-detects rules based on today's date)."""
        if not _scheduler.app:
            raise HTTPException(status_code=503, detail="Scheduler not initialized")
        result = _scheduler.run_daily_check(mode="all")
        return result

    @app.post("/tasks/scheduler/run-daily")
    def run_scheduler_daily(_current_user: UserResponse = Depends(get_current_user)):
        """Force run the daily rule (for testing)."""
        if not _scheduler.app:
            raise HTTPException(status_code=503, detail="Scheduler not initialized")
        result = _scheduler.run_daily_check(mode="daily")
        return result

    @app.post("/tasks/scheduler/run-weekly")
    def run_scheduler_weekly(_current_user: UserResponse = Depends(get_current_user)):
        """Force run the weekly rule (for testing)."""
        if not _scheduler.app:
            raise HTTPException(status_code=503, detail="Scheduler not initialized")
        result = _scheduler.run_daily_check(mode="weekly")
        return result

    @app.post("/tasks/scheduler/run-monthly")
    def run_scheduler_monthly(_current_user: UserResponse = Depends(get_current_user)):
        """Force run the monthly rule (for testing)."""
        if not _scheduler.app:
            raise HTTPException(status_code=503, detail="Scheduler not initialized")
        result = _scheduler.run_daily_check(mode="monthly")
        return result

    @app.post("/tasks/scheduler/run-yearly")
    def run_scheduler_yearly(_current_user: UserResponse = Depends(get_current_user)):
        """Force run the yearly rule (for testing)."""
        if not _scheduler.app:
            raise HTTPException(status_code=503, detail="Scheduler not initialized")
        result = _scheduler.run_daily_check(mode="yearly")
        return result

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000

        log.info(
            f"HTTP {request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.2f}ms"
        )
        return response

    return app
