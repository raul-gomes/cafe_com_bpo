import { Link } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { buttonVariants } from '../ui/button';
import { Card } from '../ui/card';
import { MemberLink } from '../network/MemberLink';
import type { ProjectGroupDetail, ProjectResponse } from '../../api/network';

export interface ProjetoTopicoPanelProps {
  project: ProjectResponse;
  group: ProjectGroupDetail | null;
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const ULTIMOS = 5;

/** Aba Tópico: as últimas publicações do tópico do projeto e o atalho para a
 * página completa, onde a conversa acontece em formato de fórum. */
export function ProjetoTopicoPanel({ project, group }: ProjetoTopicoPanelProps) {
  const posts = [...(group?.posts ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, ULTIMOS);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-foreground">
          Tópico do projeto
        </h2>
        {project.group_id ? (
          <Link
            to={`/painel/grupos/${project.group_id}`}
            aria-label="Abrir o tópico do projeto"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <MessagesSquare className="mr-1.5 size-4" />
            Abrir o tópico
          </Link>
        ) : null}
      </div>

      {posts.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.id} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <MemberLink
                  memberId={post.author.id}
                  name={post.author.name}
                  email={post.author.email}
                  className="font-semibold text-foreground"
                />
                <span className="opacity-30">|</span>
                <span>{dataCurta(post.created_at)}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-foreground">
                {post.body}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Nenhuma publicação no tópico ainda. Convide a equipe ou publique a
          primeira atualização.
        </p>
      )}
    </Card>
  )
}
