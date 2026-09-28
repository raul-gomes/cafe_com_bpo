import { z } from 'zod';

/** Formulário de projeto do mural (criação e edição).
 *
 * `title` tem o mesmo teto do backend (160); `description` é livre de teto
 * porque a coluna é `Text` e a API só exige 10 caracteres. `skills` é a lista
 * de habilidades do catálogo global, como o mural já fazia. */
export const projetoFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Informe o título do projeto')
    .max(160, 'Título muito longo'),
  description: z
    .string()
    .trim()
    .min(10, 'A descrição precisa ter pelo menos 10 caracteres'),
  skills: z.array(z.string().trim().min(1)),
});

export type ProjetoFormData = z.infer<typeof projetoFormSchema>;

export const EMPTY_PROJETO_FORM: ProjetoFormData = {
  title: '',
  description: '',
  skills: [],
};

/** Corpo enviado ao backend: espaços removidos e habilidade repetida eliminada. */
export function toProjetoPayload(data: ProjetoFormData) {
  const skills = [...new Set(data.skills.map((s) => s.trim()).filter(Boolean))];
  return {
    title: data.title.trim(),
    description: data.description.trim(),
    skills,
  };
}
