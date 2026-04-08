from fastapi import FastAPI
from src.main import create_app

def test_create_app_returns_fastapi_instance():
    app = create_app()
    assert isinstance(app, FastAPI)

def test_health_check_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data
