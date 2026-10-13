import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosts, createPost, PaginatedPosts, type PostFilter } from '../../api/network';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { NotificationBell } from '../../components/panel/NotificationBell';
import { MemberLink } from '../../components/network/MemberLink';
import { NewIndicator } from '../../components/network/NewIndicator';
import { useAppNotifications } from '../../api/hooks/useAppNotifications';
import { groupUnreadByEntity } from '../../lib/notificationIndicators';
import type { AppNotificationResponse } from '../../schemas/notifications';
import { ProjectsSection } from '../../components/network/ProjectsSection';
import { NetworkInvitationsPanel } from '../../components/network/NetworkInvitationsPanel';
import { PrivateTopicsSection } from '../../components/network/PrivateTopicsSection';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';

type ScopeType = 'public' | 'private';

/** Notificação mais recente do grupo — é a que resume "o que há de novo". */
function latestOf(
  notifications: AppNotificationResponse[]
): AppNotificationResponse | undefined {
  return [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

/** Tópicos por página do fórum. */
const PAGE_SIZE = 20;

export const NetworkPage: React.FC = () => {
  const { useNotificationsList } = useAppNotifications();
  const { data: unreadNotifications } = useNotificationsList(undefined, true);
  const newReplies = groupUnreadByEntity(
    unreadNotifications,
    'discussion_post',
    'post_commented'
  );
  const [data, setData] = useState<PaginatedPosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newTags, setNewTags] = useState('');
  const [error, setError] = useState('');

  const [activeFilter, setActiveFilter] = useState<PostFilter>('all');
  const [loadingMore, setLoadingMore] = useState(false);
  // Só a resposta do pedido mais recente vale: trocar de filtro durante um
  // carregamento não pode misturar as listas.
  const lastRequest = useRef(0);
  const [activeScope, setActiveScope] = useState<ScopeType>('public');

  const navigate = useNavigate();

  /** Carrega uma página do fórum. O filtro roda no servidor, antes de
   *  paginar: "Meus Tópicos" e "Respondidos" alcançam tópicos além dos 20
   *  primeiros (AUD-031). Com offset > 0 a página é somada à lista. */
  const loadPosts = async (filter: PostFilter, offset = 0) => {
    const request = ++lastRequest.current;
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const resp = await getPosts(PAGE_SIZE, offset, filter);
      if (request !== lastRequest.current) return;
      setData(prev =>
        offset === 0 || !prev
          ? resp
          : { items: [...prev.items, ...resp.items], total: resp.total }
      );
      setError('');
    } catch {
      if (request !== lastRequest.current) return;
      setError(
        'Erro ao carregar tópicos da comunidade. Verifique sua conexão e tente novamente.'
      );
    } finally {
      if (request === lastRequest.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    loadPosts(activeFilter);
  }, [activeFilter]);

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
      loadPosts(activeFilter);
    } catch {
      setError('Erro ao criar tópico.');
    }
  };

  const filterBtn = (label: string, key: PostFilter) => (
    <Button
      key={key}
      variant={activeFilter === key ? 'default' : 'ghost'}
      size="sm"
      onClick={() => setActiveFilter(key)}
    >
      {label}
    </Button>
  );

  const scopeBtn = (label: string, key: ScopeType) => (
    <Button
      key={key}
      variant={activeScope === key ? 'default' : 'ghost'}
      size="sm"
      className="gap-1.5"
      onClick={() => setActiveScope(key)}
    >
      {label}
      <NewIndicator category={key === 'private' ? 'private' : 'public'} />
    </Button>
  );

  const visiblePosts = data?.items ?? [];
  const hasMore = !!data && data.items.length < data.total;

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
            {/* Scope + Filter + Create */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="mr-1 text-[12px] font-semibold text-muted-foreground">
                  Tópicos:
                </span>
                {scopeBtn('Públicos', 'public')}
                {scopeBtn('Privados', 'private')}
              </div>
              {activeScope === 'public' && (
                <div className="flex items-center gap-2">
                  <span className="mr-1 text-[12px] font-semibold text-muted-foreground">
                    Filtrar:
                  </span>
                  {filterBtn('Todos', 'all')}
                  {filterBtn('Meus Tópicos', 'mine')}
                  {filterBtn('Respondidos', 'answered')}
                </div>
              )}
              <div className="ml-auto">
                {activeScope === 'public' && (
                  <Button
                    variant={showForm ? 'ghost' : 'default'}
                    onClick={() => setShowForm(!showForm)}
                  >
                    {showForm ? 'Cancelar' : 'Criar Tópico'}
                  </Button>
                )}
              </div>
            </div>

            {activeScope === 'private' && <PrivateTopicsSection />}

            {activeScope === 'public' && (
              <>
                {/* Error */}
                {error && (
                  <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
                    <span>{error}</span>
                    <Button variant="ghost" size="sm" onClick={() => loadPosts(activeFilter)}>
                      Tentar Novamente
                    </Button>
                  </div>
                )}

                {/* Create Post Form */}
                {showForm && (
                  <Card className="mb-8 p-0">
                    <div className="border-b border-border px-6 py-4">
                      <h3 className="m-0 text-[18px] font-semibold text-foreground">
                        Novo Tópico
                      </h3>
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
                    {visiblePosts.length === 0 && (
                      <Card className="p-12 text-center">
                        <h3 className="mb-2 text-[16px] font-bold text-foreground">
                          Nenhum tópico encontrado
                        </h3>
                        <p className="text-[14px] text-muted-foreground">
                          {activeFilter === 'all'
                            ? 'Seja o primeiro a puxar um assunto!'
                            : 'Nenhum tópico corresponde a este filtro.'}
                        </p>
                      </Card>
                    )}
                    {visiblePosts.map(post => (
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
                            {newReplies[post.id] && (
                              <div className="mb-2 flex items-center gap-2">
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                                  {newReplies[post.id].length}{' '}
                                  {newReplies[post.id].length === 1
                                    ? 'nova resposta'
                                    : 'novas respostas'}
                                </span>
                                <span className="truncate text-[12px] font-medium text-foreground">
                                  {latestOf(newReplies[post.id])?.message}
                                </span>
                              </div>
                            )}
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
                              <span>
                                Autor:{' '}
                                <MemberLink
                                  memberId={post.author.id}
                                  name={post.author.name}
                                  email={post.author.email}
                                  className="text-foreground"
                                />
                              </span>
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
                    {data && data.total > PAGE_SIZE && (
                      <div className="mt-2 flex flex-col items-center gap-2">
                        <p className="text-[12px] text-muted-foreground">
                          Mostrando {data.items.length} de {data.total} tópicos
                        </p>
                        {hasMore && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingMore}
                            onClick={() => loadPosts(activeFilter, data.items.length)}
                          >
                            {loadingMore ? 'Carregando...' : 'Carregar mais'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="projects">
            <NetworkInvitationsPanel />
            <ProjectsSection />
          </TabsContent>
        </Tabs>
    </div>
  );
};