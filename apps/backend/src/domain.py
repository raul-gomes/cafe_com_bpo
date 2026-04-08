from dataclasses import dataclass, field
from decimal import Decimal
from typing import List, Optional

@dataclass
class OperationContext:
    """
    Modelo de domínio que representa o contexto operacional.
    
    Acondiciona os custos inerentes à operação para cálculo do custo homem hora/minuto.
    """
    total_cost: Decimal
    people_count: int
    hours_per_month: Decimal
    tax_rate: Decimal


@dataclass
class ServiceItem:
    """
    Modelo de domínio que representa um serviço na precificação.
    
    Define o escopo de uso temporal ou restringe para um valor fixo de determinado serviço de BPO.
    """
    name: str
    minutes_per_execution: Decimal
    monthly_quantity: int
    fixed_value: Optional[Decimal] = None


@dataclass
class PricingInput:
    """
    Modelo de domínio como Objeto de Transferência de Dados para os Cálculos (Input).
    
    Agrega toda a operação macro, a lista de serviços selecionados e a qual margem a empresa deseja.
    """
    operation: OperationContext
    services: List[ServiceItem]
    desired_profit_margin: Decimal


@dataclass
class PricingBreakdown:
    """
    Modelo de domínio com descritivo dos valores internos.
    
    Permite rastrear em uma requisição real como o calculador chegou aos valores por quebras.
    """
    cost_per_hour: Decimal
    cost_per_minute: Decimal
    service_costs: List[Decimal]
    total_service_cost: Decimal
    profit_amount: Decimal
    tax_amount: Decimal


@dataclass
class PricingResult:
    """
    Modelo de domínio representando a resposta validada da simulação inteira.
    
    Integra o preço final ao cliente, e todos os fracionamentos (breakdown) para registro.
    """
    final_price: Decimal
    breakdown: PricingBreakdown
    assumptions: dict = field(default_factory=dict)


