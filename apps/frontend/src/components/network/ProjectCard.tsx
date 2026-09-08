import { Trash2, Users } from 'lucide-react';
import { ProjectResponse } from '../../api/network';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface ProjectCardProps {
  project: ProjectResponse;
  currentUserId?: string | null;
  onDelete?: (project: ProjectResponse) => void;
}

const REMOTE_LABELS: Record<string, string> = {
  remote: 'Remoto',
  onsite: 'Presencial',
  hybrid: 'Híbrido',
};

export function ProjectCard({
  project,
  currentUserId,
  onDelete,
}: ProjectCardProps) {
  const isOwner = currentUserId != null && currentUserId === project.owner_id;
  const remoteLabel = REMOTE_LABELS[project.remote_type] ?? project.remote_type;

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

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] font-semibold text-primary-strong">
              <Users size={11} />
              Equipe de {project.team_size} {project.team_size === 1 ? 'pessoa' : 'pessoas'}
            </span>
            <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
              {remoteLabel}
            </span>
            {project.skills.map((skill) => (
              <span
                key={skill.id}
                className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-strong"
              >
                {skill.name}
              </span>
            ))}
          </div>
        </div>

        {isOwner && onDelete && (
          <div className="shrink-0">
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