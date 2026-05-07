from fastapi import FastAPI
from src.main import create_app

def test_create_app_returns_fastapi_instance():
    app = create_app()
    assert isinstance(app, FastAPI)

def test_health_check_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "timestamp" in data

def test_health_check_database_connected(client):
    response = client.get("/health")
    data = response.json()
    assert data["database"] == "connected"
    assert "error" not in data

def test_health_check_response_structure(client):
    response = client.get("/health")
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "timestamp" in data
    assert data["status"] in ["healthy", "unhealthy"]
