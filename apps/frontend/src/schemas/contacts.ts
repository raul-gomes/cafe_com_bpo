import { z } from 'zod';

/** Estado do formulário: tudo string, porque é o que o <input> manipula.
 *  A normalização para a API (string -> null) é feita em `toContactPayload`. */
export const contactFormSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do contato').max(255, 'Nome muito longo'),
  telefone: z.string().trim().max(50, 'Telefone muito longo'),
  email: z
    .string()
    .trim()
    .max(255, 'E-mail muito longo')
    .email('E-mail inválido')
    .or(z.literal('')),
  empresa: z.string().trim().max(255, 'Nome da empresa muito longo'),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

export const EMPTY_CONTACT_FORM: ContactFormData = {
  nome: '',
  telefone: '',
  email: '',
  empresa: '',
};

/** Corpo enviado ao backend: campo em branco vira `null` (a coluna é nullable). */
export function toContactPayload(data: ContactFormData) {
  return {
    nome: data.nome,
    telefone: data.telefone || null,
    email: data.email || null,
    empresa: data.empresa || null,
  };
}
