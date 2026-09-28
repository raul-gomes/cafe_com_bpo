import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NetworkPage } from '../src/pages/panel/NetworkPage'
import { PostResponse } from '../src/api/network'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

const mockGetPosts = vi.hoisted(() => vi.fn())
const mockGetProjects = vi.hoisted(() => vi.fn())
const mockCreateProject = vi.hoisted(() => vi.fn())
const mockDeleteProject = vi.hoisted(() => vi.fn())
const mockSearchSkills = vi.hoisted(() => vi.fn())
const mockGetConversations = vi.hoisted(() => vi.fn())
const mockGetMyGroups = vi.hoisted(() => vi.fn())
const mockUnreadNotifications = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock('../src/api/network', () => ({
  getPosts: mockGetPosts,
  getProjects: mockGetProjects,
  createProject: mockCreateProject,
  deleteProject: mockDeleteProject,
  searchSkills: mockSearchSkills,
  getConversations: mockGetConversations,
  getMyGroups: mockGetMyGroups,
}))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useUnreadCount: () => ({ data: { count: mockUnreadNotifications.current.length } }),
    useNotificationsList: () => ({ data: mockUnreadNotifications.current }),
    useMarkAsRead: () => ({ mutate: vi.fn() }),
    useMarkAllAsRead: () => ({ mutate: vi.fn() }),
    useDeleteNotification: () => ({ mutate: vi.fn() }),
  }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

