import { z } from 'zod';

export const serviceItemSchema = z.object({
  name: z.string().min(1, 'Nome do serviço é obrigatório'),
  minutes_per_execution: z.number().min(0, 'Minutos não podem ser negativos'),
  monthly_quantity: z.number().min(0, 'Quantidade não pode ser negativa'),
  fixed_value: z.number().optional(),
});

export type ServiceItemFormData = z.infer<typeof serviceItemSchema>;

export const operationContextSchema = z.object({
  total_cost: z.number().min(0, 'Custo total não pode ser negativo'),
  people_count: z.number().min(1, 'A operação precisa de pelo menos 1 pessoa'),
  hours_per_month: z.number().min(1, 'Horas por mês deve ser pelo menos 1'),
  tax_rate: z.number().min(0).max(1, 'A taxa deve estar entre 0 e 1 (ex. 0.15)'),
});

export type OperationContextFormData = z.infer<typeof operationContextSchema>;

export const pricingFormSchema = z.object({
  operation: operationContextSchema,
  services: z.array(serviceItemSchema).min(1, 'Adicione pelo menos um serviço para o cálculo'),
  desired_profit_margin: z.number().min(0, 'Margem de lucro não pode ser negativa'),
});

export type PricingFormData = z.infer<typeof pricingFormSchema>;
