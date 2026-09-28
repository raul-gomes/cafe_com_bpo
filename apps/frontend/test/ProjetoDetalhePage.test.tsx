import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjetoDetalhePage } from '../src/pages/panel/ProjetoDetalhePage'
import { ProjectResponse } from '../src/api/network'

const mockGetProject = vi.hoisted(() => vi.fn())
const mockUpdateProject = vi.hoisted(() => vi.fn())
const mockDeleteProject = vi.hoisted(() => vi.fn())
const mockToggleProjectStatus = vi.hoisted(() => vi.fn())
const mockGetProjectApplications = vi.hoisted(() => vi.fn())
const mockAcceptApplication = vi.hoisted(() => vi.fn())
const mockDeclineApplication = vi.hoisted(() => vi.fn())
const mockGetGroup = vi.hoisted(() => vi.fn())
const mockGetProjectInvitations = vi.hoisted(() => vi.fn())
const mockCreateInvitation = vi.hoisted(() => vi.fn())
const mockSearchProfessionals = vi.hoisted(() => vi.fn())
const mockToastSuccess = vi.hoisted(() => vi.fn())
const mockConfirm = vi.hoisted(() => vi.fn())
const mockUseMarkEntityRead = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: vi.fn() },
}))

vi.mock('../src/components/ui/ConfirmDialog', () => ({
  useConfirm: () => mockConfirm,
}))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useMarkEntityRead: () => ({ mutate: mockUseMarkEntityRead }),
    useNotificationsList: () => ({ data: [] }),
    useUnreadCount: () => ({ data: { count: 0 } }),
  }),
}))

vi.mock('../src/api/network', () => ({
  getProject: mockGetProject,
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject,
  toggleProjectStatus: mockToggleProjectStatus,
  getProjectApplications: mockGetProjectApplications,
  acceptApplication: mockAcceptApplication,
  declineApplication: mockDeclineApplication,
  getGroup: mockGetGroup,
  getProjectInvitations: mockGetProjectInvitations,
  createInvitation: mockCreateInvitation,
  searchProfessionals: mockSearchProfessionals,
}))

const MEU: ProjectResponse = {
  id: 'p1',
  owner_id: 'user-1',
  owner: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
  title: 'Automação de fluxo fiscal',
  description: 'Projeto para automatizar o fluxo fiscal dos clientes do escritório.',
  status: 'open',
  team_size: 2,
  remote_type: 'remote',
  published_at: '2026-09-08T00:00:00Z',
  created_at: '2026-09-08T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
  skills: [{ id: 's1', name: 'Python', slug: 'python', is_active: true }],
  group_id: 'g1',
  is_group_member: true,
  is_owner: true,
  application_count: 1,
  applications_closed: false,
}

const PARTICIPANTE: ProjectResponse = {
  ...MEU,
  owner_id: 'user-9',
  owner: { id: 'user-9', name: 'Ana Souza', email: 'ana@cafe.com' },
  is_owner: false,
  application_count: 0,
}

