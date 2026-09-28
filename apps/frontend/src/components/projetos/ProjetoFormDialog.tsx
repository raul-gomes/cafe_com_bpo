import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { SkillInput } from '../ui/SkillInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  EMPTY_PROJETO_FORM,
  projetoFormSchema,
  type ProjetoFormData,
} from '../../schemas/projects';
import type { ProjectResponse } from '../../api/network';

export interface ProjetoFormDialogProps {
  open: boolean;
  /** Projeto em edição; `null` = novo projeto. */
  project: ProjectResponse | null;
  onClose: () => void;
  onSubmit: (data: ProjetoFormData) => Promise<void>;
}

/** Cadastro/edição de projeto do mural.
 *
 * O mesmo formulário serve para criar e para editar: no fórum o projeto é a
 * vitrine pública, então título, descrição e habilidades são os dados que o
 * dono controla. Convidar gente é ação da aba Equipe, não do cadastro. */
export function ProjetoFormDialog({
  open,
  project,
  onClose,
  onSubmit,
}: ProjetoFormDialogProps) {
  const [form, setForm] = useState<ProjetoFormData>(EMPTY_PROJETO_FORM);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(
      project
        ? {
            title: project.title,
            description: project.description,
            skills: project.skills.map((s) => s.name),
          }
        : EMPTY_PROJETO_FORM
    );
    setErro('');
  }, [open, project])

  const handleSubmit = async () => {
    const resultado = projetoFormSchema.safeParse(form);
    if (!resultado.success) {
      setErro(resultado.error.issues[0]?.message ?? 'Revise os dados');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await onSubmit(resultado.data);
    } catch {
      setErro('Não foi possível salvar o projeto.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:!max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? 'Editar projeto' : 'Novo projeto'}</DialogTitle>
          <DialogDescription>
            O projeto aparece no mural de projetos da Comunidade. Convidar
            profissionais é feito depois, na aba Equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="projeto-titulo">Título</Label>
            <Input
              id="projeto-titulo"
              value={form.title}
              onChange={(e) => setForm((a) => ({ ...a, title: e.target.value }))}
              placeholder="Ex: Implantação de BPO financeiro"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="projeto-descricao">Descrição</Label>
            <Textarea
              id="projeto-descricao"
              rows={5}
              value={form.description}
              onChange={(e) =>
                setForm((a) => ({ ...a, description: e.target.value }))
              }
              placeholder="Descreva o escopo e o que você espera dos profissionais..."
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="projeto-skills">Habilidades necessárias</Label>
            <SkillInput
              id="projeto-skills"
              ariaLabel="Habilidades necessárias"
              value={form.skills}
              onChange={(skills) => setForm((a) => ({ ...a, skills }))}
              placeholder="Digite uma habilidade e pressione Tab ou Enter"
            />
            <p className="text-[11px] text-muted-foreground">
              As habilidades também alimentam a busca de profissionais
              compatíveis na aba Equipe.
            </p>
          </div>

          {erro ? (
            <p role="alert" className="text-[13px] font-medium text-destructive">
              {erro}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar projeto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
