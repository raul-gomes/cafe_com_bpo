from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import time

from src.core.config import get_settings
from src.core.logger import setup_logging, log
from src.modules.pricing.router import router as pricing_router
from src.modules.auth.router import router as auth_router
from src.modules.proposals.router import router as proposals_router
from src.modules.gallery.router import router as gallery_router
from src.modules.clients.router import router as clients_router
from src.modules.network.router import router as network_router
from src.modules.tasks.router import router as tasks_router

def create_app() -> FastAPI:
    setup_logging()
    
    app = FastAPI(
        title="Café com BPO API",
        description="API de Precificação e Gestão de Propostas BPO (Arquitetura Modular)",
        version="1.1.0"
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    settings = get_settings()

    @app.get("/health")
    def health_check():
        return {
            "status": "ok",
            "environment": settings.mode,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "version": app.version
        }

    # Registro de Roteadores Modulares
    app.include_router(pricing_router)
    app.include_router(auth_router)
    app.include_router(proposals_router)
    app.include_router(gallery_router)
    app.include_router(clients_router)
    app.include_router(network_router)
    app.include_router(tasks_router)

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