class PricingCalculator:
    """
    Serviço central de domínio de Negócios contendo todas as regras de cálculo e mark-up financeiro.
    
    Utiliza as equações aprovadas e puras sem conexões com o banco de dados (Agnóstico).
    """

    @staticmethod
    def calculate_cost_per_hour(operation: OperationContext) -> Decimal:
        """
        Calcula o custo hora individual de um analista baseado na estrutura macro geral.

        Args:
            operation (OperationContext): O contexto apontando custo macro, horas trabalhadas no mês e número de funcionários.
        
        Returns:
            Decimal: O custo em espécie por pessoa a cada 1 hora nominal.
            
        Raises:
            ValueError: Se os atributos de quantidade e divisor (Tempo, Pessoas) resultarem em divisões por zero ou forem inválidos.
        """
        if getattr(operation, 'total_cost', Decimal("0")) < Decimal("0"):
            raise ValueError("O custo total da operação não pode ser negativo.")
        if getattr(operation, 'people_count', 0) <= 0:
            raise ValueError("A quantidade de pessoas deve ser maior que zero.")
        if getattr(operation, 'hours_per_month', Decimal("0")) <= Decimal("0"):
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
        return cost_per_hour / Decimal("60")

    @staticmethod
    def calculate_service_cost(service: ServiceItem, cost_per_minute: Decimal) -> Decimal:
        """
        Calcula de fato o escopo isolado de um único serviço na prateleira contábil.

        A equação respeitará um `fixed_value` se explicitamente fornecido. Caso contrário, irá cruzar a quantidade X tempo pelo preço.

        Args:
            service (ServiceItem): Descritores quantitativos e alocações de minutos de execução.
            cost_per_minute (Decimal): Padrão associado ao tempo contábil dinâmico geral fornecido do context.
        
        Returns:
            Decimal: O valor final monetário a ser provisionado num pool de serviços global para este item (Sem margem em cima).
        """
        if getattr(service, "fixed_value", None) is not None:
            return service.fixed_value
        total_minutes = service.minutes_per_execution * Decimal(str(service.monthly_quantity))
        return total_minutes * cost_per_minute

    @staticmethod
    def calculate_total_service_cost(services: List[ServiceItem], cost_per_minute: Decimal) -> Decimal:
        """
        Acumulador bruto de uma grade modular de N serviços de BPO para extração contábil do pacote.

        Args:
            services (List[ServiceItem]): Todos os itens do "carrinho" do orçamento.
            cost_per_minute (Decimal): Base por minuto da empresa.

        Returns:
            Decimal: Somatório da representação bruta unitária de custo dos serviços combinados.
        """
        return sum(
            (PricingCalculator.calculate_service_cost(s, cost_per_minute) for s in services),
            Decimal("0")
        )

    @staticmethod
    def calculate_profit_amount(base_cost: Decimal, desired_profit_margin: Decimal) -> Decimal:
        """
        Identifica especificamente o pedaço em montante bruto gerado apenas como `Lucro` em decorrência de um markup desejado.

        Args:
            base_cost (Decimal): O custo que cobre a execução dos serviços (base de custo de pacote).
            desired_profit_margin (Decimal): Margem percentual.
        
        Returns:
            Decimal: O montante monetário de lucro provindo desta margem na composição.
        """
        return base_cost * desired_profit_margin

    @staticmethod
    def calculate_tax_amount(price_before_tax: Decimal, tax_rate: Decimal) -> Decimal:
        """
        Calcula o volume percentual real absorvido pelos impostos considerando as lógicas e equações contábeis do país (`Markup/Tax`).

        Args:
            price_before_tax (Decimal): Valor dos custos base + lucros líquidos embutidos esperando a tributação final por sobre eles (Simples/Lucro Presumido).
            tax_rate (Decimal): Taxa que será convertida em montante fiscal da operação.
        
        Returns:
            Decimal: Quantia fiscal referente a impostos deduzidos nesta negociação.
        """
        if tax_rate >= Decimal("1"):
            raise ValueError("A taxa de imposto deve ser menor que 1 (100%).")
        # Formula convencional de mark-up para absorcao de imposto: 
        # Price_Before_Tax / (1 - Tax_Rate) acha o valor total bruto, subtraindo acha só o tributo embutido nele.
        final_price_with_tax = price_before_tax / (Decimal("1") - tax_rate)
        return final_price_with_tax - price_before_tax

    @staticmethod
    def calculate_final_price(pricing_input: PricingInput) -> PricingResult:
        """
        Rotina principal. Orquestra as sub-funções sequenciais num encadeamento lógico para estabelecer a ficha completa.

        Executa os devidos validadores garantindo `ValueError` nos context levels de base. O pipeline engloba a base, o carrinho de `Services` contra `cost_per_minute`, 
        sobrepõe a `Margin` em profit e fecha o fechamento em `Tax` mark-up por imposto real para o `Final_Price` de apresentação do cliente.

        Args:
            pricing_input (PricingInput): Contextualização completa combinando operação, serviços e margem.
        
        Returns:
            PricingResult: Consolidado e faturado DTO para resposta de interface.
        """
        cost_per_hour = PricingCalculator.calculate_cost_per_hour(pricing_input.operation)
        cost_per_minute = PricingCalculator.calculate_cost_per_minute(pricing_input.operation)
        
        service_costs = [
            PricingCalculator.calculate_service_cost(s, cost_per_minute) 
            for s in pricing_input.services
        ]
        total_service_cost = sum(service_costs, Decimal("0"))
        
        profit_amount = PricingCalculator.calculate_profit_amount(total_service_cost, pricing_input.desired_profit_margin)
        price_before_tax = total_service_cost + profit_amount
        
        tax_amount = PricingCalculator.calculate_tax_amount(price_before_tax, pricing_input.operation.tax_rate)
        
        final_price = price_before_tax + tax_amount
        
        breakdown = PricingBreakdown(
            cost_per_hour=cost_per_hour,
            cost_per_minute=cost_per_minute,
            service_costs=service_costs,
            total_service_cost=total_service_cost,
            profit_amount=profit_amount,
            tax_amount=tax_amount
        )
        
        return PricingResult(
            final_price=final_price,
            breakdown=breakdown,
            assumptions={
                "margin_used": str(pricing_input.desired_profit_margin),
                "tax_rate_used": str(pricing_input.operation.tax_rate)
            }
        )
