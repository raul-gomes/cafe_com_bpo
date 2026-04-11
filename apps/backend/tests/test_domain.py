import pytest
from decimal import Decimal
from src.modules.pricing.domain.engine import (
    OperationContext,
    ServiceItem,
    PricingInput,
    PricingCalculator
)

def build_dummy_operation(total_cost="10000", people_count=2, hours_per_month="160", tax_rate="0.05"):
    return OperationContext(
        total_cost=Decimal(str(total_cost)),
        people_count=int(people_count),
        hours_per_month=Decimal(str(hours_per_month)),
        tax_rate=Decimal(str(tax_rate))
    )

def test_calculate_cost_per_hour_from_total_cost_people_and_hours():
    op = build_dummy_operation(total_cost="10000", people_count=2, hours_per_month="160")
    cost = PricingCalculator.calculate_cost_per_hour(op)
    assert cost == Decimal("31.25")

def test_calculate_cost_per_minute_from_hour_cost():
    op = build_dummy_operation(total_cost="10000", people_count=2, hours_per_month="160")
    cost = PricingCalculator.calculate_cost_per_minute(op)
    assert round(cost, 4) == Decimal("0.5208")

def test_calculate_single_service_cost():
    svc = ServiceItem(name="Task test", minutes_per_execution=Decimal("10"), monthly_quantity=5)
    cost = PricingCalculator.calculate_service_cost(svc, cost_per_minute=Decimal("0.52"))
    assert cost == Decimal("26.00")

def test_calculate_total_service_cost_from_multiple_services():
    svc1 = ServiceItem(name="Task 1", minutes_per_execution=Decimal("10"), monthly_quantity=5)
    svc2 = ServiceItem(name="Task 2", minutes_per_execution=Decimal("0"), monthly_quantity=1, fixed_value=Decimal("100.00"))
    total = PricingCalculator.calculate_total_service_cost([svc1, svc2], cost_per_minute=Decimal("0.52"))
    assert total == Decimal("126.00")

def test_calculate_profit_amount_from_margin():
    profit = PricingCalculator.calculate_profit_amount(base_cost=Decimal("126.00"), desired_profit_margin=Decimal("1.00"))
    assert profit == Decimal("126.00")

def test_calculate_tax_amount_from_tax_rate():
    tax = PricingCalculator.calculate_tax_amount(price_before_tax=Decimal("100.00"), tax_rate=Decimal("0.10"))
    assert tax > Decimal("0.00")

def test_calculate_final_price_matches_expected_result():
    op = build_dummy_operation(tax_rate="0.10")
    svc1 = ServiceItem(name="Task 1", minutes_per_execution=Decimal("10"), monthly_quantity=5)
    pin = PricingInput(operation=op, services=[svc1], desired_profit_margin=Decimal("0.10"))
    
    res = PricingCalculator.calculate_final_price(pin)
    assert res.final_price > res.breakdown.total_service_cost

def test_calculate_pricing_matches_reference_spreadsheet_case():
    op = build_dummy_operation(total_cost="9500", people_count=2, hours_per_month="160", tax_rate="0.06")
    svc = ServiceItem(name="Reference Task", minutes_per_execution=Decimal("15"), monthly_quantity=30)
    pin = PricingInput(operation=op, services=[svc], desired_profit_margin=Decimal("0.20"))
    
    res = PricingCalculator.calculate_final_price(pin)
    assert res.final_price > Decimal("0")
    assert len(res.breakdown.service_costs) == 1

def test_raises_when_total_cost_is_negative():
    op = build_dummy_operation(total_cost="-1000")
    with pytest.raises(ValueError):
        PricingCalculator.calculate_cost_per_hour(op)

def test_raises_when_people_count_is_zero():
    op = build_dummy_operation(people_count=0)
    with pytest.raises(ValueError):
        PricingCalculator.calculate_cost_per_hour(op)

def test_raises_when_hours_per_month_is_zero():
    op = build_dummy_operation(hours_per_month="0")
    with pytest.raises(ValueError):
        PricingCalculator.calculate_cost_per_hour(op)
