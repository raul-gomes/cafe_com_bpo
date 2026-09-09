import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import {
  getGroup,
  createGroupPost,
  ProjectGroupDetail,
} from '../../api/network';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { GroupPostCard } from '../../components/network/GroupPostCard';
import { ThreadReplies } from '../../components/network/ThreadReplies';

const POLL_MS = 8000;

export const ProjectGroupPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<ProjectGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setGroup(await getGroup(id));
      setError('');
    } catch {
      setError('Grupo não encontrado ou erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const timer = setInterval(() => {
      getGroup(id).then(setGroup).catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [id]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !body.trim()) return;
    setSending(true);
    setError('');
    try {
      await createGroupPost(id, body.trim());
      setBody('');
      await load();
    } catch {
      setError('Erro ao publicar o post. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Comunidade', to: '/painel/forum' },
          { label: 'Tópico do projeto' },
        ]}
      />

      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate('/painel/forum')}
          aria-label="Voltar para a Comunidade"
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-extrabold tracking-tight text-foreground">
            {group?.project_title ?? 'Tópico do projeto'}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {group && group.members.length > 0
              ? `${group.members.length} ${
                  group.members.length === 1 ? 'participante' : 'participantes'
                }: ${group.members.map((m) => m.name || m.email).join(', ')}`
              : 'Tópico privado do projeto'}
          </p>
        </div>
      </div>

      {error && !group && (
        <Card className="p-12 text-center">
          <p className="text-[14px] text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate('/painel/forum')}
          >
            Voltar para a Comunidade
          </Button>
        </Card>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[120px] w-full rounded-xl" />
          <Skeleton className="h-[120px] w-full rounded-xl" />
        </div>
      )}

      {group && (
        <div className="flex flex-col gap-4">
          {group.posts.length === 0 ? (
            <Card className="border-dashed p-12 text-center">
              <p className="text-[14px] font-semibold text-foreground">
                Este é o tópico do projeto
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Publicado no formato de fórum, todo mundo com acesso acompanha.
                Seja o primeiro a postar.
              </p>
            </Card>
          ) : group.posts.length === 1 ? (
            <GroupPostCard post={group.posts[0]} />
          ) : (
            <>
              <GroupPostCard post={group.posts[0]} />
              <ThreadReplies>
                {group.posts.slice(1).map((post) => (
                  <GroupPostCard key={post.id} post={post} />
                ))}
              </ThreadReplies>
            </>
          )}

          {error && group && (
            <div className="text-xs text-destructive" role="alert">
              {error}
            </div>
          )}

          <Card className="p-0">
            <div className="border-b border-border px-6 py-4">
              <h4 className="m-0 text-[16px] font-semibold text-foreground">
                Novo post no tópico
              </h4>
            </div>
            <form onSubmit={handlePost}>
              <div className="p-6">
                <Textarea
                  aria-label="Post no tópico do projeto"
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Escreva sua contribuição para o tópico do projeto..."
                />
              </div>
              <div className="flex justify-end border-t border-border px-6 py-4">
                <Button type="submit" variant="default" disabled={sending || !body.trim()}>
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} className="mr-1.5" />
                  )}
                  Publicar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};