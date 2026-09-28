import { describe, it, expect } from 'vitest'
import {
  CATEGORY_BY_TYPE,
  countByCategory,
  emptyCategoryCounts,
  groupUnreadByEntity,
  latestUnreadForEntity,
} from '../src/lib/notificationIndicators'
import type { AppNotificationResponse } from '../src/schemas/notifications'

function notif(over: Partial<AppNotificationResponse>): AppNotificationResponse {
  return {
    id: 'n1',
    user_id: 'u1',
    title: 'titulo',
    message: 'mensagem',
    type: 'conversation_message',
    is_read: false,
    created_at: '2026-09-27T12:00:00Z',
    ...over,
  }
}

describe('notificationIndicators', () => {
  it('mapeia cada tipo de notificação para a sua categoria', () => {
    expect(CATEGORY_BY_TYPE.conversation_message).toBe('private')
    expect(CATEGORY_BY_TYPE.conversation_invite).toBe('private')
    expect(CATEGORY_BY_TYPE.post_commented).toBe('public')
    expect(CATEGORY_BY_TYPE.project_application).toBe('projects')
    expect(CATEGORY_BY_TYPE.application_accepted).toBe('projects')
    expect(CATEGORY_BY_TYPE.profile_comment).toBe('profile')
  })

  it('conta as não lidas por categoria', () => {
    const counts = countByCategory([
      notif({ id: 'a', type: 'conversation_message' }),
      notif({ id: 'b', type: 'conversation_message' }),
      notif({ id: 'c', type: 'conversation_invite' }),
      notif({ id: 'd', type: 'post_commented' }),
      notif({ id: 'e', type: 'project_application' }),
      notif({ id: 'f', type: 'application_accepted' }),
      notif({ id: 'g', type: 'profile_comment' }),
    ])

    expect(counts.private).toBe(3)
    expect(counts.public).toBe(1)
    expect(counts.projects).toBe(2)
    expect(counts.profile).toBe(1)
  })

  it('ignora notificações lidas e de tipo desconhecido', () => {
    const counts = countByCategory([
      notif({ id: 'a', type: 'conversation_message', is_read: true }),
      notif({ id: 'b', type: 'tipo_inventado' }),
    ])

    expect(counts).toEqual(emptyCategoryCounts())
  })

  it('agrupa as não lidas por entidade e devolve só as do tipo pedido', () => {
    const grouped = groupUnreadByEntity(
      [
        notif({ id: 'a', type: 'conversation_message', related_entity_type: 'conversation', related_entity_id: 'c1' }),
        notif({ id: 'b', type: 'conversation_message', related_entity_type: 'conversation', related_entity_id: 'c1' }),
        notif({ id: 'c', type: 'post_commented', related_entity_type: 'discussion_post', related_entity_id: 'p1' }),
        notif({ id: 'd', type: 'conversation_message', is_read: true, related_entity_type: 'conversation', related_entity_id: 'c2' }),
        notif({ id: 'e', type: 'conversation_message', related_entity_type: 'conversation' }),
      ],
      'conversation',
      'conversation_message',
    )

    expect(Object.keys(grouped)).toEqual(['c1'])
    expect(grouped.c1).toHaveLength(2)
  })

  it('devolve a notificação não lida mais recente de uma entidade', () => {
    const latest = latestUnreadForEntity(
      [
        notif({
          id: 'antiga',
          type: 'conversation_message',
          related_entity_type: 'conversation',
          related_entity_id: 'c1',
          created_at: '2026-09-20T10:00:00Z',
        }),
        notif({
          id: 'recente',
          type: 'conversation_message',
          related_entity_type: 'conversation',
          related_entity_id: 'c1',
          created_at: '2026-09-27T10:00:00Z',
        }),
      ],
      'conversation',
      'c1',
    )

    expect(latest?.id).toBe('recente')
  })

  it('devolve undefined quando não há nada novo na entidade', () => {
    expect(latestUnreadForEntity([], 'conversation', 'c1')).toBeUndefined()
  })
})
