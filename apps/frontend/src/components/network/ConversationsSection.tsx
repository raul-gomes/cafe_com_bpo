import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Inbox } from 'lucide-react';
import { getConversations, ConversationListItem } from '../../api/network';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export function ConversationsSection() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ConversationListItem[] | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setItems(await getConversations());
      setError('');
    } catch {
      setError('Erro ao carregar as conversas. Tente novamente.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (items === null && !error) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-[50%]" />
            <Skeleton className="mt-2 h-3 w-[70%]" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-[13px] text-muted-foreground">
          Conversas privadas com profissionais sobre seus projetos — abertas quando
          um convite é aceito.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          {error}
        </div>
      )}

      {items !== null && items.length === 0 && (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Inbox size={26} />
          </div>
          <h3 className="mb-2 text-[18px] font-bold text-foreground">
            Nenhuma conversa ainda
          </h3>
          <p className="text-[14px] text-muted-foreground">
            Convide profissionais nos seus projetos: quando alguém aceitar, a
            conversa privada aparece aqui.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {items?.map((conversation) => (
          <Card
            key={conversation.id}
            className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
            onClick={() => navigate(`/painel/conversas/${conversation.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/painel/conversas/${conversation.id}`);
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[16px] font-bold text-foreground">
                  <MessageSquare size={16} className="shrink-0 text-primary" />
                  <span className="truncate">
                    {conversation.participant.name || conversation.participant.email}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  {conversation.project_title}
                </div>
                {conversation.last_message && (
                  <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
                    {conversation.last_message}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}