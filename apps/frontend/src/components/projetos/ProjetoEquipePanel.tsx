import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Search, UserPlus, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { MemberLink } from '../network/MemberLink';
import {
  createInvitation,
  getProjectInvitations,
  searchProfessionals,
  type ProfessionalMatch,
  type ProjectGroupDetail,
  type ProjectInvitation,
  type ProjectResponse,
} from '../../api/network';

export interface ProjetoEquipePanelProps {
  project: ProjectResponse;
  /** Tópico do projeto (membros). `null` enquanto carrega ou se não existir. */
  group: ProjectGroupDetail | null;
  /** Recarrega o grupo depois de convidar. */
  onReload: () => void;
}

const STATUS_CONVITE: Record<string, string> = {
  pending: 'Aguardando resposta',
  accepted: 'Aceitou o convite',
  declined: 'Recusou o convite',
};

/** Aba Equipe: quem está no projeto e o convite de novos profissionais.
 *
 * Só o dono convida (regra do mural: o convite tem mensagem personalizada e a
 * pessoa entra na equipe **quando aceita**). Quem apenas participa vê a equipe,
 * sem formulário de convite. */
export function ProjetoEquipePanel({
  project,
  group,
  onReload,
}: ProjetoEquipePanelProps) {
  const [convites, setConvites] = useState<ProjectInvitation[]>([]);
  const [matches, setMatches] = useState<ProfessionalMatch[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState('');
  const [selecionado, setSelecionado] = useState<ProfessionalMatch | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const souDono = project.is_owner;

  const carregarConvites = useCallback(async () => {
    if (!souDono) {
      return;
    }
    try {
      setConvites(await getProjectInvitations(project.id));
    } catch {
      // 403 para quem não é dono: a lista de convites é do dono, e aqui não há
      setConvites([]);
    }
  }, [project.id, souDono])

  useEffect(() => {
    void carregarConvites();
  }, [carregarConvites])

  const buscar = async () => {
    setBuscando(true);
    setErroBusca('');
    try {
      setMatches(
        await searchProfessionals(
          project.skills.map((s) => s.name),
          'any'
        )
      );
    } catch {
      setMatches([]);
      setErroBusca('Não foi possível buscar profissionais. Tente novamente.');
    } finally {
      setBuscando(false);
    }
  };

  const enviar = async () => {
    if (!selecionado) {
      setErro('Escolha um profissional para convidar.');
      return;
    }
    if (!mensagem.trim()) {
      setErro('Escreva a mensagem do convite.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      await createInvitation(project.id, {
        invited_user_id: selecionado.id,
        message: mensagem.trim(),
      });
      toast.success(`Convite enviado para ${selecionado.name || selecionado.email}.`);
      setSelecionado(null);
      setMensagem('');
      setMatches([]);
      await carregarConvites();
    } catch {
      setErro('Não foi possível enviar o convite. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="mb-3 text-[15px] font-bold text-foreground">
          Equipe do projeto
        </h2>
        {group && group.members.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {group.members.map((membro) => (
              <li
                key={membro.id}
                className="flex items-center gap-2 text-[13px] text-foreground"
              >
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
                <MemberLink
                  memberId={membro.id}
                  name={membro.name}
                  email={membro.email}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Ninguém na equipe ainda. Convide um profissional para começar.
          </p>
        )}
      </Card>

      {souDono ? (
        <Card className="p-5">
          <h2 className="mb-1 text-[15px] font-bold text-foreground">
            Convide profissionais
          </h2>
          <p className="mb-3 text-[12px] text-muted-foreground">
            A busca usa as habilidades do projeto. O profissional entra na equipe
            quando aceita o convite.
          </p>

          <Button variant="outline" size="sm" onClick={() => void buscar()}>
            {buscando ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 size-4" />
            )}
            Buscar profissionais
          </Button>

          {erroBusca ? (
            <p role="alert" className="mt-3 text-[12px] text-destructive">
              {erroBusca}
            </p>
          ) : null}

          {matches.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {matches.map((pessoa) => (
                <li
                  key={pessoa.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-foreground">
                      <MemberLink
                        memberId={pessoa.id}
                        name={pessoa.name}
                        email={pessoa.email}
                      />
                    </div>
                    {pessoa.biografia ? (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                        {pessoa.biografia}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant={
                      selecionado?.id === pessoa.id ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => {
                      setSelecionado(pessoa)
                      setErro('')
                    }}
                    aria-label={`Selecionar ${pessoa.name || pessoa.email} para convidar`}
                  >
                    <UserPlus className="mr-1.5 size-4" />
                    Convidar
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {selecionado ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <Label htmlFor={`convite-${selecionado.id}`}>
                Mensagem para {selecionado.name || selecionado.email}
              </Label>
              <Textarea
                id={`convite-${selecionado.id}`}
                rows={3}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Explique por que você quer essa pessoa no projeto"
              />
              {erro ? (
                <p role="alert" className="text-[12px] text-destructive">
                  {erro}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelecionado(null)
                    setMensagem('')
                    setErro('')
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={() => void enviar()} disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Enviar convite'}
                </Button>
              </div>
            </div>
          ) : null}

          {convites.length > 0 ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-[12px] font-semibold text-muted-foreground">
                Convites enviados
              </p>
              <ul className="flex flex-col gap-2">
                {convites.map((convite) => (
                  <li
                    key={convite.id}
                    className="flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {convite.status === 'declined' ? (
                        <XCircle className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <CheckCircle2
                          className={
                            convite.status === 'accepted'
                              ? 'size-4 shrink-0 text-primary'
                              : 'size-4 shrink-0 text-muted-foreground'
                          }
                        />
                      )}
                      <MemberLink
                        memberId={convite.invited_user.id}
                        name={convite.invited_user.name}
                        email={convite.invited_user.email}
                        className="truncate"
                      />
                    </span>
                    <Badge
                      variant={
                        convite.status === 'accepted' ? 'default' : 'outline'
                      }
                      className="shrink-0"
                    >
                      {STATUS_CONVITE[convite.status] ?? convite.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {convites.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={onReload}
            >
              Atualizar equipe
            </Button>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
