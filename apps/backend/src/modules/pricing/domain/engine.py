from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

ZERO = Decimal(0)
CENTS = Decimal("0.01")

ServiceType = Literal["time", "fixed"]


def quantize_money(value: Decimal) -> Decimal:
    """Arredonda um valor monetário para centavos (BRL, meio-arredondamento)."""
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


@dataclass
class OperationContext:
    """
    Modelo de domínio que representa o contexto operacional.

    Acondiciona os custos inerentes à operação para cálculo do custo homem
    hora/minuto. `tax_rate` e `commission_rate` são percentuais (ex.: 6 = 6%),
    na mesma escala usada pelo formulário do simulador.
    """

    total_cost: Decimal
    people_count: int
    hours_per_month: Decimal
    tax_rate: Decimal
    commission_rate: Decimal = ZERO


@dataclass
class ServiceItem:
    """
    Modelo de domínio que representa um serviço na precificação.

    Define o escopo de uso temporal (`type="time"`, medido em minutos) ou um
    valor fixo por execução (`type="fixed"`). O `type` — e não a simples
    presença de `fixed_value` — decide o cálculo: o formulário sempre envia
    `fixed_value`, zerado, nos serviços por tempo.
    """

    name: str
    minutes_per_execution: Decimal = ZERO
    monthly_quantity: int = 0
    fixed_value: Decimal | None = None
    type: ServiceType = "time"
    active: bool = True


@dataclass
class ServiceCost:
    """Custo apurado de um serviço, preservando a identidade usada em contrato."""

    name: str
    type: ServiceType
    cost: Decimal
    monthly_quantity: int


@dataclass
class PricingInput:
    """
    Modelo de domínio como Objeto de Transferência de Dados para os Cálculos (Input).

    Agrega toda a operação macro, a lista de serviços selecionados, a margem
    desejada e o desconto de prazo contratado.
    """

    operation: OperationContext
    services: list[ServiceItem]
    desired_profit_margin: Decimal
    term_discount: Decimal = ZERO


@dataclass
class PricingBreakdown:
    """
    Modelo de domínio com descritivo dos valores internos.

    Permite rastrear em uma requisição real como o calculador chegou aos
    valores por quebras.
    """

    cost_per_hour: Decimal
    cost_per_minute: Decimal
    service_costs: list[ServiceCost]
    total_service_cost: Decimal
    profit_amount: Decimal
    tax_amount: Decimal


@dataclass
class PricingResult:
    """
    Modelo de domínio representando a resposta validada da simulação inteira.

    Integra o preço final ao cliente, o desconto de prazo aplicado e todos os
    fracionamentos (breakdown) para registro.
    """

    final_price: Decimal
    price_before_discount: Decimal
    discount_amount: Decimal
    breakdown: PricingBreakdown
    assumptions: dict = field(default_factory=dict)


