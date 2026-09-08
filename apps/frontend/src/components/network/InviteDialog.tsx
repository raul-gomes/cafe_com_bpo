import { useEffect, useState } from 'react';
import { Users, Search, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createInvitation,
  getProjectInvitations,
  searchProfessionals,
  ProfessionalMatch,
  ProjectInvitation,
  ProjectResponse,
} from '../../api/network';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { SkillInput } from '../ui/SkillInput';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface InviteDialogProps {
  project: ProjectResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  declined: 'Recusado',
};

export function InviteDialog({ project, open, onOpenChange }: InviteDialogProps) {
  const [skills, setSkills] = useState<string[]>([]);
  const [matches, setMatches] = useState<ProfessionalMatch[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [invitees, setInvitees] = useState<ProjectInvitation[]>([]);
  const [selected, setSelected] = useState<ProfessionalMatch | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const loadInvitees = async (projectId: string) => {
    try {
      setInvitees(await getProjectInvitations(projectId));
    } catch {
      setInvitees([]);
    }
  };

  useEffect(() => {
    if (!open || !project) return;
    setSkills([]);
    setMatches([]);
    setSearched(false);
    setSelected(null);
    setMessage('');
    setSendError('');
    loadInvitees(project.id);
  }, [open, project]);

  const handleSearch = async () => {
    if (skills.length === 0) {
      setSearchError('Informe ao menos uma habilidade para buscar profissionais.');
      return;
    }
    setSearching(true);
    setSearchError('');
    setMatches([]);
    setSearched(true);
    try {
      setMatches(await searchProfessionals(skills, 'any'));
    } catch {
      setSearchError('Erro ao buscar profissionais. Tente novamente.');
    } finally {
      setSearching(false);
    }
  };

  const handleSend = async () => {
    if (!project || !selected) return;
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
      loadInvitees(project.id);
    } catch {
      setSendError('Erro ao enviar o convite. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[18px]">
            <Users size={18} className="text-primary" />
            Convidar profissionais
          </DialogTitle>
          <DialogDescription>
            {project
              ? `Encontre pessoas compatíveis com as habilidades do projeto "${project.title}".`
              : 'Encontre pessoas compatíveis com as habilidades do projeto.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-foreground/80">
              Habilidades para buscar
            </label>
            <SkillInput
              value={skills}
              onChange={setSkills}
              placeholder="Ex: Python, Excel, Contabilidade"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              onClick={handleSearch}
              disabled={searching}
            >
              {searching ? (
                <Loader2 size={15} className="mr-1.5 animate-spin" />
              ) : (
                <Search size={15} className="mr-1.5" />
              )}
              Buscar profissionais
            </Button>
            {searchError && (
              <p className="text-xs text-destructive" role="alert">
                {searchError}
              </p>
            )}
          </div>

          {searched && !searching && (
            <div className="flex flex-col gap-2">
              {matches.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-6 text-center text-[13px] text-muted-foreground">
                  Nenhum profissional encontrado com essas habilidades.
                </div>
              ) : (
                matches.map((person) => (
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
                        variant={person.id === selected?.id ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => setSelected(person)}
                      >
                        {person.id === selected?.id ? 'Selecionado' : 'Convidar'}
                      </Button>
                    </div>
                  </div>
                ))
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
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 size={15} className="mr-1.5 animate-spin" />
                  ) : (
                    <Send size={15} className="mr-1.5" />
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
      </DialogContent>
    </Dialog>
  );
}