import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { NotificationBell } from '../src/components/panel/NotificationBell'

// vi.hoisted roda antes do módulo, então cada factory precisa ser autossuficiente
const mockMarkAsRead = vi.hoisted(() =>
  vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined) }))
)
const mockMarkAllAsRead = vi.hoisted(() =>
  vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined) }))
)
const mockDeleteNotification = vi.hoisted(() =>
  vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined) }))
)
const mockNotifications = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useUnreadCount: () => ({ data: { count: mockNotifications.current.length } }),
    useNotificationsList: () => ({ data: mockNotifications.current }),
    useMarkAsRead: () => mockMarkAsRead(),
    useMarkAllAsRead: () => mockMarkAllAsRead(),
    useDeleteNotification: () => mockDeleteNotification(),
  }),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderBell() {
  return render(
    <MemoryRouter initialEntries={['/painel']}>
      <LocationProbe />
      <Routes>
        <Route path="/painel" element={<NotificationBell />} />
        <Route path="/painel/forum" element={<div>comunidade</div>} />
        <Route path="/painel/membros/:userId" element={<div>perfil</div>} />
      </Routes>
    </MemoryRouter>
  )
}

async function openBellAndClick(text: string) {
  fireEvent.click(screen.getByRole('button'))
  const item = await screen.findByText(text)
  fireEvent.click(item)
}

describe('NotificationBell — destino das notificações', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotifications.current = []
  })

  it('notificação de proposta em projeto abre a gestão de projetos', async () => {
    mockNotifications.current = [
      {
        id: 'n1',
        type: 'project_application',
        title: 'Nova proposta',
        message: 'Alguém_propôs',
        is_read: false,
        related_entity_id: 'p1',
        created_at: '2026-09-27T12:00:00Z',
      },
    ]
    renderBell()

    await openBellAndClick('Nova proposta')

    expect(screen.getByTestId('location').textContent).toBe('/painel/projetos')
  })

  it('notificação de comentário no perfil abre o perfil do membro', async () => {
    mockNotifications.current = [
      {
        id: 'n2',
        type: 'profile_comment',
        title: 'Comentário sobre o seu trabalho',
        message: 'Alguém comentou no seu perfil',
        is_read: false,
        related_entity_id: 'user-9',
        created_at: '2026-09-27T12:00:00Z',
      },
    ]
    renderBell()

    await openBellAndClick('Comentário sobre o seu trabalho')

    expect(screen.getByTestId('location').textContent).toBe('/painel/membros/user-9')
  })
})
