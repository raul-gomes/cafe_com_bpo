import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { SearchInput } from '../../components/ui/SearchInput';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ProjetosCard } from '../../components/projetos/ProjetosCard';
import { ProjetoIndicadores } from '../../components/projetos/ProjetoIndicadores';
import { ProjetoFormDialog } from '../../components/projetos/ProjetoFormDialog';
import { useAppNotifications } from '../../api/hooks/useAppNotifications';
import {
  createProject,
  deleteProject,
  getMyProjects,
  type ProjectResponse,
} from '../../api/network';
import { toProjetoPayload, type ProjetoFormData } from '../../schemas/projects';

type Aba = 'meus' | 'participo';

/** Gestão › Projetos — a central do BPO sobre os projetos do mural.
 *
 * O fórum é a vitrine (ver projeto da comunidade e candidatar-se). Aqui ficam as
 * duas listas que só o dono/participante enxerga: **Meus projetos** (eu criei) e
 * **Participo** (fui convidado e aceitei). Criar, editar, convidar, avaliar
 * propostas e arquivar acontecem aqui e são refletidos no mural, que lê as
 * mesmas tabelas. */
export function ProjetosPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { useNotificationsList } = useAppNotifications();
  const { data: naoLidas } = useNotificationsList(undefined, true);

  const [projetos, setProjetos] = useState<ProjectResponse[]>([]);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<Aba>('meus');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const primeiraCarga = useRef(true);
  const requisicaoAtual = useRef(0);

  const carregar = useCallback(async (termo: string) => {
    requisicaoAtual.current += 1;
    const idRequisicao = requisicaoAtual.current;
    setCarregando(true);
    try {
      const lista = await getMyProjects(termo ? { q: termo } : {});
      // resposta antiga não pode sobrescrever a mais recente
      if (idRequisicao !== requisicaoAtual.current) {
        return;
      }
      setProjetos(lista);
      setErro('');
    } catch {
      if (idRequisicao !== requisicaoAtual.current) {
        return;
      }
      setErro('Não foi possível carregar seus projetos. Tente novamente.');
    } finally {
      if (idRequisicao === requisicaoAtual.current) {
        setCarregando(false);
      }
    }
  }, []);

  useEffect(() => {
    // primeira carga na hora; as buscas seguintes esperam 300ms sem digitar
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      void carregar(busca);
      return;
    }
    const timer = setTimeout(() => {
      void carregar(busca);
    }, 300);
    return () => clearTimeout(timer);
  }, [carregar, busca]);

  const meus = projetos.filter((p) => p.is_owner);
  const participo = projetos.filter((p) => !p.is_owner && p.is_group_member);
  const visiveis = aba === 'meus' ? meus : participo;

  const arquivar = async (projeto: ProjectResponse) => {
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
      toast.success('Projeto arquivado.');
      await carregar(busca);
    } catch {
      toast.error('Não foi possível arquivar o projeto.');
    }
  };

  // o erro sobe para o formulário, que exibe a mensagem e mantém o diálogo aberto
  const salvar = async (dados: ProjetoFormData) => {
    await createProject(toProjetoPayload(dados));
    toast.success('Projeto publicado no mural.');
    setFormAberto(false);
    await carregar(busca);
  };

  const novidades = (naoLidas ?? []).filter(
    (n) => n.type === 'project_application'
  );

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[{ label: 'Painel', to: '/painel' }, { label: 'Projetos' }]}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">
            Projetos
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Os projetos que você criou e os que você participa, com as propostas
            e a equipe de cada um.
          </p>
        </div>
        <Button onClick={() => setFormAberto(true)}>
          <Plus className="mr-2 size-4" />
          Novo projeto
        </Button>
      </div>

      <ProjetoIndicadores
        criados={meus.length}
        participa={participo.length}
        aguardando={meus.reduce((total, p) => total + p.application_count, 0)}
      />

      {novidades.length > 0 ? (
        <Card className="mb-5 border-primary/30 bg-primary/5 p-4">
          <h2 className="mb-2 text-[14px] font-bold text-foreground">
            Novidades ({novidades.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {novidades.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full truncate text-left text-[13px] text-foreground transition-colors hover:text-primary"
                  onClick={() => {
                    if (item.related_entity_id) {
                      navigate(`/painel/projetos/${item.related_entity_id}`);
                    }
                  }}
                >
                  {item.message}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mb-4 p-4">
        <SearchInput
          value={busca}
          onChange={setBusca}
          label="Buscar projetos"
          placeholder="Buscar por título ou descrição"
        />
      </Card>

      <Tabs
        value={aba}
        onValueChange={(valor) => setAba(valor as Aba)}
        className="mb-4"
      >
        <TabsList variant="line">
          <TabsTrigger value="meus">
            Meus projetos
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {meus.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="participo">
            Participo
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {participo.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {erro ? (
        <Card className="p-12 text-center text-[14px] text-destructive">{erro}</Card>
      ) : null}

      {!erro && carregando ? (
        <Card className="p-12 text-center text-[14px] text-muted-foreground">
          Carregando projetos...
        </Card>
      ) : null}

      {!erro && !carregando && visiveis.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Briefcase className="size-6" />
          </div>
          <p className="text-[16px] font-semibold text-foreground">
            {busca
              ? 'Nenhum projeto encontrado'
              : aba === 'meus'
                ? 'Você ainda não criou nenhum projeto'
                : 'Você ainda não participa de nenhum projeto'}
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {busca
              ? 'Tente outro termo de busca.'
              : aba === 'meus'
                ? 'Publique um projeto para encontrar profissionais na Comunidade.'
                : 'Projetos aparecem aqui quando você aceita um convite de alguém.'}
          </p>
        </Card>
      ) : null}

      {!erro && !carregando && visiveis.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visiveis.map((projeto) => (
            <ProjetosCard
              key={projeto.id}
              project={projeto}
              onArchive={(p) => {
                void arquivar(p);
              }}
            />
          ))}
        </div>
      ) : null}

      <ProjetoFormDialog
        open={formAberto}
        project={null}
        onClose={() => setFormAberto(false)}
        onSubmit={salvar}
      />
    </div>
  );
}
