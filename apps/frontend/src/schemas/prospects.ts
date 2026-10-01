import { z } from 'zod';

/**
 * Prospecto como a tela de prospecção renderiza.
 *
 * Contrato §6: o backend responde só o que algum componente lê. Os campos de
 * ciclo de vida (`converted_at`, `reproved_at`, `converted_client_id`) e de
 * auditoria (`user_id`, `created_at`, `updated_at`) saíram do payload — quem
 * filtra a listagem é o servidor, então devolvê-los não mudava nada na tela.
 *
 * `representante_*` continua com o nome atual: é vocabulário de produto
 * renderizado no card e preenchido no formulário de edição. O valor vem do
 * contato (fonte única da pessoa, Fase 4).
 *
 * O tipo é inferido do schema, para que o contrato tenha um lugar só.
 */
export const prospectSchema = z.object({
  id: z.string(),
  name: z.string(),
  cnpj: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  segment: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  complement: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  representante_nome: z.string().nullable().optional(),
  representante_email: z.string().nullable().optional(),
  representante_cpf: z.string().nullable().optional(),
  representante_telefone: z.string().nullable().optional(),
  representante_cargo: z.string().nullable().optional(),
});

export type ProspectData = z.infer<typeof prospectSchema>;

/** Corpo dos comandos de escrita: o mesmo cadastro, sem o `id`. */
export type ProspectWrite = Omit<ProspectData, 'id'>;

/** Resposta da conversão: qual cliente nasceu do prospecto. */
export const prospectConvertResponseSchema = z.object({
  prospect_id: z.string(),
  client_id: z.string(),
});

export type ProspectConvertResponse = z.infer<typeof prospectConvertResponseSchema>;
