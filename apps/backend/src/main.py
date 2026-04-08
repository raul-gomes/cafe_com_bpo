from fastapi import FastAPI
from datetime import datetime
from src.config import get_settings
from src.api.pricing import router as pricing_router
import os

def create_app() -> FastAPI:
    # Disable docs in test/prod depending on needs, but we'll leave defaults for now
    app = FastAPI(title="Café com BPO API", version="0.1.0")
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

    return app

# Optional: provide a default instance for uvicorn 
# (although Dockerfile suggests uvicorn src.main:create_app --factory)
