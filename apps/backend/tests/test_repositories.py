import pytest
from uuid import uuid4
from src.repositories import UserRepository, PricingScenarioRepository
from sqlalchemy.exc import IntegrityError

def test_create_user_persists_record(db_session):
    repo = UserRepository(db_session)
    user = repo.create_user(email="test@test.com", password_hash="hash", auth_provider="local")
    assert user.id is not None

def test_get_user_by_email_returns_user(db_session):
    repo = UserRepository(db_session)
    assert repo.get_user_by_email("unknown@none.com") is None

def test_create_user_with_duplicate_email_raises_integrity_error(db_session):
    repo = UserRepository(db_session)
    repo.create_user(email="dup@test.com", password_hash="hash")
    with pytest.raises(IntegrityError):
        repo.create_user(email="dup@test.com", password_hash="hash")

def test_create_scenario_persists_json_payload_and_result(db_session):
    user_repo = UserRepository(db_session)
    user = user_repo.create_user(email="sc1@test.com", password_hash="hash")

    repo = PricingScenarioRepository(db_session)
    scenario = repo.create_scenario(user_id=user.id, client_name="Client", input_payload={}, result_payload={})
    assert scenario.id is not None

def test_list_scenarios_by_user_returns_only_user_records(db_session):
    user_repo = UserRepository(db_session)
    user = user_repo.create_user(email="sc2@test.com", password_hash="hash")

    repo = PricingScenarioRepository(db_session)
    repo.create_scenario(user_id=user.id, client_name="Client A", input_payload={}, result_payload={})
    repo.create_scenario(user_id=user.id, client_name="Client B", input_payload={}, result_payload={})
    
    scenarios = repo.list_scenarios_by_user(user.id)
    assert type(scenarios) is list
    assert len(scenarios) == 2

def test_get_scenario_by_id_returns_none_for_other_user(db_session):
    user_repo = UserRepository(db_session)
    user1 = user_repo.create_user(email="sc3@test.com", password_hash="hash")
    user2 = user_repo.create_user(email="sc4@test.com", password_hash="hash")

    repo = PricingScenarioRepository(db_session)
    scenario = repo.create_scenario(user_id=user1.id, client_name="Client", input_payload={}, result_payload={})
    
    assert repo.get_scenario_by_id(user_id=user2.id, scenario_id=scenario.id) is None
    assert repo.get_scenario_by_id(user_id=user1.id, scenario_id=scenario.id) is not None

def test_delete_scenario_removes_record(db_session):
    user_repo = UserRepository(db_session)
    user = user_repo.create_user(email="sc5@test.com", password_hash="hash")

    repo = PricingScenarioRepository(db_session)
    scenario = repo.create_scenario(user_id=user.id, client_name="Client", input_payload={}, result_payload={})
    
    res = repo.delete_scenario(user_id=user.id, scenario_id=scenario.id)
    assert res is True
    assert repo.get_scenario_by_id(user_id=user.id, scenario_id=scenario.id) is None
