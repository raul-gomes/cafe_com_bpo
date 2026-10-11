import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'O e-mail é obrigatório').email('Formato de e-mail inválido'),
  password: z.string().min(1, 'A senha é obrigatória').min(6, 'A senha deve conter pelo menos 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().min(1, 'O e-mail é obrigatório').email('Formato de e-mail inválido'),
  company: z.string().optional(),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string(),
  terms: z.boolean().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
}).refine((data) => data.terms, {
  message: 'É necessário aceitar os Termos de Uso e Política de Privacidade (LGPD).',
  path: ['terms'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;