class PricingCalculator:
    """
    Serviço central de domínio de Negócios contendo todas as regras de cálculo e mark-up financeiro.

    Implementa a Metodologia v4 do Café com BPO com aritmética decimal exata e
    sem conexões com o banco de dados (Agnóstico).
    """

    @staticmethod
    def calculate_cost_per_hour(operation: OperationContext) -> Decimal:
        """
        Calcula o custo hora individual de um analista baseado na estrutura macro geral.

        Args:
            operation (OperationContext): O contexto apontando custo macro, horas trabalhadas no mês e número de funcionários.

        Returns:
            Decimal: O custo por pessoa a cada 1 hora nominal.

        Raises:
            ValueError: Se os atributos de quantidade e divisor (Tempo, Pessoas) resultarem em divisões por zero ou forem inválidos.
        """
        if getattr(operation, "total_cost", ZERO) < ZERO:
            raise ValueError("O custo total da operação não pode ser negativo.")
        if getattr(operation, "people_count", 0) <= 0:
            raise ValueError("A quantidade de pessoas deve ser maior que zero.")
        if getattr(operation, "hours_per_month", ZERO) <= 0:
            raise ValueError("A quantidade de horas por mês deve ser maior que zero.")

        total_hours = Decimal(str(operation.people_count)) * operation.hours_per_month
        return operation.total_cost / total_hours

    @staticmethod
    def calculate_cost_per_minute(operation: OperationContext) -> Decimal:
        """
        Extrai o custo fracionário equivalente por minuto de base.

        Args:
            operation (OperationContext): O contexto para derivar o resultado pelo divisor de sub-minuto de 60.

        Returns:
            Decimal: O custo decimal médio representativo para 1 minuto de atividade.
        """
        cost_per_hour = PricingCalculator.calculate_cost_per_hour(operation)
        return cost_per_hour / Decimal(60)

    @staticmethod
    def calculate_service_cost(
        service: ServiceItem, cost_per_minute: Decimal
    ) -> Decimal:
        """
        Calcula o custo de um único serviço na prateleira contábil.

        Serviços por tempo multiplicam minutos pela quantidade mensal pelo custo
        por minuto; serviços fixos multiplicam o valor fixo pela quantidade mensal.
        Quantidade zerada cai para 1, preservando o comportamento do simulador.

        Args:
            service (ServiceItem): Descritores quantitativos, tipo e alocações de minutos de execução.
            cost_per_minute (Decimal): Padrão associado ao tempo contábil dinâmico geral fornecido do context.

        Returns:
            Decimal: O valor final monetário a ser provisionado neste item (sem margem em cima).
        """
        quantity = service.monthly_quantity or 1
        if service.type == "fixed":
            return (service.fixed_value or ZERO) * quantity
        minutes = service.minutes_per_execution or ZERO
        return minutes * quantity * cost_per_minute

    @staticmethod
    def calculate_total_service_cost(
        services: list[ServiceItem], cost_per_minute: Decimal
    ) -> Decimal:
        """
        Acumula o custo bruto dos serviços ativos orçados.

        Serviços inativos não são cobrados: eles permanecem no formulário para
        edição futura, mas ficam fora do preço.

        Args:
            services (list[ServiceItem]): Todos os itens do "carrinho" do orçamento.
            cost_per_minute (Decimal): Base por minuto da empresa.

        Returns:
            Decimal: Somatório da representação bruta unitária de custo dos serviços ativos.
        """
        return sum(
            (
                PricingCalculator.calculate_service_cost(s, cost_per_minute)
                for s in services
                if s.active
            ),
            ZERO,
        )

    @staticmethod
    def calculate_profit_amount(
        base_cost: Decimal, desired_profit_margin: Decimal
    ) -> Decimal:
        """
        Identifica o montante bruto gerado apenas como lucro pelo markup desejado.

        Args:
            base_cost (Decimal): O custo que cobre a execução dos serviços.
            desired_profit_margin (Decimal): Margem percentual fracionada (ex.: 0.2 para 20%).

        Returns:
            Decimal: O montante monetário de lucro embutido nesta margem.

        Raises:
            ValueError: Se a margem for negativa.
        """
        if desired_profit_margin < ZERO:
            raise ValueError("A margem de lucro não pode ser negativa.")
        return base_cost * desired_profit_margin

    @staticmethod
    def calculate_tax_amount(
        price_before_tax: Decimal,
        tax_rate: Decimal,
        commission_rate: Decimal = ZERO,
    ) -> Decimal:
        """
        Calcula o volume percentual absorvido por impostos e comissão sobre o preço final.

        Impostos e comissão entram no mesmo denominador do mark-up, garantindo que
        ambos sejam recolhidos sobre o preço de venda ao cliente.

        Args:
            price_before_tax (Decimal): Custo dos serviços acrescido do lucro.
            tax_rate (Decimal): Alíquota percentual (ex.: 6 para 6%).
            commission_rate (Decimal): Comissão percentual (ex.: 5 para 5%).

        Returns:
            Decimal: Quantia fiscal e de comissão embutida no preço final.

        Raises:
            ValueError: Se a soma de impostos e comissão alcançar 100%.
        """
        combined_rate = (tax_rate + commission_rate) / Decimal(100)
        if combined_rate >= Decimal(1):
            raise ValueError("A soma de imposto e comissão deve ser menor que 100%.")
        final_price_with_tax = price_before_tax / (Decimal(1) - combined_rate)
        return final_price_with_tax - price_before_tax

    @staticmethod
    def calculate_term_discount(
        price_before_discount: Decimal, term_discount: Decimal
    ) -> tuple[Decimal, Decimal]:
        """
        Aplica o desconto de prazo contratado (mensal, trimestral ou anual).

        Args:
            price_before_discount (Decimal): Preço já com impostos e comissão.
            term_discount (Decimal): Desconto fracionado (ex.: 0.1 para 10%).

        Returns:
            tuple[Decimal, Decimal]: O valor do desconto e o preço final, nunca negativo.

        Raises:
            ValueError: Se o desconto for negativo.
        """
        if term_discount < ZERO:
            raise ValueError("O desconto de prazo não pode ser negativo.")
        discount_amount = price_before_discount * term_discount
        return discount_amount, max(price_before_discount - discount_amount, ZERO)

    @staticmethod
    def calculate_final_price(pricing_input: PricingInput) -> PricingResult:
        """
        Rotina principal. Encadeia as etapas da Metodologia v4 e devolve a ficha completa.

        A ordem das operações é normativa: custo por minuto, custo dos serviços
        ativos, margem de lucro, mark-up de impostos e comissão e, por último, o
        desconto de prazo. Valores monetários são arredondados a centavos apenas
        na saída; as taxas intermediárias permanecem em precisão total.

        Args:
            pricing_input (PricingInput): Contextualização completa combinando operação, serviços, margem e prazo.

        Returns:
            PricingResult: Consolidado e faturado DTO para resposta de interface.

        Raises:
            ValueError: Se qualquer validação de contexto, margem, impostos ou desconto falhar.
        """
        operation = pricing_input.operation
        cost_per_hour = PricingCalculator.calculate_cost_per_hour(operation)
        cost_per_minute = PricingCalculator.calculate_cost_per_minute(operation)

        active_services = [s for s in pricing_input.services if s.active]
        service_costs = [
            ServiceCost(
                name=s.name,
                type=s.type,
                cost=PricingCalculator.calculate_service_cost(s, cost_per_minute),
                monthly_quantity=s.monthly_quantity or 1,
            )
            for s in active_services
        ]
        total_service_cost = sum((c.cost for c in service_costs), ZERO)

        profit_amount = PricingCalculator.calculate_profit_amount(
            total_service_cost, pricing_input.desired_profit_margin
        )
        price_before_tax = total_service_cost + profit_amount

        tax_amount = PricingCalculator.calculate_tax_amount(
            price_before_tax, operation.tax_rate, operation.commission_rate
        )
        price_before_discount = price_before_tax + tax_amount

        discount_amount, final_price = PricingCalculator.calculate_term_discount(
            price_before_discount, pricing_input.term_discount
        )

        breakdown = PricingBreakdown(
            cost_per_hour=cost_per_hour,
            cost_per_minute=cost_per_minute,
            service_costs=[
                ServiceCost(
                    name=c.name,
                    type=c.type,
                    cost=quantize_money(c.cost),
                    monthly_quantity=c.monthly_quantity,
                )
                for c in service_costs
            ],
            total_service_cost=quantize_money(total_service_cost),
            profit_amount=quantize_money(profit_amount),
            tax_amount=quantize_money(tax_amount),
        )

        return PricingResult(
            final_price=quantize_money(final_price),
            price_before_discount=quantize_money(price_before_discount),
            discount_amount=quantize_money(discount_amount),
            breakdown=breakdown,
            assumptions={
                "margin_used": str(pricing_input.desired_profit_margin),
                "tax_rate_used": str(operation.tax_rate),
                "commission_rate_used": str(operation.commission_rate),
                "term_discount_used": str(pricing_input.term_discount),
            },
        )
