import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';
import { PricingFormData } from '../../schemas/pricing';

export interface BreakdownResponse {
  cost_per_hour: number;
  cost_per_minute: number;
  service_costs: number[];
  total_service_cost: number;
  profit_amount: number;
  tax_amount: number;
}

export interface PricingResponse {
  final_price: number;
  breakdown: BreakdownResponse;
  assumptions: Record<string, any>;
}

export const useCalculatePricing = () => {
  return useMutation({
    mutationFn: async (data: PricingFormData): Promise<PricingResponse> => {
      // Ajuste de payload temporário no Client para casar com backend atual Phase 2, 
      // e os demais cálculos que não existem no v2 (desconto prazo e comissão) fazemos no client provisóriamente
      const response = await apiClient.post('/api/pricing/calculate', {
        operation: {
          total_cost: data.operation.total_cost,
          people_count: data.operation.people_count,
          hours_per_month: data.operation.hours_per_month,
          tax_rate: data.operation.tax_rate + (data.operation.commission_rate || 0), // acoplando imposto + comissao temporariamente para a API
        },
        services: data.services,
        desired_profit_margin: data.desired_profit_margin,
      });
      return response.data;
    }
  });
};
