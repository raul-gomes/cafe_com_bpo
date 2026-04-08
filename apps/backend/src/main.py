from fastapi import FastAPI
from datetime import datetime
import os

def create_app() -> FastAPI:
    # Disable docs in test/prod depending on needs, but we'll leave defaults for now
    app = FastAPI(title="Café com BPO API", version="0.1.0")

    @app.get("/health")
    def health_check():
        return {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "version": app.version
        }

    return app

# Optional: provide a default instance for uvicorn 
# (although Dockerfile suggests uvicorn src.main:create_app --factory)