const GROUP = {
  id: 'g1',
  project_id: 'p1',
  project_title: 'Automação de fluxo fiscal',
  is_member: true,
  members: [
    { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
    { id: 'user-9', name: 'Ana Souza', email: 'ana@cafe.com' },
  ],
  posts: [
    {
      id: 'b1',
      group_id: 'g1',
      author_id: 'user-1',
      author: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
      body: 'Começamos pelo fechamento de agosto.',
      created_at: '2026-09-20T00:00:00Z',
    },
  ],
  created_at: '2026-09-08T00:00:00Z',
}

const PROPOSTA = {
  id: 'a1',
  project_id: 'p1',
  project_title: 'Automação de fluxo fiscal',
  applicant: { id: 'user-7', name: 'Bruno Lima', email: 'bruno@cafe.com' },
  message: 'Tenho experiência com automação fiscal.',
  status: 'pending' as const,
  responded_at: null,
  created_at: '2026-09-19T00:00:00Z',
  conversation_id: null,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/painel/projetos/p1']}>
      <Routes>
        <Route path="/painel/projetos" element={<div>lista</div>} />
        <Route path="/painel/projetos/:id" element={<ProjetoDetalhePage />} />
        <Route path="/painel/grupos/:id" element={<div>topico</div>} />
        <Route path="/painel/membros/:id" element={<div>perfil</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProjetoDetalhePage — gestão de um projeto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockResolvedValue(true)
    mockGetProject.mockResolvedValue(MEU)
    mockUpdateProject.mockResolvedValue(MEU)
    mockDeleteProject.mockResolvedValue(undefined)
    mockToggleProjectStatus.mockResolvedValue({
      ...MEU,
      applications_closed: true,
    })
    mockGetProjectApplications.mockResolvedValue([PROPOSTA])
    mockAcceptApplication.mockResolvedValue({ ...PROPOSTA, status: 'accepted' })
    mockDeclineApplication.mockResolvedValue({ ...PROPOSTA, status: 'declined' })
    mockGetGroup.mockResolvedValue(GROUP)
    mockGetProjectInvitations.mockResolvedValue([
      {
        id: 'i1',
        project_id: 'p1',
        project_title: 'Automação de fluxo fiscal',
        invited_user: { id: 'user-5', name: 'Carla Dias', email: 'carla@cafe.com' },
        message: 'Quero você no time',
        status: 'pending',
        responded_at: null,
        created_at: '2026-09-18T00:00:00Z',
        conversation_id: null,
      },
    ])
    mockCreateInvitation.mockResolvedValue({})
    mockSearchProfessionals.mockResolvedValue([
      {
        id: 'user-8',
        name: 'Diego Alves',
        email: 'diego@cafe.com',
        biografia: 'BPO financeiro há 5 anos.',
        skills: [{ id: 's1', name: 'Python', slug: 'python', is_active: true }],
      },
    ])
  })

  it('mostra o projeto com autor, descrição e habilidades', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Automação de fluxo fiscal' })
    ).toBeInTheDocument()
    expect(screen.getByText(/automatizar o fluxo fiscal/i)).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('mostra as abas do dono, incluindo Propostas', async () => {
    renderPage()

    expect(await screen.findByRole('tab', { name: 'Visão geral' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Propostas/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Equipe' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tópico' })).toBeInTheDocument()
  })

  it('esconde Propostas, edição e arquivamento para quem só participa', async () => {
    mockGetProject.mockResolvedValue(PARTICIPANTE)
    renderPage()

    await screen.findByRole('heading', { name: 'Automação de fluxo fiscal' })
    expect(screen.queryByRole('tab', { name: /Propostas/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar projeto/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Arquivar/i })).not.toBeInTheDocument()
  })

  it('avisa que o projeto não existe', async () => {
    mockGetProject.mockRejectedValue(new Error('404'))
    renderPage()

    expect(
      await screen.findByText('Não foi possível carregar este projeto. Tente novamente.')
    ).toBeInTheDocument()
  })

  it('edita o projeto com título, descrição e habilidades', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Editar projeto/i }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Novo título' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar projeto/i }))

    await waitFor(() =>
      expect(mockUpdateProject).toHaveBeenCalledWith('p1', {
        title: 'Novo título',
        description: MEU.description,
        skills: ['Python'],
      })
    )
  })

  it('fecha e reabre as propostas do projeto', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Fechar propostas/i }))

    await waitFor(() => expect(mockToggleProjectStatus).toHaveBeenCalledWith('p1'))
    expect(await screen.findByRole('button', { name: /Reabrir propostas/i })).toBeInTheDocument()
  })

  it('arquiva o projeto e volta para a lista', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Arquivar/i }))

    expect(mockConfirm).toHaveBeenCalled()
    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledWith('p1'))
    expect(await screen.findByText('lista')).toBeInTheDocument()
  })

  it('lista as propostas recebidas e aceita uma', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: /Propostas/ }))

    expect(await screen.findByText('Bruno Lima')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta de Bruno Lima/i }))

    await waitFor(() => expect(mockAcceptApplication).toHaveBeenCalledWith('a1'))
  })

  it('recusa uma proposta recebida', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: /Propostas/ }))
    await screen.findByText('Bruno Lima')
    fireEvent.click(screen.getByRole('button', { name: /Recusar proposta de Bruno Lima/i }))

    await waitFor(() => expect(mockDeclineApplication).toHaveBeenCalledWith('a1'))
  })

  it('mostra a equipe e o status dos convites na aba Equipe', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Equipe' }))

    const equipe = await screen.findByText('Equipe do projeto')
    expect(equipe).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(await screen.findByText('Carla Dias')).toBeInTheDocument()
    expect(screen.getByText('Aguardando resposta')).toBeInTheDocument()
  })

  it('convida um profissional encontrado pela busca de habilidades', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Equipe' }))
    await screen.findByText('Convide profissionais')
    fireEvent.click(screen.getByRole('button', { name: /Buscar profissionais/i }))

    await screen.findByText('Diego Alves')
    fireEvent.click(screen.getByRole('button', { name: /Selecionar Diego Alves/i }))
    fireEvent.change(screen.getByLabelText(/Mensagem para Diego/i), {
      target: { value: 'Quero você no time' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar convite/i }))

    await waitFor(() =>
      expect(mockCreateInvitation).toHaveBeenCalledWith('p1', {
        invited_user_id: 'user-8',
        message: 'Quero você no time',
      })
    )
  })

  it('exige a mensagem do convite antes de enviar', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Equipe' }))
    await screen.findByText('Convide profissionais')
    fireEvent.click(screen.getByRole('button', { name: /Buscar profissionais/i }))
    await screen.findByText('Diego Alves')
    fireEvent.click(screen.getByRole('button', { name: /Selecionar Diego Alves/i }))
    fireEvent.click(screen.getByRole('button', { name: /Enviar convite/i }))

    expect(await screen.findByText('Escreva a mensagem do convite.')).toBeInTheDocument()
    expect(mockCreateInvitation).not.toHaveBeenCalled()
  })

  it('não oferece convidar para quem só participa', async () => {
    mockGetProject.mockResolvedValue(PARTICIPANTE)
    mockGetProjectInvitations.mockRejectedValue(new Error('403'))
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Equipe' }))

    expect(await screen.findByText('Equipe do projeto')).toBeInTheDocument()
    expect(screen.queryByText('Convide profissionais')).not.toBeInTheDocument()
  })

  it('mostra o tópico do projeto com as últimas publicações', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Tópico' }))

    expect(
      await screen.findByText('Começamos pelo fechamento de agosto.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir o tópico/i })).toHaveAttribute(
      'href',
      '/painel/grupos/g1'
    )
  })

  it('explica que o tópico ainda não existe quando o projeto não tem grupo', async () => {
    mockGetProject.mockResolvedValue({ ...MEU, group_id: null })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Automação de fluxo fiscal' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Tópico' })).not.toBeInTheDocument()
  })

  it('leva ao detalhe pelo histórico do navegador', async () => {
    renderPage()

    fireEvent.click(await screen.findByText('Projetos'))
    expect(await screen.findByText('lista')).toBeInTheDocument()
  })
})
