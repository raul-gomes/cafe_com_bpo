import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NetworkPostPage } from '../src/pages/panel/NetworkPostPage'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

const mockGetPost = vi.hoisted(() => vi.fn())
const mockGetComments = vi.hoisted(() => vi.fn())
const mockMarkEntityRead = vi.hoisted(() => vi.fn())
const mockCreateComment = vi.hoisted(() => vi.fn())
const mockDeletePost = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  getPost: mockGetPost,
  getComments: mockGetComments,
  createComment: mockCreateComment,
  deletePost: mockDeletePost,
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Raul Gomes' } }),
}))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useMarkEntityRead: () => ({ mutate: mockMarkEntityRead }),
    useNotificationsList: () => ({ data: [] }),
    useUnreadCount: () => ({ data: { count: 0 } }),
  }),
}))

const POST = {
  id: 'post-1',
  author_id: 'user-2',
  author: { id: 'user-2', name: 'Marina Souza', email: 'marina@cafe.com' },
  title: 'Como reduzir custos com BPO financeiro?',
  message: 'Dúvida sobre redução de custos.',
  tags: ['bpo'],
  status: 'open',
  comments_count: 1,
  views_count: 3,
  last_activity_at: '2026-09-01T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const COMMENTS = [
  {
    id: 'comment-1',
    post_id: 'post-1',
    author_id: 'user-3',
    author: { id: 'user-3', name: 'Bruno Lima', email: 'bruno@cafe.com' },
    message: 'Resposta válida.',
    created_at: '2026-09-02T00:00:00Z',
  },
]

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <ConfirmProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/painel/forum/post-1']}>
          <Routes>
            <Route path="/painel/forum/:id" element={<NetworkPostPage />} />
            <Route path="/painel/membros/:userId" element={<div>perfil</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ConfirmProvider>
  )
}

describe('NetworkPostPage - link do autor para o perfil do membro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPost.mockResolvedValue(POST)
    mockGetComments.mockResolvedValue(COMMENTS)
  })

  it('torna o autor do post clicavel para o perfil', async () => {
    renderPage()

    const authorLink = await screen.findByRole('link', { name: 'Marina Souza' })
    expect(authorLink).toHaveAttribute('href', '/painel/membros/user-2')
  })

  it('torna o autor do comentario clicavel para o perfil', async () => {
    renderPage()

    const authorLink = await screen.findByRole('link', { name: 'Bruno Lima' })
    expect(authorLink).toHaveAttribute('href', '/painel/membros/user-3')
  })


  it('marca como vistas as notificacoes do topico ao abrir', async () => {
    renderPage()

    await waitFor(() => expect(mockGetPost).toHaveBeenCalledWith('post-1'))
    expect(mockMarkEntityRead).toHaveBeenCalledWith({
      related_entity_type: 'discussion_post',
      related_entity_id: 'post-1',
    })
  })
})
