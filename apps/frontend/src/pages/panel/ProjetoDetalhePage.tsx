import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, Lock, MessagesSquare, Pencil, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { MemberLink } from '../../components/network/MemberLink';
import { ProjetoFormDialog } from '../../components/projetos/ProjetoFormDialog';
import { ProjetoEquipePanel } from '../../components/projetos/ProjetoEquipePanel';
import { ProjetoTopicoPanel } from '../../components/projetos/ProjetoTopicoPanel';
import { ProjectApplicationsPanel } from '../../components/projetos/ProjectApplicationsPanel';
import {
  deleteProject,
  getGroup,
  getProject,
  toggleProjectStatus,
  updateProject,
  type ProjectGroupDetail,
  type ProjectResponse,
} from '../../api/network';
import { toProjetoPayload, type ProjetoFormData } from '../../schemas/projects';

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** Gestão › Projetos › detalhe: a visão macro de um projeto.
 *
 * Abas: **Visão geral** (dados públicos e estado), **Propostas** (só o dono —
 * é a lista de candidatos que chegam de forma espontânea), **Equipe** (quem
 * entrou e o convite de novos profissionais, só o dono convida) e **Tópico**
 * (as últimas publicações do fórum do projeto). Tudo aqui grava nas mesmas
 * tabelas do mural, então o fórum reflete na hora. */
export function ProjetoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [projeto, setProjeto] = useState<ProjectResponse | null>(null);
  const [grupo, setGrupo] = useState<ProjectGroupDetail | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(false);

  const carregarProjeto = useCallback(async () => {
    if (!id) {
      return;
    }
    setCarregando(true);
    try {
      setProjeto(await getProject(id));
      setErro('');
    } catch {
      setErro('Não foi possível carregar este projeto. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [id])

  useEffect(() => {
    void carregarProjeto();
  }, [carregarProjeto])

  const carregarGrupo = useCallback(async () => {
    if (!projeto?.group_id) {
      setGrupo(null);
      return;
    }
    try {
      setGrupo(await getGroup(projeto.group_id));
    } catch {
      setGrupo(null)
    }
  }, [projeto?.group_id])

  useEffect(() => {
    void carregarGrupo();
  }, [carregarGrupo])

  const arquivar = async () => {
    if (!projeto) {
      return;
    }
    const ok = await confirm({
      variant: 'danger',
      title: 'Arquivar projeto',
      message: `O projeto "${projeto.title}" sai do mural de projetos. A equipe e as propostas continuam no banco, e você pode reativá-lo depois se precisar.`,
      confirmLabel: 'Arquivar',
    });
    if (!ok) {
      return;
    }
    try {
      await deleteProject(projeto.id);
      toast.success('Projeto arquivado.')
      navigate('/painel/projetos')
    } catch {
      toast.error('Não foi possível arquivar o projeto.')
    }
  }

  const alternarPropostas = async () => {
    if (!projeto) {
      return;
    }
    try {
      setProjeto(await toggleProjectStatus(projeto.id))
      toast.success(
        projeto.applications_closed
          ? 'Propostas reabertas.'
          : 'Propostas fechadas.'
      )
    } catch {
      toast.error('Não foi possível alterar as propostas.')
    }
  }

  // o erro sobe para o formulário, que exibe a mensagem e mantém o diálogo aberto
  const salvarEdicao = async (dados: ProjetoFormData) => {
    if (!projeto) {
      return
    }
    setProjeto(await updateProject(projeto.id, toProjetoPayload(dados)))
    toast.success('Projeto atualizado no mural.')
    setEditando(false)
  }

  if (carregando) {
    return (
      <Card className="p-12 text-center text-[14px] text-muted-foreground">
        Carregando projeto...
      </Card>
    )
  }

  if (erro || !projeto) {
    return (
      <Card className="p-12 text-center text-[14px] text-destructive">
        {erro || 'Projeto não encontrado.'}
      </Card>
    )
  }

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Projetos', to: '/painel/projetos' },
          { label: projeto.title },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">
            {projeto.title}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Criado por{' '}
            <MemberLink
              memberId={projeto.owner.id}
              name={projeto.owner.name}
              email={projeto.owner.email}
            />{' '}
            em {dataCurta(projeto.created_at)} · atualizado em{' '}
            {dataCurta(projeto.updated_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projeto.is_owner ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void alternarPropostas()}
              >
                {projeto.applications_closed ? (
                  <>
                    <Unlock className="mr-1.5 size-4" />
                    Reabrir propostas
                  </>
                ) : (
                  <>
                    <Lock className="mr-1.5 size-4" />
                    Fechar propostas
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditando(true)}
              >
                <Pencil className="mr-1.5 size-4" />
                Editar projeto
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void arquivar()}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Archive className="mr-1.5 size-4" />
                Arquivar
              </Button>
            </>
          ) : null}
          {projeto.group_id && (projeto.is_owner || projeto.is_group_member) ? (
            <Link
              to={`/painel/grupos/${projeto.group_id}`}
              aria-label="Ver o tópico do projeto em página própria"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <MessagesSquare className="mr-1.5 size-4" />
              Tópico
            </Link>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          {projeto.is_owner ? (
            <TabsTrigger value="propostas">
              Propostas
              {projeto.application_count > 0 ? (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {projeto.application_count}
                </span>
              ) : null}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          {projeto.group_id ? <TabsTrigger value="topico">Tópico</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="visao-geral">
          <Card className="p-6">
            <h2 className="mb-2 text-[15px] font-bold text-foreground">
              Sobre o projeto
            </h2>
            <p className="mb-4 text-[14px] leading-relaxed text-muted-foreground">
              {projeto.description}
            </p>
            {projeto.skills.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Habilidades
                </span>
                {projeto.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-strong"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-4 text-[12px] text-muted-foreground">
              {projeto.applications_closed
                ? 'Este projeto está fechado para novas propostas.'
                : 'Este projeto está aberto para novas propostas.'}
            </p>
          </Card>
        </TabsContent>

        {projeto.is_owner ? (
          <TabsContent value="propostas">
            <ProjectApplicationsPanel
              project={projeto}
              onUpdated={(atualizado) => setProjeto(atualizado)}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="equipe">
          <ProjetoEquipePanel
            project={projeto}
            group={grupo}
            onReload={() => void carregarGrupo()}
          />
        </TabsContent>

        {projeto.group_id ? (
          <TabsContent value="topico">
            <ProjetoTopicoPanel project={projeto} group={grupo} />
          </TabsContent>
        ) : null}
      </Tabs>

      <ProjetoFormDialog
        open={editando}
        project={projeto}
        onClose={() => setEditando(false)}
        onSubmit={salvarEdicao}
      />
    </div>
  )
}
