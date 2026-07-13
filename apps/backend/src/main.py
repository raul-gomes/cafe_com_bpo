from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os
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


def create_app() -> FastAPI:
    setup_logging()

    app = FastAPI(
        title="Café com BPO API",
        description="API de Precificação e Gestão de Propostas BPO (Arquitetura Modular)",
        version="1.1.0",
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
            "cron_configured": bool(settings.cron_secret),
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
