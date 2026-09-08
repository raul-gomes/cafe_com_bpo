import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { getPosts, createPost, PaginatedPosts } from '../../api/network';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { NotificationBell } from '../../components/panel/NotificationBell';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';

type FilterType = 'all' | 'my' | 'answered';
type SortType = 'recent' | 'popular';

export const NetworkPage: React.FC = () => {
  const [data, setData] = useState<PaginatedPosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newTags, setNewTags] = useState('');
  const [error, setError] = useState('');

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeSort, setActiveSort] = useState<SortType>('recent');

  const navigate = useNavigate();

  const loadPosts = async () => {
    setLoading(true);
    try {
      const resp = await getPosts(20);
      setData(resp);
      setError('');
    } catch {
      setError(
        'Erro ao carregar tópicos da comunidade. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newMessage) {
      setError('Preencha título e mensagem.');
      return;
    }

    const tagsArray = newTags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t);

    try {
      await createPost({
        title: newTitle,
        message: newMessage,
        tags: tagsArray,
      });
      setShowForm(false);
      setNewTitle('');
      setNewMessage('');
      setNewTags('');
      loadPosts();
    } catch {
      setError('Erro ao criar tópico.');
    }
  };

  const filterBtn = (label: string, key: FilterType) => (
    <Button
      key={key}
      variant={activeFilter === key ? 'default' : 'ghost'}
      size="sm"
      onClick={() => setActiveFilter(key)}
    >
      {label}
    </Button>
  );

  const sortBtn = (label: string, key: SortType) => (
    <Button
      key={key}
      variant={activeSort === key ? 'default' : 'ghost'}
      size="sm"
      onClick={() => setActiveSort(key)}
    >
      {label}
    </Button>
  );

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Comunidade' },
        ]}
      />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">
            Comunidade
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Conecte-se com profissionais de BPO: tire dúvidas no fórum e acompanhe o
            mural de projetos.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
        </div>
      </div>

      <Tabs defaultValue="forum">
        <TabsList variant="line" className="mb-6 w-full justify-start">
          <TabsTrigger value="forum">Fórum</TabsTrigger>
          <TabsTrigger value="projects">Projetos</TabsTrigger>
        </TabsList>

        <TabsContent value="forum">
          {/* Filter + Sort + Create */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="mr-1 text-[12px] font-semibold text-muted-foreground">
                Filtrar:
              </span>
              {filterBtn('Todos', 'all')}
              {filterBtn('Meus Tópicos', 'my')}
              {filterBtn('Respondidos', 'answered')}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="mr-1 text-[12px] font-semibold text-muted-foreground">
                Ordenar:
              </span>
              {sortBtn('Recentes', 'recent')}
              {sortBtn('Populares', 'popular')}
              <Button
                variant={showForm ? 'ghost' : 'default'}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? 'Cancelar' : 'Criar Tópico'}
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={loadPosts}>
                Tentar Novamente
              </Button>
            </div>
          )}

          {/* Create Post Form */}
          {showForm && (
            <Card className="mb-8 p-0">
              <div className="border-b border-border px-6 py-4">
                <h3 className="m-0 text-[18px] font-semibold text-foreground">Novo Tópico</h3>
              </div>
              <form onSubmit={handleCreate}>
                <div className="flex flex-col gap-4 p-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-foreground/80">
                      Título do Tópico
                    </label>
                    <Input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="Descreva seu desafio ou dúvida de forma clara"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-foreground/80">
                      Mensagem
                    </label>
                    <div className="rounded-lg bg-muted/30">
                      <RichTextEditor
                        value={newMessage}
                        onChange={setNewMessage}
                        placeholder="Detalhe mais informações aqui..."
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-foreground/80">
                      Tags (separadas por vírgula)
                    </label>
                    <Input
                      type="text"
                      value={newTags}
                      onChange={e => setNewTags(e.target.value)}
                      placeholder="ex: duvida, vendas, operacional"
                    />
                  </div>
                </div>
                <div className="flex justify-end border-t border-border px-6 py-4">
                  <Button type="submit" variant="default">
                    Publicar Tópico
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-[60%]" />
                    <Skeleton className="h-3 w-[40%]" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data?.items.length === 0 && (
                <Card className="p-12 text-center">
                  <h3 className="mb-2 text-[16px] font-bold text-foreground">
                    Nenhum tópico encontrado
                  </h3>
                  <p className="text-[14px] text-muted-foreground">
                    Seja o primeiro a puxar um assunto!
                  </p>
                </Card>
              )}
              {data?.items.map(post => (
                <Card
                  key={post.id}
                  className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/painel/forum/${post.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter') navigate(`/painel/forum/${post.id}`);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 text-[16px] font-bold text-foreground">
                        {post.title}
                      </div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        {post.tags.map(tag => (
                          <span
                            key={tag}
                            className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-strong"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span>Autor: {post.author.name || post.author.email || 'Usuário'}</span>
                        <span className="opacity-30">|</span>
                        <span>
                          {post.comments_count}{' '}
                          {post.comments_count === 1 ? 'resposta' : 'respostas'}
                        </span>
                        <span className="opacity-30">|</span>
                        <span>
                          {new Date(post.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 shrink-0">
                      <Button variant="ghost" size="sm">
                        Ler Tópico
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects">
          <Card className="p-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Briefcase size={26} />
            </div>
            <h3 className="mb-2 text-[18px] font-bold text-foreground">
              Em breve: Mural de Projetos
            </h3>
            <p className="mx-auto mb-6 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Publique os projetos que você quer desenvolver e encontre profissionais
              de BPO qualificados para a sua demanda — ou candidate-se a projetos
              publicados por outros negócios.
            </p>
            <ul className="mx-auto flex max-w-xl flex-col gap-2 text-left text-[13px] text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckIcon />
                Publique o projeto com escopo, habilidades necessárias, orçamento, prazo
                e modalidade (remoto, presencial ou híbrido).
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon />
                Habilidades vêm direto do catálogo da comunidade, garantindo que
                profissionais e projetos falem a mesma língua.
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon />
                Acompanhe a evolução do projeto e conecte-se com quem pode executá-lo.
              </li>
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const CheckIcon = () => (
  <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  </span>
);