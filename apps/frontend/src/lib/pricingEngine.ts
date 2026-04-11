/**
 * Motor de precificação local — espelho de apps/backend/src/domain.py
 *
 * Se a lógica de cálculo mudar no Python (PricingCalculator),
 * este arquivo deve ser atualizado em sincronia.
 *
 * Vantagem: cálculo instantâneo no cliente, sem latência de rede.
 * O backend é acionado apenas para persistir a proposta aprovada no BD.
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
  /** Preço base antes do desconto de prazo */
  price_before_discount: number;
  /** Valor absoluto do desconto de prazo */
  discount_amount: number;
  breakdown: PricingBreakdown;
}

/**
 * Calcula o preço final de uma proposta BPO.
 * Retorna null se os parâmetros operacionais forem inválidos (pessoas/horas = 0).
 *
 * Pipeline (igual ao Python):
 *   1. cost_per_hour  = total_cost / (people_count × hours_per_month)
 *   2. cost_per_min   = cost_per_hour / 60
 *   3. service_cost   = (min × qty × cost_per_min) | fixed_value × qty
 *   4. profit_amount  = total_service_cost × margin
 *   5. tax markup     = price_before_tax / (1 - tax_rate) — fórmula do domain.py
 *   6. final_price    = price_with_tax × (1 - term_discount)
 */
export function calculatePricing(
  operation: OperationInput,
  services: ServiceInput[],
  desired_profit_margin: number,
  term_discount = 0,
): PricingResult | null {
  const { total_cost, people_count, hours_per_month, tax_rate, commission_rate } = operation;

  // Guarda de divisão por zero — mesmo comportamento do PricingCalculator.calculate_cost_per_hour
  if (people_count <= 0 || hours_per_month <= 0) return null;

  // Passo 1 — custo por hora e por minuto
  const total_hours = people_count * hours_per_month;
  const cost_per_hour = total_cost / total_hours;
  const cost_per_minute = cost_per_hour / 60;

  // Passo 2 — custo por serviço ativo
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

  // Passo 3 — margem de lucro
  const profit_amount = total_service_cost * desired_profit_margin;
  const price_before_tax = total_service_cost + profit_amount;

  // Passo 4 — impostos + comissão via markup (ref: PricingCalculator.calculate_tax_amount)
  // Fórmula: price_with_tax = price_before_tax / (1 - tax_rate)
  const effective_tax_rate = Math.min((tax_rate || 0) + (commission_rate || 0), 0.9999);
  const price_with_tax = price_before_tax / (1 - effective_tax_rate);
  const tax_amount = price_with_tax - price_before_tax;

  // Passo 5 — desconto de prazo
  const price_before_discount = price_with_tax;
  const discount_amount = price_before_discount * (term_discount || 0);
  const final_price = price_before_discount - discount_amount;

  return {
    final_price,
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
