import { render, screen, fireEvent } from '@testing-library/react'
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

vi.mock('../src/api/network', () => ({
  getPosts: mockGetPosts,
  getProjects: mockGetProjects,
  createProject: mockCreateProject,
  deleteProject: mockDeleteProject,
  searchSkills: mockSearchSkills,
}))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useUnreadCount: () => ({ data: { count: 0 } }),
    useNotificationsList: () => ({ data: [] }),
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
  })

  it('renderiza as duas abas: Fórum e Projetos', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
    renderPage()

    expect(await screen.findByRole('tab', { name: /Fórum/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Projetos/i })).toBeInTheDocument()
  })

  it('aba Fórum exibe a listagem de tópicos', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
    renderPage()

    expect(await screen.findByText('Como reduzir custos com BPO financeiro?')).toBeInTheDocument()
    expect(screen.queryByText(/em breve/i)).not.toBeInTheDocument()
  })

  it('aba Projetos mostra o mural com o CTA de criar projeto', async () => {
    mockGetPosts.mockResolvedValue({ items: [POST], total: 1 })
    mockGetProjects.mockResolvedValue({ items: [], total: 0 })
    renderPage()

    const projectsTab = await screen.findByRole('tab', { name: /Projetos/i })
    fireEvent.click(projectsTab)

    expect(await screen.findByRole('button', { name: /Criar Projeto/i })).toBeInTheDocument()
    expect(screen.getByText(/Nenhum projeto publicado/i)).toBeInTheDocument()
    expect(screen.queryByText('Como reduzir custos com BPO financeiro?')).not.toBeInTheDocument()
  })
})