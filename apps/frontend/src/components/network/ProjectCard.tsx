import { Pencil, Trash2 } from 'lucide-react';
import { ProjectResponse } from '../../api/network';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface ProjectCardProps {
  project: ProjectResponse;
  currentUserId?: string | null;
  onEdit?: (project: ProjectResponse) => void;
  onDelete?: (project: ProjectResponse) => void;
}

export function ProjectCard({
  project,
  currentUserId,
  onEdit,
  onDelete,
}: ProjectCardProps) {
  const isOwner = currentUserId != null && currentUserId === project.owner_id;

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

        {isOwner && (onEdit || onDelete) && (
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(project)}
                aria-label={`Editar projeto ${project.title}`}
              >
                <Pencil size={15} />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(project)}
                aria-label={`Excluir projeto ${project.title}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={15} />
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}