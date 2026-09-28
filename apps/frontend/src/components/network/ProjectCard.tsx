import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Handshake, Loader2, Lock, MessagesSquare, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { MemberLink } from './MemberLink';
import { applyToProject, type ProjectResponse } from '../../api/network';

export interface ProjectCardProps {
  project: ProjectResponse;
}

/** Card do mural de projetos no fórum — a **vitrine**.
 *
 * A gestão do projeto (criar, editar, convidar, avaliar propostas, arquivar) vive
 * em Gestão › Projetos: aqui o fórum só mostra o projeto e oferece a
 * candidatura. Quem é dono vê o atalho para gerenciar, e quem é membro do
 * projeto abre o tópico. */
export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const isOwner = project.is_owner;
  const myStatus = project.my_application_status;
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const openApply = () => {
    setError('');
    setIsApplying(true);
  };

  const closeApply = () => {
    setIsApplying(false);
    setMessage('');
    setError('');
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = message.trim();
    if (texto.length < 10) {
      setError('Escreva pelo menos 10 caracteres contando com o que você vai fazer no projeto.');
      return;
    }
    setSending(true);
    try {
      await applyToProject(project.id, { message: texto });
      toast.success('Proposta enviada. O dono do projeto vai avaliar.');
      closeApply();
    } catch {
      setError('Não foi possível enviar sua proposta. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[16px] font-bold text-foreground">
            {project.title}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span className="flex flex-wrap items-center gap-1">
              Por:{' '}
              <MemberLink
                memberId={project.owner.id}
                name={project.owner.name}
                email={project.owner.email}
              />
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

        {isOwner ? (
          <div className="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/painel/projetos/${project.id}`)}
              aria-label={`Gerenciar projeto ${project.title}`}
            >
              Gerenciar
            </Button>
          </div>
        ) : null}
      </div>

      {isOwner ? (
        <p className="mt-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
          Você criou este projeto. Convide, avalie propostas e edite em Gestão ›
          Projetos.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
          {project.applications_closed ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Lock size={13} />
              {myStatus
                ? 'Sua proposta foi enviada antes do fechamento.'
                : 'Este projeto está fechado para novas propostas.'}
            </div>
          ) : myStatus === 'accepted' ? (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-green-600">
              <CheckCircle2 size={14} />
              Proposta aceita — você é membro do projeto.
            </p>
          ) : myStatus === 'declined' ? (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <X size={14} />
              Sua proposta não foi aceita.
            </p>
          ) : myStatus ? (
            <p className="text-[12px] font-medium text-primary">
              Proposta enviada — aguardando avaliação do dono.
            </p>
          ) : (
            <Button
              variant={isApplying ? 'ghost' : 'outline'}
              size="sm"
              onClick={isApplying ? closeApply : openApply}
              aria-label={`Enviar proposta para ${project.title}`}
            >
              <Handshake size={14} className="mr-1.5" />
              {isApplying ? 'Cancelar' : 'Enviar proposta'}
            </Button>
          )}

          {isApplying && (
            <form
              onSubmit={handleApply}
              className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
            >
              <Label
                className="text-[13px] font-medium text-foreground/80"
                htmlFor={`apply-message-${project.id}`}
              >
                Por que você quer participar?
              </Label>
              <Textarea
                id={`apply-message-${project.id}`}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: Tenho 5 anos de experiência em conciliação bancária e posso contribuir desde já..."
              />
              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={sending}>
                  {sending ? (
                    <Loader2 size={15} className="mr-1.5 animate-spin" />
                  ) : (
                    <Send size={14} className="mr-1.5" />
                  )}
                  Enviar proposta
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {project.group_id && (isOwner || project.is_group_member) && (
        <div className="mt-4 border-t border-border pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/painel/grupos/${project.group_id}`)}
            aria-label="Ver tópico do projeto"
          >
            <MessagesSquare size={14} className="mr-1.5" />
            Ver tópico do projeto
          </Button>
        </div>
      )}
    </Card>
  );
}
