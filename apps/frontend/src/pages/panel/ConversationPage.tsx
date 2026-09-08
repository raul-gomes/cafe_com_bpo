import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getConversation,
  sendMessage,
  ConversationDetail,
} from '../../api/network';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';

const POLL_MS = 8000;

export const ConversationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setConversation(await getConversation(id));
      setError('');
    } catch {
      setError('Conversa não encontrada ou erro de conexão.');
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  const otherUser =
    conversation?.participants.find((participant) => participant.id !== user?.id) ??
    null;

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
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">
            {conversation?.project_title ?? 'Conversa'}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {otherUser
              ? `Conversa privada com ${otherUser.name || otherUser.email}`
              : 'Conversa privada sobre o projeto'}
          </p>
        </div>
      </div>

      {error && !conversation && (
        <Card className="p-12 text-center">
          <p className="text-[14px] text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/painel/forum')}>
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
        <Card className="flex min-h-[60vh] flex-col overflow-hidden p-0">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-muted/20 p-4">
            {conversation.messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-center text-[13px] text-muted-foreground">
                <div>
                  <p className="mb-1 font-semibold text-foreground">
                    Conversa iniciada!
                  </p>
                  {otherUser && (
                    <p>
                      Envie a primeira mensagem para {otherUser.name || otherUser.email}.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              conversation.messages.map((message) => {
                const mine = message.sender_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[78%] rounded-2xl px-4 py-2 text-[13px] leading-relaxed',
                        mine
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm bg-card ring-1 ring-border'
                      )}
                    >
                      <div className="mb-0.5 text-[11px] opacity-70">
                        {mine
                          ? 'Você'
                          : message.sender.name || message.sender.email}
                      </div>
                      <div className="whitespace-pre-wrap">{message.body}</div>
                      <div className="mt-1 text-right text-[10px] opacity-60">
                        {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {error && conversation && (
            <div className="px-4 pt-3 text-xs text-destructive">{error}</div>
          )}

          <form
            onSubmit={handleSend}
            className="flex items-end gap-2 border-t border-border p-4"
          >
            <Textarea
              aria-label="Mensagem"
              rows={2}
              className="flex-1 resize-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Digite sua mensagem..."
            />
            <Button type="submit" disabled={sending || !body.trim()} aria-label="Enviar mensagem">
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}