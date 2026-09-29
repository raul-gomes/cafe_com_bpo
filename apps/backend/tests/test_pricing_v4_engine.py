"""Metodologia v4 de precificação — regra de domínio (fonte única de verdade).

Este arquivo fixa a regra oficial de precificação do Café com BPO no backend,
que antes vivia apenas no simulador do frontend (`src/lib/pricingEngine.ts`).
A regra foi confirmada pelo dono do produto: os preços de hoje não podem mudar,
portanto a v4 é portada para cá com a mesma ordem de operações.

Ordem das operações (v4):
  1. custo por minuto = total_cost / (people_count * hours_per_month * 60)
  2. custo do serviço = minutos * quantidade * custo_min  OU  valor_fixo * quantidade
  3. lucro = custo_total * margem
  4. markup de impostos e comissão = (custo + lucro) / (1 - (imposto+comissão)/100)
  5. preço final = preço_com_impostos * (1 - desconto_de_prazo)
"""

from decimal import Decimal

import pytest

from src.modules.pricing.domain.engine import (
    OperationContext,
    PricingCalculator,
    PricingInput,
    ServiceItem,
)


def build_operation(tax_rate="0", commission_rate="0"):
    """Operação com números redondos: 9600 / (2*160) = 30 por hora = 0,5 por minuto."""
    return OperationContext(
        total_cost=Decimal("9600"),
        people_count=2,
        hours_per_month=Decimal("160"),
        tax_rate=Decimal(tax_rate),
        commission_rate=Decimal(commission_rate),
    )


def calculate(services, margin="0", term_discount="0", **operation_kwargs):
    pricing_input = PricingInput(
        operation=build_operation(**operation_kwargs),
        services=services,
        desired_profit_margin=Decimal(margin),
        term_discount=Decimal(term_discount),
    )
    return PricingCalculator.calculate_final_price(pricing_input)


def time_service(minutes="10", quantity=1, **extra):
    return ServiceItem(
        name="Atendimento",
        type="time",
        minutes_per_execution=Decimal(minutes),
        monthly_quantity=quantity,
        **extra,
    )


def fixed_service(value="100", quantity=1, **extra):
    return ServiceItem(
        name="Implantação",
        type="fixed",
        fixed_value=Decimal(value),
        monthly_quantity=quantity,
        **extra,
    )


# ── Etapas 1 e 2: custo da operação e dos serviços ──────────────────────────


def test_cost_per_minute_is_derived_from_operation():
    result = calculate([time_service(minutes="10", quantity=5)])
    assert result.breakdown.cost_per_hour == Decimal("30")
    assert result.breakdown.cost_per_minute == Decimal("0.5")


def test_fixed_service_cost_is_multiplied_by_monthly_quantity():
    """Regressão da v4: serviço fixo vale `fixed_value * quantidade` (o motor
    antigo tratava `fixed_value` como absoluto)."""
    result = calculate([fixed_service(value="100", quantity=3)])
    assert result.breakdown.service_costs[0].cost == Decimal("300.00")


def test_time_service_with_zero_fixed_value_is_never_free():
    """Regressão da v4: o tipo do serviço decide o cálculo. O formulário sempre
    envia `fixed_value` (default 0), então inferir 'serviço fixo' pela
    presença do campo zeraria o serviço."""
    result = calculate([time_service(minutes="10", quantity=1, fixed_value=Decimal(0))])
    assert result.breakdown.service_costs[0].cost == Decimal("5.00")


def test_inactive_services_are_not_charged():
    result = calculate(
        [
            time_service(minutes="10", quantity=1),
            time_service(minutes="10", quantity=1, active=False),
        ]
    )
    assert len(result.breakdown.service_costs) == 1
    assert result.breakdown.total_service_cost == Decimal("5.00")


def test_zero_quantity_falls_back_to_one_execution():
    """Comportamento preservado do simulador (`monthly_quantity || 1`): o preço
    não pode cair para zero só porque o campo ficou vazio/zerado."""
    result = calculate([time_service(minutes="10", quantity=0)])
    assert result.breakdown.service_costs[0].monthly_quantity == 1
    assert result.breakdown.service_costs[0].cost == Decimal("5.00")


# ── Etapas 3 e 4: margem e markup de impostos/comissão ──────────────────────


def test_profit_is_applied_over_the_total_service_cost():
    result = calculate([time_service(minutes="10", quantity=5)], margin="0.20")
    assert result.breakdown.total_service_cost == Decimal("25.00")
    assert result.breakdown.profit_amount == Decimal("5.00")


def test_tax_rate_is_a_percentage_applied_as_markup():
    # 30.00 antes dos impostos / (1 - 6/100) = 31.91 (arredondado a centavos)
    result = calculate(
        [time_service(minutes="10", quantity=5)], margin="0.20", tax_rate="6"
    )
    assert result.breakdown.tax_amount == Decimal("1.91")
    assert result.final_price == Decimal("31.91")


def test_commission_enters_the_same_markup_denominator_as_tax():
    # imposto 6% + comissão 4% = 10% -> 30.00 / 0.90 = 33.33
    result = calculate(
        [time_service(minutes="10", quantity=5)],
        margin="0.20",
        tax_rate="6",
        commission_rate="4",
    )
    assert result.breakdown.tax_amount == Decimal("3.33")
    assert result.final_price == Decimal("33.33")


def test_markup_fails_loudly_when_tax_plus_commission_reaches_one_hundred():
    with pytest.raises(ValueError):
        calculate(
            [time_service()], tax_rate="95", commission_rate="10"
        )


# ── Etapa 5: desconto de prazo ──────────────────────────────────────────────


def test_term_discount_reduces_the_final_price():
    # 30.00 / 0.90 = 33.33... ; com 10% de desconto volta a 30.00
    result = calculate(
        [time_service(minutes="10", quantity=5)],
        margin="0.20",
        tax_rate="6",
        commission_rate="4",
        term_discount="0.10",
    )
    assert result.price_before_discount == Decimal("33.33")
    assert result.discount_amount == Decimal("3.33")
    assert result.final_price == Decimal("30.00")


def test_term_discount_never_produces_a_negative_price():
    result = calculate(
        [time_service()], tax_rate="0", term_discount="1.5"
    )
    assert result.final_price == Decimal("0.00")


# ── Contrato do resultado ───────────────────────────────────────────────────


def test_monetary_values_are_quantized_to_cents():
    result = calculate([time_service(minutes="7", quantity=3)], margin="0.3333")
    cents = Decimal("0.01")
    for value in (
        result.final_price,
        result.price_before_discount,
        result.discount_amount,
        result.breakdown.total_service_cost,
        result.breakdown.profit_amount,
        result.breakdown.tax_amount,
        result.breakdown.service_costs[0].cost,
    ):
        assert value == value.quantize(cents)


def test_service_cost_keeps_identity_needed_by_contracts():
    result = calculate([fixed_service(value="250.50", quantity=2)])
    service_cost = result.breakdown.service_costs[0]
    assert service_cost.name == "Implantação"
    assert service_cost.type == "fixed"
    assert service_cost.monthly_quantity == 2
    assert service_cost.cost == Decimal("501.00")
