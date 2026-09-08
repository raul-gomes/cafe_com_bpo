import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { ProjectResponse, ProjectUpdatePayload } from '../../api/network';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { SkillInput } from '../ui/SkillInput';

interface ProjectCardProps {
  project: ProjectResponse;
  currentUserId?: string | null;
  onSave: (
    project: ProjectResponse,
    payload: ProjectUpdatePayload
  ) => Promise<void>;
  onDelete: (project: ProjectResponse) => void;
}

export function ProjectCard({
  project,
  currentUserId,
  onSave,
  onDelete,
}: ProjectCardProps) {
  const isOwner = currentUserId != null && currentUserId === project.owner_id;

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [skills, setSkills] = useState<string[]>(
    project.skills.map((skill) => skill.name)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = () => {
    setTitle(project.title);
    setDescription(project.description);
    setSkills(project.skills.map((skill) => skill.name));
    setError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle || !cleanDescription) {
      setError('Preencha título e descrição do projeto.');
      return;
    }
    if (cleanDescription.length < 10) {
      setError('A descrição precisa ter pelo menos 10 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await onSave(project, {
        title: cleanTitle,
        description: cleanDescription,
        skills,
      });
      setIsEditing(false);
      setError('');
    } catch {
      setError('Erro ao salvar o projeto. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Card className="p-4">
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`edit-title-${project.id}`}
              className="text-[13px] font-medium text-foreground/80"
            >
              Título do Projeto
            </label>
            <Input
              id={`edit-title-${project.id}`}
              aria-label="Título do projeto"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`edit-description-${project.id}`}
              className="text-[13px] font-medium text-foreground/80"
            >
              Descrição
            </label>
            <Textarea
              id={`edit-description-${project.id}`}
              aria-label="Descrição do projeto"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-foreground/80">
              Habilidades necessárias
            </label>
            <SkillInput
              value={skills}
              onChange={setSkills}
              placeholder="Digite uma habilidade e pressione Tab ou Enter"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" variant="default" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Projeto'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEdit}
              disabled={saving}
              aria-label="Cancelar"
            >
              Cancelar
            </Button>
            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onDelete(project)}
                disabled={saving}
                aria-label={`Excluir projeto ${project.title}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={15} className="mr-1.5" />
                Excluir
              </Button>
            </div>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[16px] font-bold text-foreground">
            {project.title}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span>
              Por: {project.owner.name || project.owner.email || 'Usuário'}
            </span>
            <span className="opacity-30">|</span>
            <span>{new Date(project.created_at).toLocaleDateString('pt-BR')}</span>
          </div>

          {project.description && (
            <p className="mb-3 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          )}

          {project.skills.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {project.skills.map((skill) => (
                <span
                  key={skill.id}
                  className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-strong"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={startEdit}
              aria-label={`Editar projeto ${project.title}`}
            >
              <Pencil size={15} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(project)}
              aria-label={`Excluir projeto ${project.title}`}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={15} />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}