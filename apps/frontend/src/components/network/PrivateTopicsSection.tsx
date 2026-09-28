import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessagesSquare, Lock, Inbox } from 'lucide-react';
import {
  getConversations,
  getMyGroups,
  ConversationListItem,
  ProjectGroupListItem,
} from '../../api/network';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { MemberLink } from './MemberLink';
import { useAppNotifications } from '../../api/hooks/useAppNotifications';
import { groupUnreadByEntity } from '../../lib/notificationIndicators';
import type { AppNotificationResponse } from '../../schemas/notifications';

type PrivateItem =
  | {
      kind: 'conversation';
      id: string;
      title: string;
      memberId: string;
      memberName: string | null;
      memberEmail: string | null;
      subtitle: string;
      meta: string;
      at: string;
      unread?: AppNotificationResponse[];
    }
  | {
      kind: 'project';
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      at: string;
      unread?: AppNotificationResponse[];
    };

function toItems(
  conversations: ConversationListItem[],
  groups: ProjectGroupListItem[],
  unreadByConversation: Record<string, AppNotificationResponse[]>
): PrivateItem[] {
  const convs: PrivateItem[] = conversations.map((c) => ({
    kind: 'conversation',
    id: c.id,
    title: c.participant.name || c.participant.email,
    memberId: c.participant.id,
    memberName: c.participant.name,
    memberEmail: c.participant.email,
    subtitle: `Projeto ${c.project_title}`,
    meta: c.last_message ? c.last_message.slice(0, 120) : 'Comece a conversa',
    at: c.last_message_at || c.created_at,
    unread: unreadByConversation[c.id],
  }));
  const projects: PrivateItem[] = groups.map((g) => ({
    kind: 'project',
    id: g.id,
    title: g.project_title,
    subtitle: `${g.member_count} ${g.member_count === 1 ? 'participante' : 'participantes'}`,
    meta: g.last_post_at
      ? `Última atividade em ${new Date(g.last_post_at).toLocaleDateString('pt-BR')}`
      : 'Tópico recém-criado',
    at: g.last_post_at || g.created_at,
  }));
  return [...convs, ...projects].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

/** Notificação mais recente do grupo — é a que resume "o que há de novo". */
function latestOf(
  notifications: AppNotificationResponse[]
): AppNotificationResponse | undefined {
  return [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function PrivateTopicsSection() {
  const navigate = useNavigate();
  const { useNotificationsList } = useAppNotifications();
  const { data: unread } = useNotificationsList(undefined, true);
  const [items, setItems] = useState<PrivateItem[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [conversations, groups] = await Promise.all([
        getConversations(),
        getMyGroups(),
      ]);
      setItems(
        toItems(
          conversations,
          groups,
          groupUnreadByEntity(unread, 'conversation', 'conversation_message')
        )
      );
      setError('');
    } catch {
      setError('Erro ao carregar os tópicos privados. Tente novamente.');
    }
  }, [unread]);

  useEffect(() => {
    load();
  }, [load]);

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
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          {error}
        </div>
      )}

      {items !== null && items.length === 0 && (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock size={26} />
          </div>
          <h3 className="mb-2 text-[18px] font-bold text-foreground">
            Nenhum tópico privado
          </h3>
          <p className="text-[14px] text-muted-foreground">
            Publique um projeto: o tópico dele aparece aqui, e convites enviados a
            profissionais ganham uma conversa privada imediatamente.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {items?.map((item) => (
          <Card
            key={`${item.kind}-${item.id}`}
            className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
            onClick={() =>
              navigate(
                item.kind === 'conversation'
                  ? `/painel/conversas/${item.id}`
                  : `/painel/grupos/${item.id}`
              )
            }
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate(
                  item.kind === 'conversation'
                    ? `/painel/conversas/${item.id}`
                    : `/painel/grupos/${item.id}`
                );
              }
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[16px] font-bold text-foreground">
                  {item.kind === 'project' ? (
                    <MessagesSquare size={16} className="shrink-0 text-primary" />
                  ) : (
                    <Lock size={16} className="shrink-0 text-primary" />
                  )}
                  {item.kind === 'conversation' ? (
                    <MemberLink
                      memberId={item.memberId}
                      name={item.memberName}
                      email={item.memberEmail}
                      className="truncate"
                    />
                  ) : (
                    <span className="truncate">{item.title}</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="truncate">{item.subtitle}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {item.kind === 'project' ? 'Tópico do projeto' : 'Privada'}
                  </Badge>
                </div>
                {item.unread && item.unread.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2">
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                      {item.unread.length}{' '}
                      {item.unread.length === 1 ? 'nova' : 'novas'}
                    </span>
                    <p className="line-clamp-2 text-[13px] font-medium text-foreground">
                      {latestOf(item.unread)?.message}
                    </p>
                  </div>
                )}
                <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
                  {item.meta}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PrivateTopicsEmptyIcon() {
  return <Inbox size={26} />;
}