import { Link } from 'react-router-dom';
import { Archive, Handshake, Lock, MessagesSquare } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button, buttonVariants } from '../ui/button';
import { Card } from '../ui/card';
import type { ProjectResponse } from '../../api/network';

export interface ProjetosCardProps {
  project: ProjectResponse;
  /** Só o dono arquiva — a lista passa a ação para quem pode. */
  onArchive: (project: ProjectResponse) => void;
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** Card da lista de Gestão › Projetos.
 *
 * O mural do fórum é a vitrine pública; aqui o dono olha o que é dele: quantas
 * propostas estão esperando, se ainda está recebendo propostas, e os atalhos
 * para o detalhe e para o tópico do projeto. */
export function ProjetosCard({ project, onArchive }: ProjetosCardProps) {
  return (
    <Card className="p-5 transition-colors hover:bg-muted/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold text-foreground">
            <Link
              to={`/painel/projetos/${project.id}`}
              className="hover:underline"
            >
              {project.title}
            </Link>
          </div>
          <div className="mt-1 mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span>
              Atualizado em {dataCurta(project.updated_at)}
            </span>
            {project.owner ? (
              <>
                <span className="opacity-30">|</span>
                <span>Criado por {project.owner.name || project.owner.email}</span>
              </>
            ) : null}
          </div>

          <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {project.description}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {project.application_count > 0 ? (
              <Badge>
                <Handshake className="mr-1 size-3" />
                {project.application_count}{' '}
                {project.application_count === 1
                  ? 'nova proposta'
                  : 'novas propostas'}
              </Badge>
            ) : null}
            {project.applications_closed ? (
              <Badge variant="outline">
                <Lock className="mr-1 size-3" />
                Propostas fechadas
              </Badge>
            ) : null}
            {project.skills.length > 0 ? (
              project.skills.map((skill) => (
                <span
                  key={skill.id}
                  className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-strong"
                >
                  {skill.name}
                </span>
              ))
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Link
            to={`/painel/projetos/${project.id}`}
            aria-label={`Abrir projeto ${project.title}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Abrir projeto
          </Link>
          {project.group_id && (project.is_owner || project.is_group_member) ? (
            <Link
              to={`/painel/grupos/${project.group_id}`}
              aria-label={`Ver tópico de ${project.title}`}
              title="Ver o tópico do projeto"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              <MessagesSquare className="size-4" />
            </Link>
          ) : null}
          {project.is_owner ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Arquivar ${project.title}`}
              onClick={() => onArchive(project)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Archive className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