const POST: PostResponse = {
  id: 'post-1',
  author_id: 'user-1',
  author: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
  title: 'Como reduzir custos com BPO financeiro?',
  message: 'Dúvida sobre redução de custos.',
  tags: ['bpo', 'vendas'],
  status: 'open',
  comments_count: 2,
  views_count: 12,
  last_activity_at: '2026-09-01T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

function renderPage() {
  return render(
    <ConfirmProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NetworkPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ConfirmProvider>
  )
}

describe('NetworkPage - abas Fórum e Projetos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPosts.mockReset()
    mockGetProjects.mockReset()
    mockGetConversations.mockReset()
    mockGetMyGroups.mockReset()
  })

  it('renderiza as duas abas: Fórum e Projetos', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
    renderPage()

    expect(await screen.findByRole('tab', { name: /Fórum/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Projetos/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Grupos/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Conversas/i })).not.toBeInTheDocument()
  })

  it('aba Fórum exibe a listagem de tópicos', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
    renderPage()

    expect(await screen.findByText('Como reduzir custos com BPO financeiro?')).toBeInTheDocument()
    expect(screen.queryByText(/em breve/i)).not.toBeInTheDocument()
  })

  it('aba Projetos é só a vitrine do mural, sem gestão', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
    mockGetProjects.mockResolvedValue({ items: [], total: 0 })
    renderPage()

    const projectsTab = await screen.findByRole('tab', { name: /Projetos/i })
    fireEvent.click(projectsTab)

    expect(await screen.findByText(/Nenhum projeto publicado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Criar Projeto/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Como reduzir custos com BPO financeiro?')).not.toBeInTheDocument()
  })

  it('Fórum privado mostra os tópicos privados unificados', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
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
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Privados/i }))

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText(/Projeto Automação de fluxo fiscal/i)).toBeInTheDocument()
    expect(screen.getByText('Privada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Criar Tópico/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Como reduzir custos com BPO financeiro?')).not.toBeInTheDocument()
  })
})
describe('NetworkPage - link do autor para o perfil do membro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPosts.mockReset()
    mockGetProjects.mockReset()
    mockGetConversations.mockReset()
    mockGetMyGroups.mockReset()
  })

  it('torna o nome do autor clicavel para o perfil do membro', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
    mockGetProjects.mockResolvedValue({ items: [], total: 0 })
    renderPage()

    const authorLink = await screen.findByRole('link', { name: 'Raul Gomes' })
    expect(authorLink).toHaveAttribute('href', '/painel/membros/user-1')
  })

  it('o clique no autor nao navega para o topico do card', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
    mockGetProjects.mockResolvedValue({ items: [], total: 0 })
    renderPage()

    const authorLink = await screen.findByRole('link', { name: 'Raul Gomes' })
    fireEvent.click(authorLink)

    expect(mockGetPosts).toHaveBeenCalledTimes(1)
  })

  describe('sinalizacao de novidades', () => {
    beforeEach(() => {
      mockUnreadNotifications.current = []
    })

    it('conta mensagem nova no botao Privados', async () => {
      mockUnreadNotifications.current = [
        { id: 'n1', type: 'conversation_message', is_read: false, created_at: '2026-09-27T10:00:00Z' },
        { id: 'n2', type: 'conversation_invite', is_read: false, created_at: '2026-09-27T11:00:00Z' },
      ]

      renderPage()

      await waitFor(() => expect(mockGetPosts).toHaveBeenCalled())
      const privateBtn = screen.getByRole('button', { name: /Privados/ })
      expect(within(privateBtn).getByLabelText('2 novidades')).toBeInTheDocument()
    })

    it('conta resposta nova no botao Publicos', async () => {
      mockUnreadNotifications.current = [
        { id: 'n3', type: 'post_commented', is_read: false, created_at: '2026-09-27T10:00:00Z' },
      ]

      renderPage()

      await waitFor(() => expect(mockGetPosts).toHaveBeenCalled())
      const publicBtn = screen.getByRole('button', { name: /Públicos/ })
      expect(within(publicBtn).getByLabelText('1 novidade')).toBeInTheDocument()
    })

    it('nao conta proposta na aba Projetos: a vitrine nao sinaliza, a gestao que mostra', async () => {
      mockUnreadNotifications.current = [
        { id: 'n4', type: 'project_application', is_read: false, created_at: '2026-09-27T10:00:00Z' },
        { id: 'n5', type: 'application_accepted', is_read: false, created_at: '2026-09-27T11:00:00Z' },
      ]

      renderPage()

      await waitFor(() => expect(mockGetPosts).toHaveBeenCalled())
      const projectsTab = screen.getByRole('tab', { name: /Projetos/ })
      expect(within(projectsTab).queryByLabelText(/novidade/)).not.toBeInTheDocument()
    })

    it('nao mostra contador quando nao ha nada novo', async () => {
      renderPage()

      await waitFor(() => expect(mockGetPosts).toHaveBeenCalled())
      expect(screen.queryByLabelText(/novidade/)).not.toBeInTheDocument()
    })
  })

  describe('sinalizacao de resposta nova', () => {
    beforeEach(() => {
      mockUnreadNotifications.current = []
    })

    it('marca o meu topico que recebeu resposta', async () => {
      mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
      mockUnreadNotifications.current = [
        {
          id: 'n1',
          type: 'post_commented',
          is_read: false,
          related_entity_type: 'discussion_post',
          related_entity_id: 'post-1',
          message: 'voce usou qual biblioteca?',
          created_at: '2026-09-27T10:00:00Z',
        },
      ]

      renderPage()

      expect(await screen.findByText('1 nova resposta')).toBeInTheDocument()
      expect(screen.getByText('voce usou qual biblioteca?')).toBeInTheDocument()
    })

    it('nao marca topico de outra pessoa', async () => {
      mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
      mockUnreadNotifications.current = [
        {
          id: 'n1',
          type: 'post_commented',
          is_read: false,
          related_entity_type: 'discussion_post',
          related_entity_id: 'post-2',
          message: 'comentario em outro topico',
          created_at: '2026-09-27T10:00:00Z',
        },
      ]

      renderPage()

      await screen.findByText('Como reduzir custos com BPO financeiro?')
      expect(screen.queryByText(/nova resposta/)).not.toBeInTheDocument()
    })
  })
})
