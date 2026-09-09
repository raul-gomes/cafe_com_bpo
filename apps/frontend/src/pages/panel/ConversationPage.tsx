import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquarePlus, Loader2, Lock } from 'lucide-react';
import {
  getConversation,
  sendMessage,
  ConversationDetail,
} from '../../api/network';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { ThreadReplies } from '../../components/network/ThreadReplies';

const POLL_MS = 15000;

export const ConversationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setConversation(await getConversation(id));
      setError('');
    } catch {
      setError('Tópico privado não encontrado ou erro de conexão.');
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
      getConversation(id)
        .then(setConversation)
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !body.trim()) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(id, body.trim());
      setBody('');
      await load();
    } catch {
      setError('Erro ao enviar a mensagem. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const otherNames = conversation?.participants
    .map((participant) => participant.name || participant.email)
    .join(', ');

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Comunidade', to: '/painel/forum' },
          { label: 'Conversa' },
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
        <div>
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-primary" />
            <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">
              {conversation?.project_title ?? 'Conversa'}
            </h1>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Tópico privado{otherNames ? ` com ${otherNames}` : ''}
          </p>
        </div>
      </div>

      {error && !conversation && (
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
        <Card className="flex flex-col gap-3 p-4">
          <Skeleton className="h-8 w-[60%]" />
          <Skeleton className="h-8 w-[40%]" />
          <Skeleton className="h-8 w-[70%]" />
        </Card>
      )}

      {conversation && (
        <>
          <Card className="mb-4 px-6 py-4">
            <p className="text-[13px] text-muted-foreground">
              {conversation.messages.length === 0
                ? 'Este tópico privado ainda não tem mensagens. Responda abaixo para começar.'
                : `${conversation.messages.length} ${
                    conversation.messages.length === 1 ? 'mensagem' : 'mensagens'
                  } em formato de fórum — nada de chat.`}
            </p>
          </Card>

          <div className="flex flex-col gap-3">
            {conversation.messages.map((message, index) => {
              const authorName = message.sender.name || message.sender.email || 'Usuário';
              const card = (
                <Card key={message.id} className="flex flex-col p-0">
                  <div className="flex items-center gap-3 border-b border-border px-6 py-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[13px] font-bold text-foreground">
                      {authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-bold text-foreground">
                          {authorName}
                        </span>
                        {index === 0 && <Badge variant="secondary">Tópico inicial</Badge>}
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {index === 0
                          ? `Aberto em ${new Date(message.created_at).toLocaleDateString('pt-BR')} às ${new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                          : `Respondido em ${new Date(message.created_at).toLocaleDateString('pt-BR')} às ${new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap px-6 py-5 text-[14px] leading-relaxed text-foreground">
                    {message.body}
                  </div>
                </Card>
              );

              if (index === 0) return card;
              return (
                <ThreadReplies key={message.id}>{card}</ThreadReplies>
              );
            })}
          </div>

          {error && conversation && (
            <div className="mt-3 text-xs text-destructive">{error}</div>
          )}

          <Card className="mt-4 p-6">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-foreground">
              <MessageSquarePlus size={16} className="text-primary" />
              Responder neste tópico
            </h3>
            <form onSubmit={handleSend}>
              <Textarea
                aria-label="Resposta"
                rows={3}
                className="w-full resize-y"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva sua resposta no formato de fórum..."
              />
              <div className="mt-3 flex justify-end">
                <Button
                  type="submit"
                  disabled={sending || !body.trim()}
                  aria-label="Publicar resposta"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Publicar resposta'
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </div>
  );
};