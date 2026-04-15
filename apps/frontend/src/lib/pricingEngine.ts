/**
 * Motor de precificação local — Metodologia Café com BPO (v4)
 * 
 * Este motor espelha a lógica da planilha oficial e do simulador HTML.
 * A principal característica é o markup sobre o faturamento para impostos 
 * e comissões, garantindo que a margem de lucro seja real.
 */

export interface OperationInput {
  total_cost: number;
  people_count: number;
  hours_per_month: number;
  tax_rate: number;
  commission_rate: number;
}

export interface ServiceInput {
  id?: number;
  name: string;
  type: 'time' | 'fixed';
  minutes_per_execution: number;
  fixed_value: number;
  monthly_quantity: number;
  active: boolean;
  tip?: string;
}

export interface ServiceCostItem {
  name: string;
  type: 'time' | 'fixed';
  cost: number;
  monthly_quantity: number;
}

export interface PricingBreakdown {
  cost_per_hour: number;
  cost_per_minute: number;
  service_costs: ServiceCostItem[];
  total_service_cost: number;
  profit_amount: number;
  tax_amount: number;
}

export interface PricingResult {
  /** Preço final com desconto de prazo aplicado */
  final_price: number;
  /** Preço base antes do desconto de prazo (Subtotal) */
  price_before_discount: number;
  /** Valor absoluto do desconto de prazo */
  discount_amount: number;
  breakdown: PricingBreakdown;
}

/**
 * Calcula o preço final de uma proposta BPO.
 * 
 * Pipeline Metodologia v4:
 *   1. Custo Operacional: cost_per_min = total_cost / (people * hours * 60)
 *   2. Custo do Serviço: (tempo * qty * cost_per_min) OU (valor_fixo * qty)
 *   3. Margem de Lucro: total_service_cost * margin
 *   4. Preço com Impostos (Markup): (Custo + Lucro) / (1 - Impostos - Comissão)
 *   5. Desconto de Prazo: Preço Final = Preço com Impostos * (1 - desconto)
 */
export function calculatePricing(
  operation: OperationInput,
  services: ServiceInput[],
  desired_profit_margin: number,
  term_discount = 0,
): PricingResult | null {
  const { total_cost, people_count, hours_per_month, tax_rate, commission_rate } = operation;

  // Guarda de divisão por zero
  if (people_count <= 0 || hours_per_month <= 0) return null;

  // Passo 1 — Custo por minuto da operação
  const total_hours = people_count * hours_per_month;
  const cost_per_hour = total_cost / total_hours;
  const cost_per_minute = cost_per_hour / 60;

  // Passo 2 — Soma dos custos de todos os serviços ativos
  const activeServices = services.filter(s => s.active);

  const service_costs: ServiceCostItem[] = activeServices.map(s => ({
    name: s.name,
    type: s.type,
    monthly_quantity: s.monthly_quantity || 1,
    cost: s.type === 'fixed'
      ? (s.fixed_value || 0) * (s.monthly_quantity || 1)
      : (s.minutes_per_execution || 0) * (s.monthly_quantity || 1) * cost_per_minute,
  }));

  const total_service_cost = service_costs.reduce((acc, s) => acc + s.cost, 0);

  // Passo 3 — Lucro desejado
  const profit_amount = total_service_cost * desired_profit_margin;
  const price_before_tax = total_service_cost + profit_amount;

  // Passo 4 — Markup de Impostos e Comissão (Fator de Divisão)
  // O markup garante que os impostos sejam calculados sobre o preço de venda final.
  const tax_rate_pct = (tax_rate || 0) / 100;
  const commission_rate_pct = (commission_rate || 0) / 100;
  const tax_commission_sum = tax_rate_pct + commission_rate_pct;
  const denominator = 1 - tax_commission_sum;
  
  // Proteção contra denominador zero ou negativo (markup > 100%)
  const price_with_tax = denominator > 0 
    ? price_before_tax / denominator 
    : price_before_tax * (1 + tax_commission_sum);

  const tax_amount = price_with_tax - price_before_tax;

  // Passo 5 — Aplicação do desconto de prazo (Mensal, Trimestral, Anual)
  const price_before_discount = price_with_tax;
  const discount_amount = price_before_discount * (term_discount || 0);
  const final_price = price_before_discount - discount_amount;

  return {
    final_price: Math.max(0, final_price),
    price_before_discount,
    discount_amount,
    breakdown: {
      cost_per_hour,
      cost_per_minute,
      service_costs,
      total_service_cost,
      profit_amount,
      tax_amount,
    },
  };
}
