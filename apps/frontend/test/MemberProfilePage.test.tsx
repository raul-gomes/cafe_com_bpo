import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemberProfilePage } from '../src/pages/panel/MemberProfilePage'

const mockGetMemberProfile = vi.hoisted(() => vi.fn())
const mockGetProfileComments = vi.hoisted(() => vi.fn())
const mockCreateProfileComment = vi.hoisted(() => vi.fn())
const mockDeleteProfileComment = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', async () => {
  const actual = await vi.importActual<typeof import('../src/api/network')>(
    '../src/api/network'
  )
  return {
    ...actual,
    getMemberProfile: mockGetMemberProfile,
    getProfileComments: mockGetProfileComments,
    createProfileComment: mockCreateProfileComment,
    deleteProfileComment: mockDeleteProfileComment,
  }
})

const mockUser = { id: 'user-1', name: 'Visitante' }
const mockUseAuth = vi.hoisted(() => vi.fn())
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const PROFILE = {
  id: 'user-2',
  name: 'Marina Souza',
  avatar_url: 'https://cdn.cafe.com/marina.png',
  biografia: 'BPO financeiro para clinicas medicas ha 6 anos.',
  company_name: 'Marina Souza Contabilidade',
  company_segment: 'Contabilidade',
  company_city: 'Belo Horizonte',
  company_state: 'MG',
  created_at: '2026-03-10T12:00:00Z',
  skills: [
    { id: 'skill-1', name: 'Contabilidade', slug: 'contabilidade', is_active: true },
  ],
  comments_count: 2,
  is_owner: false,
  can_comment: true,
}

const COMMENTS = {
  total: 2,
  items: [
    {
      id: 'comment-1',
      user_id: 'user-2',
      author_id: 'user-3',
      author: { id: 'user-3', name: 'Bruno Lima', avatar_url: null },
      message: 'Entreguei tres clientes para a Marina e o resultado foi excelente.',
      created_at: '2026-09-20T14:00:00Z',
      can_delete: false,
    },
    {
      id: 'comment-2',
      user_id: 'user-2',
      author_id: 'user-1',
      author: { id: 'user-1', name: 'Visitante', avatar_url: null },
      message: 'Muito serio e pontual nos entregas.',
      created_at: '2026-09-21T09:00:00Z',
      can_delete: true,
    },
  ],
}

function renderPage(entries: string[] = ['/painel/membros/user-2']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={entries}>
        <LocationProbe />
        <Routes>
          <Route path="/painel/membros/:userId" element={<MemberProfilePage />} />
          <Route path="/painel/forum/:id" element={<div>topico</div>} />
          <Route path="/painel/forum" element={<div>comunidade</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MemberProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: mockUser })
    mockGetMemberProfile.mockResolvedValue(PROFILE)
    mockGetProfileComments.mockResolvedValue(COMMENTS)
    mockCreateProfileComment.mockResolvedValue(COMMENTS.items[1])
    mockDeleteProfileComment.mockResolvedValue(undefined)
  })

  it('mostra_dados_do_membro_skills_e_empresa', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument()
    })
    expect(screen.getByText(/BPO financeiro para clinicas/)).toBeInTheDocument()
    expect(screen.getByText('Contabilidade')).toBeInTheDocument()
    expect(screen.getByText('Marina Souza Contabilidade')).toBeInTheDocument()
    expect(screen.getByText(/Belo Horizonte/)).toBeInTheDocument()
    expect(mockGetMemberProfile).toHaveBeenCalledWith('user-2')
  })

  it('nao_exibe_contato_nem_email', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument())
    expect(screen.queryByText(/@/)).not.toBeInTheDocument()
    expect(screen.queryByText(/whatsapp/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/CPF/)).not.toBeInTheDocument()
    expect(screen.queryByText(/CNPJ/)).not.toBeInTheDocument()
  })

  it('lista_comentarios_sobre_o_trabalho', async () => {
    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText(/Entreguei tres clientes para a Marina/)
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
    expect(screen.getByText('Muito serio e pontual nos entregas.')).toBeInTheDocument()
  })

  it('renderiza_comentario_como_texto_sem_interpretar_html', async () => {
    mockGetProfileComments.mockResolvedValue({
      total: 1,
      items: [
        {
          ...COMMENTS.items[0],
          message: '<img src=x onerror=alert(1)>Review',
        },
      ],
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('<img src=x onerror=alert(1)>Review')).toBeInTheDocument()
    })
    expect(document.querySelector('img')).toBeNull()
  })

  it('permite_comentar_e_lista_o_novo_comentario', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument())
    const textarea = screen.getByPlaceholderText(/sobre o trabalho/i)
    fireEvent.change(textarea, { target: { value: 'Profissionalismo exemplar.' } })
    fireEvent.click(screen.getByRole('button', { name: /comentar/i }))

    await waitFor(() => {
      expect(mockCreateProfileComment).toHaveBeenCalledWith(
        'user-2',
        'Profissionalismo exemplar.'
      )
    })
  })

  it('nao_mostra_formulario_para_o_dono_do_perfil', async () => {
    mockGetMemberProfile.mockResolvedValue({
      ...PROFILE,
      is_owner: true,
      can_comment: false,
    })

    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument())
    expect(screen.queryByPlaceholderText(/sobre o trabalho/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Este é o seu perfil/i)).toBeInTheDocument()
  })

  it('permite_apagar_comentario_quando_o_usuario_pode', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Muito serio e pontual nos entregas.')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /excluir/i }))

    await waitFor(() => {
      expect(mockDeleteProfileComment).toHaveBeenCalledWith('comment-2')
    })
  })

  it('trata_perfil_inexistente', async () => {
    mockGetMemberProfile.mockRejectedValue(new Error('404'))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Membro não encontrado/i)).toBeInTheDocument()
    })
  })

  it('torna o autor do comentario clicavel para o perfil dele', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: 'Bruno Lima' })
    expect(link).toHaveAttribute('href', '/painel/membros/user-3')
  })

  it('o botao voltar retorna para a ultima pagina vista', async () => {
    renderPage(['/painel/forum/post-1', '/painel/membros/user-2'])

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }))

    expect(screen.getByTestId('location').textContent).toBe('/painel/forum/post-1')
  })

  it('sem pagina anterior no historico, voltar leva a Comunidade', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }))

    expect(screen.getByTestId('location').textContent).toBe('/painel/forum')
  })

  it('o breadcrumb leva para a Comunidade (rota existente)', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument())
    const crumb = screen.getByRole('link', { name: 'Comunidade' })
    expect(crumb).toHaveAttribute('href', '/painel/forum')
  })
})
