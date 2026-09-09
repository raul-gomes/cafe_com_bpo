import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Users,
  Send,
  CheckCircle2,
  Loader2,
  X,
  MessagesSquare,
  Handshake,
  Lock,
} from 'lucide-react';
import {
  createInvitation,
  getProjectInvitations,
  searchProfessionals,
  applyToProject,
  ProfessionalMatch,
  ProjectInvitation,
  ProjectResponse,
  ProjectUpdatePayload,
} from '../../api/network';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { SkillInput } from '../ui/SkillInput';
import { Badge } from '../ui/badge';
import { ProjectApplicationsPanel } from './ProjectApplicationsPanel';
import { cn } from '../../lib/utils';

interface ProjectCardProps {
  project: ProjectResponse;
  currentUserId?: string | null;
  onSave: (
    project: ProjectResponse,
    payload: ProjectUpdatePayload
  ) => Promise<void>;
  onDelete: (project: ProjectResponse) => void;
  onUpdated?: (project: ProjectResponse) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  declined: 'Recusado',
};

export function ProjectCard({
  project,
  currentUserId,
  onSave,
  onDelete,
  onUpdated,
}: ProjectCardProps) {
  const isOwner = currentUserId != null && currentUserId === project.owner_id;
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [skills, setSkills] = useState<string[]>(
    project.skills.map((skill) => skill.name)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [isInviting, setIsInviting] = useState(false);
  const [inviteSkills, setInviteSkills] = useState<string[]>([]);
  const [matches, setMatches] = useState<ProfessionalMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [invitees, setInvitees] = useState<ProjectInvitation[]>([]);
  const [selected, setSelected] = useState<ProfessionalMatch | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const [isApplying, setIsApplying] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationSending, setApplicationSending] = useState(false);
  const [applicationError, setApplicationError] = useState('');
  const [hasApplied, setHasApplied] = useState(false);
  const [showingApplications, setShowingApplications] = useState(false);

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

  const loadInvitees = async () => {
    try {
      setInvitees(await getProjectInvitations(project.id));
    } catch {
      setInvitees([]);
    }
  };

  const openInvites = () => {
    setIsInviting(true);
    setInviteSkills([]);
    setMatches([]);
    setSelected(null);
    setMessage('');
    setSendError('');
    loadInvitees();
  };

  const closeInvites = () => {
    setIsInviting(false);
    setInviteSkills([]);
    setMatches([]);
    setSelected(null);
    setMessage('');
    setSendError('');
  };

  useEffect(() => {
    if (!isInviting || inviteSkills.length === 0) {
      setMatches([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    setSearching(true);
    setSearchError('');
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchProfessionals(inviteSkills, 'any');
        if (!cancelled) setMatches(results);
      } catch {
        if (!cancelled) {
          setSearchError('Erro ao buscar profissionais. Tente novamente.');
          setMatches([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isInviting, inviteSkills]);

  const handleSendInvite = async () => {
    if (!selected) return;
    if (!message.trim()) {
      setSendError('Escreva uma mensagem personalizada para o convite.');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      await createInvitation(project.id, {
        invited_user_id: selected.id,
        message: message.trim(),
      });
      toast.success(`Convite enviado para ${selected.name || selected.email}`);
      setSelected(null);
      setMessage('');
      loadInvitees();
    } catch {
      setSendError('Erro ao enviar o convite. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const openApply = () => {
    setIsApplying(true);
    setApplicationMessage('');
    setApplicationError('');
  };

  const closeApply = () => {
    setIsApplying(false);
    setApplicationMessage('');
    setApplicationError('');
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationMessage.trim()) {
      setApplicationError('Escreva por que você quer participar deste projeto.');
      return;
    }
    if (applicationMessage.trim().length < 10) {
      setApplicationError('A proposta precisa ter pelo menos 10 caracteres.');
      return;
    }
    setApplicationSending(true);
    setApplicationError('');
    try {
      await applyToProject(project.id, { message: applicationMessage.trim() });
      toast.success('Proposta enviada! O dono do projeto irá avaliar.');
      closeApply();
      setHasApplied(true);
    } catch {
      setApplicationError('Erro ao enviar a proposta. Tente novamente.');
    } finally {
      setApplicationSending(false);
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
              variant="outline"
              size="sm"
              onClick={() => setShowingApplications((v) => !v)}
              aria-label={`Ver propostas de ${project.title}`}
              title="Ver propostas de candidatos"
            >
              <Handshake size={15} className="mr-1.5" />
              Propostas
              {project.application_count > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {project.application_count}
                </Badge>
              )}
            </Button>
            <Button
              variant={isInviting ? 'default' : 'ghost'}
              size="sm"
              onClick={isInviting ? closeInvites : openInvites}
              aria-label={`Convidar profissionais para ${project.title}`}
              title="Convidar profissionais"
            >
              <Users size={15} />
            </Button>
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

      {isInviting && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-foreground">
              Convidar profissionais
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeInvites}
              aria-label={`Fechar convites de ${project.title}`}
            >
              <X size={15} className="mr-1" />
              Fechar
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-foreground/80">
              Habilidades para buscar
            </label>
            <SkillInput
              value={inviteSkills}
              onChange={setInviteSkills}
              placeholder="Digite uma habilidade e pressione Tab ou Enter"
            />
            <p className="text-[11px] text-muted-foreground">
              Os profissionais compatíveis aparecem assim que você digita as
              habilidades.
            </p>
          </div>

          {inviteSkills.length > 0 && (
            <div className="flex flex-col gap-2">
              {searching && matches.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-4 text-[13px] text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Buscando profissionais...
                </div>
              ) : searchError ? (
                <p className="text-xs text-destructive" role="alert">
                  {searchError}
                </p>
              ) : matches.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-5 text-center text-[13px] text-muted-foreground">
                  Nenhum profissional encontrado com essas habilidades.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {matches.map((person) => (
                    <div
                      key={person.id}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        person.id === selected?.id
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold text-foreground">
                            {person.name || person.email}
                          </div>
                          {person.biografia && (
                            <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                              {person.biografia}
                            </p>
                          )}
                          {person.skills.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {person.skills.map((skill) => (
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
                        <Button
                          variant={
                            person.id === selected?.id ? 'ghost' : 'outline'
                          }
                          size="sm"
                          onClick={() => setSelected(person)}
                        >
                          {person.id === selected?.id
                            ? 'Selecionado'
                            : 'Selecionar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selected && (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <label className="text-[13px] font-medium text-foreground/80">
                Mensagem personalizada para {selected.name || selected.email}
              </label>
              <Textarea
                aria-label="Mensagem personalizada"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: Vi seu perfil e acredito que você se encaixaria muito bem neste projeto. Adoraria conversar sobre isso!"
              />
              {sendError && (
                <p className="text-xs text-destructive" role="alert">
                  {sendError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelected(null);
                    setMessage('');
                    setSendError('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendInvite}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 size={15} className="mr-1.5 animate-spin" />
                  ) : (
                    <Send size={14} className="mr-1.5" />
                  )}
                  Enviar convite
                </Button>
              </div>
            </div>
          )}

          {invitees.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[12px] font-semibold text-muted-foreground">
                Já convidados para este projeto
              </p>
              <div className="flex flex-col gap-1.5">
                {invitees.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CheckCircle2 size={14} className="shrink-0 text-primary" />
                      <span className="truncate">
                        {invite.invited_user.name || invite.invited_user.email}
                      </span>
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {STATUS_LABEL[invite.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isOwner && showingApplications && (
        <ProjectApplicationsPanel
          project={project}
          onUpdated={(updatedProject) => onUpdated?.(updatedProject)}
        />
      )}

      {!isOwner && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
          {project.applications_closed ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Lock size={13} />
              {hasApplied
                ? 'Sua proposta foi enviada antes do fechamento.'
                : 'Este projeto está fechado para novas propostas.'}
            </div>
          ) : hasApplied ? (
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
              <label
                className="text-[13px] font-medium text-foreground/80"
                htmlFor={`apply-message-${project.id}`}
              >
                Por que você quer participar?
              </label>
              <Textarea
                id={`apply-message-${project.id}`}
                aria-label="Mensagem da proposta"
                rows={3}
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value)}
                placeholder="Ex: Tenho 5 anos de experiência em conciliação bancária e posso contribuir desde já..."
              />
              {applicationError && (
                <p className="text-xs text-destructive" role="alert">
                  {applicationError}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={applicationSending}>
                  {applicationSending ? (
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
            aria-label={`Abrir o tópico do projeto ${project.title}`}
          >
            <MessagesSquare size={14} className="mr-1.5" />
            Ver tópico do projeto
          </Button>
        </div>
      )}
    </Card>
  );
}