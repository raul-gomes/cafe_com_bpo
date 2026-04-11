from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from src.config import get_settings
from src.api.pricing import router as pricing_router
from src.api.auth import router as auth_router
from src.api.proposals import router as proposals_router
from src.logger_config import setup_logging, log
import os
import time
from fastapi import Request

def create_app() -> FastAPI:
    setup_logging()
    # Disable docs in test/prod depending on needs, but we'll leave defaults for now
    app = FastAPI(title="Café com BPO API", version="0.1.0")
    
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

    app.include_router(pricing_router)
    app.include_router(auth_router)
    app.include_router(proposals_router)

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

# Optional: provide a default instance for uvicorn 
# (although Dockerfile suggests uvicorn src.main:create_app --factory)
