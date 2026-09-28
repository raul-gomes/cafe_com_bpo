import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { PrivateTopicsSection } from '../src/components/network/PrivateTopicsSection'

const mockGetConversations = vi.hoisted(() => vi.fn())
const mockGetMyGroups = vi.hoisted(() => vi.fn())
const mockUnreadNotifications = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock('../src/api/network', () => ({
  getConversations: mockGetConversations,
  getMyGroups: mockGetMyGroups,
}))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useNotificationsList: () => ({ data: mockUnreadNotifications.current }),
    useUnreadCount: () => ({ data: { count: mockUnreadNotifications.current.length } }),
  }),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/painel/forum']}>
      <Routes>
        <Route path="/painel/forum" element={<PrivateTopicsSection />} />
        <Route path="/painel/conversas/:id" element={<LocationProbe />} />
        <Route path="/painel/membros/:userId" element={<LocationProbe />} />
        <Route path="/painel/grupos/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PrivateTopicsSection — tópicos privados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConversations.mockResolvedValue([
      {
        id: 'c1',
        project_id: 'p1',
        project_title: 'Automação de fluxo fiscal',
        participant: { id: 'u2', name: 'Ana Souza', email: 'ana@cafe.com' },
        last_message: 'Aceito!',
        last_message_at: '2026-09-08T12:00:00Z',
        created_at: '2026-09-08T11:00:00Z',
      },
    ])
    mockGetMyGroups.mockResolvedValue([
      {
        id: 'g9',
        project_id: 'p9',
        project_title: 'Migração de plataforma contábil',
        member_count: 3,
        last_post_at: null,
        created_at: '2026-09-08T09:00:00Z',
      },
    ])
  })

  it('lista conversas privadas e tópicos de projetos juntos', async () => {
    renderSection()

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('Migração de plataforma contábil')).toBeInTheDocument()
    expect(screen.getByText('Privada')).toBeInTheDocument()
    expect(screen.getByText('Tópico do projeto')).toBeInTheDocument()
    expect(screen.getByText('Projeto Automação de fluxo fiscal')).toBeInTheDocument()
    expect(screen.getByText(/3 participantes/i)).toBeInTheDocument()
  })

  it('conversa navega para /painel/conversas/:id ao clicar no card', async () => {
    renderSection()
    const subtitle = await screen.findByText('Projeto Automação de fluxo fiscal')
    fireEvent.click(subtitle)
    expect(screen.getByTestId('location').textContent).toBe('/painel/conversas/c1')
  })

  it('exibe estado vazio quando não há tópicos', async () => {
    mockGetConversations.mockResolvedValue([])
    mockGetMyGroups.mockResolvedValue([])
    renderSection()

    expect(await screen.findByText('Nenhum tópico privado')).toBeInTheDocument()
  })

  it('mostra erro quando a carga falha', async () => {
    mockGetConversations.mockRejectedValue(new Error('fail'))
    renderSection()

    expect(
      await screen.findByText(/Erro ao carregar os tópicos privados/i)
    ).toBeInTheDocument()
  })
})

describe('PrivateTopicsSection - link para o perfil do participante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConversations.mockResolvedValue([
      {
        id: 'c1',
        project_id: 'p1',
        project_title: 'Automação de fluxo fiscal',
        participant: { id: 'u2', name: 'Ana Souza', email: 'ana@cafe.com' },
        last_message: 'Aceito!',
        last_message_at: '2026-09-08T12:00:00Z',
        created_at: '2026-09-08T11:00:00Z',
      },
    ])
    mockGetMyGroups.mockResolvedValue([])
  })

  it('torna o nome da pessoa clicavel na lista de privados', async () => {
    renderSection()

    const link = await screen.findByRole('link', { name: 'Ana Souza' })
    expect(link).toHaveAttribute('href', '/painel/membros/u2')
  })

  it('clicar no nome abre o perfil em vez do card da conversa', async () => {
    renderSection()

    fireEvent.click(await screen.findByRole('link', { name: 'Ana Souza' }))
    expect(screen.getByTestId('location').textContent).toBe('/painel/membros/u2')
  })

  describe('sinalizacao de mensagem nova', () => {
    beforeEach(() => {
      mockUnreadNotifications.current = []
    })

    it('mostra quantas mensagens novas a conversa tem', async () => {
      mockUnreadNotifications.current = [
        {
          id: 'n1',
          type: 'conversation_message',
          is_read: false,
          related_entity_type: 'conversation',
          related_entity_id: 'c1',
          message: 'consegue revisar a planilha?',
          created_at: '2026-09-27T10:00:00Z',
        },
        {
          id: 'n2',
          type: 'conversation_message',
          is_read: false,
          related_entity_type: 'conversation',
          related_entity_id: 'c1',
          message: 'e o prazo?',
          created_at: '2026-09-27T11:00:00Z',
        },
      ]

      renderSection()

      expect(await screen.findByText('2 novas')).toBeInTheDocument()
      expect(screen.getByText('e o prazo?')).toBeInTheDocument()
    })

    it('sinaliza so a conversa que recebeu mensagem', async () => {
      mockUnreadNotifications.current = [
        {
          id: 'n1',
          type: 'conversation_message',
          is_read: false,
          related_entity_type: 'conversation',
          related_entity_id: 'c9',
          message: 'outra conversa',
          created_at: '2026-09-27T10:00:00Z',
        },
      ]

      renderSection()

      await screen.findByText('Aceito!')
      expect(screen.queryByText(/nova/)).not.toBeInTheDocument()
    })

    it('nao sinaliza conversa sem mensagem nova', async () => {
      renderSection()

      expect(await screen.findByText('Aceito!')).toBeInTheDocument()
      expect(screen.queryByText(/nova/)).not.toBeInTheDocument()
    })

    it('abre a conversa ao clicar no marcador', async () => {
      mockUnreadNotifications.current = [
        {
          id: 'n1',
          type: 'conversation_message',
          is_read: false,
          related_entity_type: 'conversation',
          related_entity_id: 'c1',
          message: 'oi',
          created_at: '2026-09-27T10:00:00Z',
        },
      ]

      renderSection()

      fireEvent.click(await screen.findByText('1 nova'))

      expect(screen.getByTestId('location').textContent).toBe('/painel/conversas/c1')
    })
  })
})
