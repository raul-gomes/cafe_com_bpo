import { z } from 'zod';

export const serviceItemSchema = z.object({
  id: z.number().optional(),
  active: z.boolean().default(true),
  name: z.string().min(1, 'Nome do serviço é obrigatório'),
  type: z.enum(['time', 'fixed']),
  minutes_per_execution: z.number().min(0),
  monthly_quantity: z.number().min(0, 'Quantidade não pode ser negativa'),
  fixed_value: z.number().default(0),
  tip: z.string().optional(),
});

// Usamos o tipo OUTPUT do Zod (pós-defaults aplicados) — resolve `undefined` para `number`
export type ServiceItemFormData = z.output<typeof serviceItemSchema>;

export const operationContextSchema = z.object({
  total_cost: z.number().min(0, 'Custo total não pode ser negativo'),
  people_count: z.number().min(1, 'A operação precisa de pelo menos 1 pessoa'),
  hours_per_month: z.number().min(1, 'Horas por mês deve ser pelo menos 1'),
  tax_rate: z.number().min(0).max(100, 'A taxa deve ser no máximo 100%'),
  commission_rate: z.number().min(0).max(100).default(0),
});

export type OperationContextFormData = z.output<typeof operationContextSchema>;

export const pricingFormSchema = z.object({
  operation: operationContextSchema,
  services: z.array(serviceItemSchema),
  desired_profit_margin: z.number().min(0, 'Margem de lucro não pode ser negativa'),
  term_discount: z.number().min(0).default(0),
});

// CRÍTICO: z.output para que campos com .default() sejam obrigatórios no tipo
export type PricingFormData = z.output<typeof pricingFormSchema>;
