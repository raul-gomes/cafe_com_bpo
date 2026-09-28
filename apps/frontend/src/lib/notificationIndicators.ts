import type { AppNotificationResponse } from '../schemas/notifications'

/**
 * Traduz as notificações não lidas em sinalização da Comunidade.
 *
 * Uma notificação não lida é um item a sinalizar. A categoria define ONDE o
 * indicador aparece (aba/botão) e o par (related_entity_type + type) define
 * QUAL item é sinalizado (a conversa, o tópico, o projeto).
 *
 * "Visto" = o usuário abriu o item, e o item some da lista de não lidas
 * (backend `POST /notifications/mark-read`). A sinalização some junto.
 */

export type NotificationCategory = 'private' | 'public' | 'projects' | 'profile'

export type CategoryCounts = Record<NotificationCategory, number>

export const CATEGORY_BY_TYPE: Record<string, NotificationCategory> = {
  conversation_message: 'private',
  conversation_invite: 'private',
  post_commented: 'public',
  project_application: 'projects',
  application_accepted: 'projects',
  profile_comment: 'profile',
}

export function emptyCategoryCounts(): CategoryCounts {
  return { private: 0, public: 0, projects: 0, profile: 0 }
}

export function countByCategory(
  notifications: AppNotificationResponse[] | undefined,
): CategoryCounts {
  const counts = emptyCategoryCounts()
  for (const notification of notifications ?? []) {
    if (notification.is_read) continue
    const category = CATEGORY_BY_TYPE[notification.type]
    if (category) counts[category] += 1
  }
  return counts
}

/** Não lidas de um tipo, agrupadas por entidade (id da conversa, do tópico…). */
export function groupUnreadByEntity(
  notifications: AppNotificationResponse[] | undefined,
  entityType: string,
  type: string,
): Record<string, AppNotificationResponse[]> {
  const grouped: Record<string, AppNotificationResponse[]> = {}
  for (const notification of notifications ?? []) {
    if (notification.is_read) continue
    if (notification.type !== type) continue
    if (notification.related_entity_type !== entityType) continue
    const id = notification.related_entity_id
    if (!id) continue
    grouped[id] = [...(grouped[id] ?? []), notification]
  }
  return grouped
}

/** Notificação não lida mais recente de uma entidade — a que resume "o que há de novo". */
export function latestUnreadForEntity(
  notifications: AppNotificationResponse[] | undefined,
  entityType: string,
  entityId: string,
): AppNotificationResponse | undefined {
  let latest: AppNotificationResponse | undefined
  for (const notification of notifications ?? []) {
    if (notification.is_read) continue
    if (notification.related_entity_type !== entityType) continue
    if (notification.related_entity_id !== entityId) continue
    if (!latest || notification.created_at > latest.created_at) {
      latest = notification
    }
  }
  return latest
}
