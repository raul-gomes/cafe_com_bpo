import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getPost,
  getComments,
  createComment,
  deletePost,
  PostResponse,
  CommentResponse,
} from '../../api/network';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { toast } from 'sonner';

export const NetworkPostPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState<PostResponse | null>(null);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState('');
  const [showReplyPanel, setShowReplyPanel] = useState(false);
  const confirm = useConfirm();

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const parent = await getPost(id);
      setPost(parent);
      const thr = await getComments(id);
      setComments(thr);
    } catch {
      setError('Tópico não encontrado ou erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !id) return;

    try {
      await createComment(id, newComment);
      setNewComment('');
      setShowReplyPanel(false);
      loadData();
    } catch {
      setError('Erro ao enviar a resposta.');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: 'Excluir tópico',
      message:
        'Deseja excluir este tópico? Só funciona se não existir respostas.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    try {
      await deletePost(id);
      navigate('/painel/forum');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Erro ao excluir o post.');
    }
  };

  if (loading)
    return (
      <div className="animate-[panelFadeIn_0.4s_ease-out]">
        <Breadcrumb
          items={[
            { label: 'Painel', to: '/painel' },
            { label: 'Comunidade', to: '/painel/forum' },
            { label: 'Tópico' },
          ]}
        />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    );

  if (!post)
    return (
      <div className="animate-[panelFadeIn_0.4s_ease-out]">
        <Breadcrumb
          items={[
            { label: 'Painel', to: '/painel' },
            { label: 'Comunidade', to: '/painel/forum' },
            { label: 'Tópico' },
          ]}
        />
        <Card className="mt-10 p-12 text-center">
          <p className="text-[14px] text-muted-foreground">
            {error || '404 — Post offline'}
          </p>
        </Card>
      </div>
    );

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Comunidade', to: '/painel/forum' },
          { label: post?.title || 'Tópico' },
        ]}
      />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-[28px] font-extrabold tracking-tight text-foreground">
            {post.title}
          </h1>
          <div className="flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="rounded bg-primary/10 px-2 py-0.5 text-[12px] font-bold text-primary"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
        {post.author_id === user?.id && post.comments_count === 0 && (
          <Button variant="destructive" onClick={handleDelete}>
            Excluir Tópico
          </Button>
        )}
      </div>

      {/* Post Card */}
      <Card className="flex flex-col p-0">
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-[14px] font-bold text-foreground">
            {post.author.name?.slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div>
            <div className="text-[14px] font-bold text-foreground">
              {post.author.name || post.author.email || 'Usuário'}
            </div>
            <div className="text-[12px] text-muted-foreground">
              Publicado em{' '}
              {new Date(post.created_at).toLocaleDateString('pt-BR')} às{' '}
              {new Date(post.created_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
        <div
          className="px-6 py-5 text-[15px] leading-relaxed text-foreground rich-text-content"
          dangerouslySetInnerHTML={{ __html: post.message }}
        />
      </Card>

      {/* Comments */}
      <div className="mt-4 flex flex-col gap-4">
        {comments.map(c => (
          <Card
            key={c.id}
            className="flex flex-col p-0"
            style={{ marginLeft: post.author_id === c.author_id ? 0 : 32 }}
          >
            <div className="flex items-center gap-3 border-b border-border px-6 py-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">
                {c.author.name?.slice(0, 2).toUpperCase() || 'U'}
              </div>
              <div>
                <div className="text-[13px] font-bold text-foreground">
                  {c.author.name || 'Usuário'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(c.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
            <div
              className="px-6 py-5 text-[14px] leading-relaxed text-foreground rich-text-content"
              dangerouslySetInnerHTML={{ __html: c.message }}
            />
          </Card>
        ))}
      </div>

      {/* Reply Button */}
      <div className="mt-6 flex justify-end">
        <Button
          variant="default"
          onClick={() => setShowReplyPanel(!showReplyPanel)}
        >
          {showReplyPanel ? 'Cancelar Resposta' : 'Responder ao Tópico'}
        </Button>
      </div>

      {/* Reply Form */}
      {showReplyPanel && (
        <Card className="mt-4 p-0">
          <div className="border-b border-border px-6 py-4">
            <h4 className="m-0 text-[16px] font-semibold text-foreground">
              Escrever Resposta
            </h4>
          </div>
          <form onSubmit={handleReply}>
            <div className="p-6">
              <div className="rounded-lg bg-muted/30">
                <RichTextEditor
                  value={newComment}
                  onChange={setNewComment}
                  placeholder="Sua contribuição é muito importante..."
                />
              </div>
            </div>
            <div className="flex justify-end border-t border-border px-6 py-4">
              <Button type="submit" variant="default">
                Enviar Resposta
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};
