"""Backfill do preço dos orçamentos — só o que a Metodologia v4 descreve."""

from uuid import UUID, uuid4

import pytest

from src.modules.auth.repository import UserRepository
from src.modules.pricing.backfill import backfill_proposal_prices
from src.modules.pricing.schemas import PricingCalculateRequest
from src.modules.pricing.service import PricingService
from src.modules.proposals.models import PricingScenario
from tests.helpers import pricing_input_for_total


@pytest.fixture
def user_id(db_session) -> UUID:
    user = UserRepository(db_session).create_user(
        email=f"backfill_{uuid4()}@cafe.com",
        password_hash="hash",
        auth_provider="local",
    )
    return user.id


def _scenario(db_session, user_id, input_payload: dict, result_payload: dict) -> UUID:
    scenario = PricingScenario(
        user_id=user_id,
        client_name="Empresa do Teste",
        input_payload=input_payload,
        result_payload=result_payload,
        number=1,
    )
    db_session.add(scenario)
    db_session.commit()
    return scenario.id


def _stored(db_session, scenario_id) -> dict:
    return db_session.get(PricingScenario, scenario_id).result_payload


def _calculated(input_payload: dict) -> dict:
    """O `result_payload` que a v4 produz — usado para montar o caso 'igual'."""
    return PricingService().build_result_payload(
        PricingCalculateRequest.model_validate(input_payload)
    )


def test_dry_run_reports_without_writing(db_session, user_id):
    scenario_id = _scenario(
        db_session, user_id, pricing_input_for_total(100.0), {"final_price": 1.0}
    )

    report = backfill_proposal_prices(db_session)

    assert report.recalculated == 1
    assert report.as_dict()["recalculados"] == 1
    assert _stored(db_session, scenario_id) == {"final_price": 1.0}


def test_apply_recalculates_legacy_price(db_session, user_id):
    scenario_id = _scenario(
        db_session, user_id, pricing_input_for_total(250.0), {"final_price": 7.0}
    )

    backfill_proposal_prices(db_session, apply=True)

    stored = _stored(db_session, scenario_id)
    assert stored["final_price"] == 250.0
    assert stored["breakdown"]["total_service_cost"] == 250.0


def test_apply_never_touches_legacy_input_payload(db_session, user_id):
    """Payload v1/v2 fica intacto: o cliente já viu aquele número."""
    legacy_result = {"final_price": 1250.0, "monthly_cost": 15000.0}
    scenario_id = _scenario(
        db_session,
        user_id,
        {"employees": 10, "services": ["BPF", "Conciliação"]},
        legacy_result,
    )

    report = backfill_proposal_prices(db_session, apply=True)

    assert report.legacy_skipped == 1
    assert report.recalculated == 0
    assert _stored(db_session, scenario_id) == legacy_result


def test_is_idempotent(db_session, user_id):
    scenario_id = _scenario(
        db_session, user_id, pricing_input_for_total(100.0), {"final_price": 1.0}
    )

    backfill_proposal_prices(db_session, apply=True)
    second = backfill_proposal_prices(db_session, apply=True)

    assert second.recalculated == 0
    assert second.unchanged == 1
    assert _stored(db_session, scenario_id)["final_price"] == 100.0


def test_counts_every_outcome(db_session, user_id):
    _scenario(
        db_session,
        user_id,
        pricing_input_for_total(100.0),
        _calculated(pricing_input_for_total(100.0)),
    )
    _scenario(db_session, user_id, pricing_input_for_total(200.0), {"final_price": 1.0})
    _scenario(db_session, user_id, {"employees": 10}, {"final_price": 1250.0})
    _scenario(
        db_session, user_id, {"operation": {}, "services": []}, {"final_price": 0.0}
    )

    report = backfill_proposal_prices(db_session, apply=True)

    assert report.scanned == 4
    assert report.unchanged == 1
    assert report.recalculated == 1
    assert report.legacy_skipped == 2
    assert report.failed == 0


def test_business_rule_failure_is_reported_not_swallowed(db_session, user_id):
    breaking = pricing_input_for_total(100.0)
    breaking["operation"]["tax_rate"] = 95
    breaking["operation"]["commission_rate"] = 10
    scenario_id = _scenario(db_session, user_id, breaking, {"final_price": 100.0})

    report = backfill_proposal_prices(db_session, apply=True)

    assert report.failed == 1
    assert str(scenario_id) in report.failures[0]
    assert _stored(db_session, scenario_id) == {"final_price": 100.0}
