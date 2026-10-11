import { z } from 'zod';

/**
 * Cliente (empresa em estágio `client`) como a tela de empresas renderiza.
 *
 * Contrato §6: o backend responde só o que algum componente lê. A auditoria
 * (`user_id`, `created_at`, `updated_at`) saiu do payload — a tela mostra nome,
 * documento, segmento, contato e endereço, e nada mais. O dono já está
 * implícito: `/clients/` devolve apenas as empresas do próprio usuário.
 *
 * `cnpj`, `telefone` e afins continuam com o nome do contrato em português
 * porque são vocabulário de produto exibido na tela e preenchido no formulário.
 *
 * O tipo é inferido do schema, para que o contrato tenha um lugar só.
 *
 * `.strict()` de propósito: o Zod **descarta** chaves desconhecidas por padrão,
 * então um campo que voltou a ser enviado passaria silenciosamente. Com
 * `.strict()`, a deriva vira falha — no teste primeiro, na tela nunca.
 */
export const clientSchema = z.object({
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
}).strict();

export type ClientData = z.infer<typeof clientSchema>;

/** Corpo dos comandos de escrita: o mesmo cadastro, sem o `id`. */
export type ClientWrite = Omit<ClientData, 'id'>;
