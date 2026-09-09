import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProjectGroupPage } from '../src/pages/panel/ProjectGroupPage'

const mockGetGroup = vi.hoisted(() => vi.fn())
const mockCreateGroupPost = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  getGroup: mockGetGroup,
  createGroupPost: mockCreateGroupPost,
}))

const GROUP = {
  id: 'g1',
  project_id: 'p1',
  project_title: 'Automação de fluxo fiscal',
  is_member: true,
  members: [
    { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
    { id: 'user-2', name: 'Ana Souza', email: 'ana@cafe.com' },
  ],
  posts: [
    {
      id: 'post-1',
      group_id: 'g1',
      author_id: 'user-1',
      author: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
      body: 'Equipe, alinhemos o escopo do primeiro entregável.',
      created_at: '2026-09-09T10:00:00Z',
    },
  ],
  created_at: '2026-09-08T00:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/painel/grupos/g1']}>
      <Routes>
        <Route path="/painel/grupos/:id" element={<ProjectGroupPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProjectGroupPage — tópico do projeto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGroup.mockResolvedValue(GROUP)
    mockCreateGroupPost.mockResolvedValue({
      id: 'post-2',
      group_id: 'g1',
      author_id: 'user-1',
      author: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
      body: 'Novo alinhamento.',
      created_at: '2026-09-09T12:00:00Z',
    })
  })

  it('exibe título do projeto, participantes e posts do tópico', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: 'Automação de fluxo fiscal',
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/2 participantes/)).toBeInTheDocument()
    expect(screen.getByText('Equipe, alinhemos o escopo do primeiro entregável.')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há posts', async () => {
    mockGetGroup.mockResolvedValue({ ...GROUP, posts: [] })
    renderPage()

    expect(
      await screen.findByText(/Seja o primeiro a postar/i)
    ).toBeInTheDocument()
  })

  it('publica um post no tópico', async () => {
    renderPage()
    await screen.findByText('Equipe, alinhemos o escopo do primeiro entregável.')

    fireEvent.change(
      screen.getByRole('textbox', { name: /Post no tópico do projeto/i }),
      { target: { value: 'Eu posso assumir a planilha de controle.' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))

    await waitFor(() =>
      expect(mockCreateGroupPost).toHaveBeenCalledWith(
        'g1',
        'Eu posso assumir a planilha de controle.'
      )
    )
    expect(mockGetGroup).toHaveBeenCalledWith('g1')
  })

  it('não publica post vazio', async () => {
    renderPage()
    await screen.findByText('Equipe, alinhemos o escopo do primeiro entregável.')

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))

    expect(mockCreateGroupPost).not.toHaveBeenCalled()
  })

  it('exibe erro quando o grupo não é encontrado', async () => {
    mockGetGroup.mockRejectedValue(new Error('404'))
    renderPage()

    expect(
      await screen.findByText(/Grupo não encontrado ou erro de conexão/i)
    ).toBeInTheDocument()
  })
})