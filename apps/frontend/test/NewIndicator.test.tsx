import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NewIndicator } from '../src/components/network/NewIndicator'
import type { AppNotificationResponse } from '../src/schemas/notifications'

const mockNotifications = vi.hoisted(() => ({ current: [] as AppNotificationResponse[] }))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useNotificationsList: () => ({ data: mockNotifications.current }),
    useUnreadCount: () => ({ data: { count: mockNotifications.current.length } }),
  }),
}))

function renderIndicator(category: 'private' | 'public' | 'projects' | 'profile') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NewIndicator category={category} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function notif(over: Partial<AppNotificationResponse>): AppNotificationResponse {
  return {
    id: 'n1',
    title: 'Nova mensagem de Bia',
    message: 'consegue revisar?',
    type: 'conversation_message',
    is_read: false,
    created_at: '2026-09-27T12:00:00Z',
    ...over,
  }
}

describe('NewIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotifications.current = []
  })

  it('conta as não lidas da categoria e mostra o número', () => {
    mockNotifications.current = [
      notif({ id: 'a', type: 'conversation_message' }),
      notif({ id: 'b', type: 'conversation_invite' }),
      notif({ id: 'c', type: 'post_commented' }),
    ]

    renderIndicator('private')

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('esconde o número acima de 99 e mostra "99+"', () => {
    mockNotifications.current = Array.from({ length: 120 }, (_, i) =>
      notif({ id: `n${i}`, type: 'post_commented' }),
    )

    renderIndicator('public')

    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('não renderiza nada quando não há nada novo na categoria', () => {
    mockNotifications.current = [notif({ id: 'a', type: 'post_commented' })]

    const { container } = renderIndicator('private')

    expect(container).toBeEmptyDOMElement()
  })

  it('ignora notificações já lidas', () => {
    mockNotifications.current = [
      notif({ id: 'a', type: 'conversation_message', is_read: true }),
    ]

    const { container } = renderIndicator('private')

    expect(container).toBeEmptyDOMElement()
  })

  it('anuncia a quantidade para leitores de tela', () => {
    mockNotifications.current = [notif({ id: 'a', type: 'project_application' })]

    renderIndicator('projects')

    expect(screen.getByLabelText('1 novidade')).toBeInTheDocument()
  })
})
