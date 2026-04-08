import pytest
import os
from fastapi.testclient import TestClient

# Set environment before loading the app/settings
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from src.main import create_app

@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
