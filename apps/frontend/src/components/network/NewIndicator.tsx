import React from 'react';
import { useAppNotifications } from '../../api/hooks/useAppNotifications';
import { countByCategory, type NotificationCategory } from '../../lib/notificationIndicators';

type Props = {
  category: NotificationCategory;
  /** Versão compacta para usar dentro de uma linha de botões. */
  className?: string;
};

/**
 * Contador de novidades de uma área da Comunidade.
 *
 * Uma notificação não lida é um item sinalizado. O número some sozinho quando o
 * usuário abre o item (o backend marca como lida), sem estado extra no front.
 */
export const NewIndicator: React.FC<Props> = ({ category, className }) => {
  const { useNotificationsList } = useAppNotifications();
  const { data: notifications } = useNotificationsList(undefined, true);
  const count = countByCategory(notifications)[category];

  if (count === 0) return null;

  return (
    <span
      aria-label={`${count} ${count === 1 ? 'novidade' : 'novidades'}`}
      className={`inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--ds-primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${className ?? ''}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};
