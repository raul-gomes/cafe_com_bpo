import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { getProjects, type PaginatedProjects } from '../../api/network';
import { ProjectCard } from './ProjectCard';
import { SearchInput } from '../ui/SearchInput';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';

/**
 * Mural de projetos dentro do fórum — **vitrine, sem gestão**.
 *
 * A aba mostra todos os projetos publicados, com busca por título/descrição, e
 * oferece a candidatura. Criar, editar, convidar, avaliar propostas e arquivar
 * ficam em Gestão › Projetos, que é também onde o bloco de Novidades aparece.
 */
/** Projetos por página do mural. */
const POR_PAGINA = 20;

export function ProjectsSection() {
  const [data, setData] = useState<PaginatedProjects | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const primeiraCarga = useRef(true);
  const requisicaoAtual = useRef(0);

  const [carregandoMais, setCarregandoMais] = useState(false);

  /** Carrega uma página do mural; com offset > 0 soma à lista atual, para
   *  alcançar os projetos além dos 20 primeiros (AUD-032). */
  const carregar = useCallback(async (termo: string, offset = 0) => {
    requisicaoAtual.current += 1;
    const idRequisicao = requisicaoAtual.current;
    if (offset === 0) setLoading(true);
    else setCarregandoMais(true);
    try {
      const resp = await getProjects(POR_PAGINA, offset, termo);
      // resposta antiga não pode sobrescrever a busca mais recente
      if (idRequisicao !== requisicaoAtual.current) {
        return;
      }
      setData(prev =>
        offset === 0 || !prev
          ? resp
          : { ...resp, items: [...prev.items, ...resp.items] }
      );
      setError('');
    } catch {
      if (idRequisicao !== requisicaoAtual.current) {
        return;
      }
      setError(
        'Erro ao carregar o mural de projetos. Verifique sua conexão e tente novamente.'
      );
    } finally {
      if (idRequisicao === requisicaoAtual.current) {
        setLoading(false);
        setCarregandoMais(false);
      }
    }
  }, []);

  useEffect(() => {
    // primeira carga na hora (o fórum não pode piscar esperando o timer); as
    // buscas seguintes esperam 300ms sem digitar, para não virar uma request
    // por tecla
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

  return (
    <div>
      <SearchInput
        value={busca}
        onChange={setBusca}
        label="Buscar projeto"
        placeholder="Buscar projeto por nome ou descrição..."
        className="mb-5"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-[60%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
            </Card>
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Briefcase size={26} />
          </div>
          {busca.trim() ? (
            <>
              <h3 className="mb-2 text-[18px] font-bold text-foreground">
                Nenhum projeto encontrado
              </h3>
              <p className="text-[14px] text-muted-foreground">
                Nenhum projeto publicado usa o termo "{busca.trim()}". Tente
                outra palavra.
              </p>
            </>
          ) : (
            <>
              <h3 className="mb-2 text-[18px] font-bold text-foreground">
                Nenhum projeto publicado
              </h3>
              <p className="mb-4 text-[14px] text-muted-foreground">
                Seja o primeiro a publicar um projeto e encontrar profissionais
                de BPO.
              </p>
              <Link
                to="/painel/projetos"
                className="text-[14px] font-semibold text-primary hover:underline"
              >
                Criar projeto em Gestão › Projetos
              </Link>
            </>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {data && data.total > POR_PAGINA && (
            <div className="mt-2 flex flex-col items-center gap-2">
              <p className="text-[12px] text-muted-foreground">
                Mostrando {data.items.length} de {data.total} projetos
              </p>
              {data.items.length < data.total && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={carregandoMais}
                  onClick={() => void carregar(busca, data.items.length)}
                >
                  {carregandoMais ? 'Carregando...' : 'Carregar mais'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
