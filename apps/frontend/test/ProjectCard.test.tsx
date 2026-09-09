import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectCard } from '../src/components/network/ProjectCard'
import { ProjectResponse } from '../src/api/network'

const mockSearchSkills = vi.hoisted(() => vi.fn())
const mockSearchProfessionals = vi.hoisted(() => vi.fn())
const mockCreateInvitation = vi.hoisted(() => vi.fn())
const mockGetProjectInvitations = vi.hoisted(() => vi.fn())
const mockApplyToProject = vi.hoisted(() => vi.fn())
const mockGetProjectApplications = vi.hoisted(() => vi.fn())
const mockAcceptApplication = vi.hoisted(() => vi.fn())
const mockDeclineApplication = vi.hoisted(() => vi.fn())
const mockToggleProjectStatus = vi.hoisted(() => vi.fn())
const mockToastSuccess = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess },
}))

vi.mock('../src/api/network', () => ({
  searchSkills: mockSearchSkills,
  searchProfessionals: mockSearchProfessionals,
  createInvitation: mockCreateInvitation,
  getProjectInvitations: mockGetProjectInvitations,
  applyToProject: mockApplyToProject,
  getProjectApplications: mockGetProjectApplications,
  acceptApplication: mockAcceptApplication,
  declineApplication: mockDeclineApplication,
  toggleProjectStatus: mockToggleProjectStatus,
}))

const PROJECT: ProjectResponse = {
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
  updated_at: '2026-09-08T00:00:00Z',
  skills: [{ id: 's1', name: 'Python', slug: 'python', is_active: true }],
  group_id: 'g1',
  is_group_member: true,
  is_owner: false,
  application_count: 0,
  applications_closed: false,
}

const PERSON = {
  id: 'u2',
  name: 'Ana Souza',
  email: 'ana@cafe.com',
  biografia: 'BPO financeiro há 5 anos.',
  skills: [{ id: 's1', name: 'Python', slug: 'python', is_active: true }],
}

function renderCard(currentUserId = 'user-1') {
  return render(
    <MemoryRouter>
      <ProjectCard
        project={PROJECT}
        currentUserId={currentUserId}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    </MemoryRouter>
  )
}

function renderProject(project: ProjectResponse, currentUserId = 'user-1') {
  return render(
    <MemoryRouter>
      <ProjectCard
        project={project}
        currentUserId={currentUserId}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    </MemoryRouter>
  )
}

async function addInviteSkill(name: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /Habilidades/i }), {
    target: { value: name },
  })
  fireEvent.keyDown(screen.getByRole('textbox', { name: /Habilidades/i }), {
    key: 'Enter',
  })
}

describe('ProjectCard — convidar profissionais dentro do card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchSkills.mockResolvedValue([])
    mockSearchProfessionals.mockResolvedValue([])
    mockGetProjectInvitations.mockResolvedValue([])
  })

  it('abre o painel de convidar e carrega os convidados', async () => {
    mockGetProjectInvitations.mockResolvedValue([
      {
        id: 'i1',
        project_id: 'p1',
        project_title: 'Automação de fluxo fiscal',
        invited_user: { id: 'u3', name: 'Beatriz Lima', email: 'bia@cafe.com' },
        message: 'Bora?',
        status: 'accepted',
        responded_at: '2026-09-08T10:00:00Z',
        created_at: '2026-09-08T00:00:00Z',
        conversation_id: 'c9',
      },
    ])
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /Convidar profissionais para Automação/i })
    )

    expect(screen.getByText('Convidar profissionais')).toBeInTheDocument()
    expect(await screen.findByText('Beatriz Lima')).toBeInTheDocument()
    expect(await screen.findByText('Aceito')).toBeInTheDocument()
  })

  it('busca profissional ao vivo e envia convite com mensagem personalizada', async () => {
    mockSearchProfessionals.mockResolvedValue([PERSON])
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /Convidar profissionais para Automação/i })
    )
    await addInviteSkill('Python')

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(mockSearchProfessionals).toHaveBeenCalledWith(['Python'], 'any')

    fireEvent.click(screen.getByRole('button', { name: /Selecionar/i }))
    fireEvent.change(
      screen.getByRole('textbox', { name: /Mensagem personalizada/i }),
      { target: { value: 'Gostei muito do seu perfil para este projeto!' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /Enviar convite/i }))

    await waitFor(() =>
      expect(mockCreateInvitation).toHaveBeenCalledWith('p1', {
        invited_user_id: 'u2',
        message: 'Gostei muito do seu perfil para este projeto!',
      })
    )
  })

  it('some os resultados quando todas as habilidades são removidas', async () => {
    mockSearchProfessionals.mockResolvedValue([PERSON])
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /Convidar profissionais para Automação/i })
    )
    await addInviteSkill('Python')
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Remover Python/i }))

    await waitFor(() =>
      expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument()
    )
    expect(
      screen.queryByText(/Nenhum profissional encontrado/i)
    ).not.toBeInTheDocument()
  })

  it('não exibe o botão de convidar para quem não é dono', () => {
    renderCard('user-other')

    expect(
      screen.queryByRole('button', { name: /Convidar profissionais/i })
    ).not.toBeInTheDocument()
  })
})

describe('ProjectCard — enviar proposta (candidato)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchSkills.mockResolvedValue([])
    mockSearchProfessionals.mockResolvedValue([])
    mockGetProjectInvitations.mockResolvedValue([])
    mockApplyToProject.mockResolvedValue({ id: 'a1' })
  })

  it('exibe o botão de enviar proposta para quem não é dono', () => {
    renderProject({ ...PROJECT, owner_id: 'user-other' }, 'user-aplic')
    expect(
      screen.getByRole('button', { name: /Enviar proposta/i })
    ).toBeInTheDocument()
  })

  it('não exibe o botão de enviar proposta para o dono', () => {
    renderCard()
    expect(
      screen.queryByRole('button', { name: /Enviar proposta/i })
    ).not.toBeInTheDocument()
  })

  it('abre o formulário, valida e envia a proposta', async () => {
    mockApplyToProject.mockResolvedValue({ id: 'a1', status: 'pending' })
    renderProject({ ...PROJECT, owner_id: 'user-other' }, 'user-aplic')

    fireEvent.click(
      screen.getByRole('button', { name: /Enviar proposta/i })
    )
    expect(
      screen.getByRole('textbox', { name: /Mensagem da proposta/i })
    ).toBeInTheDocument()

    fireEvent.change(
      screen.getByRole('textbox', { name: /Mensagem da proposta/i }),
      { target: { value: 'Tenho experiência e quero participar!' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /^Enviar proposta$/ }))

    await waitFor(() =>
      expect(mockApplyToProject).toHaveBeenCalledWith('p1', {
        message: 'Tenho experiência e quero participar!',
      })
    )
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Proposta enviada! O dono do projeto irá avaliar.'
    )
  })

  it('não envia proposta muito curta', async () => {
    renderProject({ ...PROJECT, owner_id: 'user-other' }, 'user-aplic')

    fireEvent.click(
      screen.getByRole('button', { name: /Enviar proposta/i })
    )
    fireEvent.change(
      screen.getByRole('textbox', { name: /Mensagem da proposta/i }),
      { target: { value: 'curta' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /^Enviar proposta$/ }))

    await waitFor(() =>
      expect(
        screen.getByText(/pelo menos 10 caracteres/i)
      ).toBeInTheDocument()
    )
    expect(mockApplyToProject).not.toHaveBeenCalled()
  })

  it('renderiza aviso quando o projeto está fechado para propostas', () => {
    renderProject(
      { ...PROJECT, owner_id: 'user-other', applications_closed: true },
      'user-aplic'
    )
    expect(
      screen.queryByRole('button', { name: /Enviar proposta/i })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/fechado para novas propostas/i)
    ).toBeInTheDocument()
  })
})

describe('ProjectCard — painel de propostas do dono', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchSkills.mockResolvedValue([])
    mockSearchProfessionals.mockResolvedValue([])
    mockGetProjectInvitations.mockResolvedValue([])
    mockGetProjectApplications.mockResolvedValue([])
    mockAcceptApplication.mockResolvedValue({})
    mockDeclineApplication.mockResolvedValue({})
    mockToggleProjectStatus.mockResolvedValue({})
  })

  it('exibe o botão de propostas para o dono com o contador', () => {
    renderProject({ ...PROJECT, application_count: 3 })
    expect(
      screen.getByRole('button', { name: /Ver propostas/i })
    ).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('não exibe o botão de propostas para terceiros', () => {
    renderProject(
      { ...PROJECT, owner_id: 'user-other', application_count: 3 },
      'user-aplic'
    )
    expect(
      screen.queryByRole('button', { name: /Ver propostas/i })
    ).not.toBeInTheDocument()
  })

  it('abre o painel e lista as propostas dos candidatos', async () => {
    mockAcceptApplication.mockResolvedValue({
      id: 'ap1',
      project_id: 'p1',
      project_title: 'Automação de fluxo fiscal',
      applicant: { id: 'u9', name: 'Carla Dias', email: 'carla@cafe.com' },
      message: 'Sou contadora com experiência em apuração.',
      status: 'accepted',
      responded_at: '2026-09-09T10:10:00Z',
      created_at: '2026-09-09T10:00:00Z',
      conversation_id: null,
    })
    mockGetProjectApplications.mockResolvedValue([
      {
        id: 'ap1',
        project_id: 'p1',
        project_title: 'Automação de fluxo fiscal',
        applicant: { id: 'u9', name: 'Carla Dias', email: 'carla@cafe.com' },
        message: 'Sou contadora com experiência em apuração.',
        status: 'pending',
        responded_at: null,
        created_at: '2026-09-09T10:00:00Z',
        conversation_id: null,
      },
    ])
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /Ver propostas/i })
    )

    expect(await screen.findByText('Carla Dias')).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Aceitar proposta de Carla Dias/i })
    )
    await waitFor(() => expect(mockAcceptApplication).toHaveBeenCalledWith('ap1'))
  })

  it('toggla o fechamento do projeto para novas propostas', async () => {
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /Ver propostas/i })
    )
    const toggle = await screen.findByRole('button', {
      name: /Fechar para propostas/i,
    })
    fireEvent.click(toggle)

    await waitFor(() =>
      expect(mockToggleProjectStatus).toHaveBeenCalledWith('p1')
    )
  })
})

describe('ProjectCard — acesso ao tópico do projeto', () => {
  it('exibe o link do tópico do projeto para o dono', () => {
    renderCard()
    expect(
      screen.getByRole('button', { name: /Abrir o tópico do projeto/i })
    ).toBeInTheDocument()
  })

  it('exibe o link do tópico para membro convidado', () => {
    renderProject(PROJECT, 'user-member')
    expect(
      screen.getByRole('button', { name: /Abrir o tópico do projeto/i })
    ).toBeInTheDocument()
  })

  it('oculta o link quando o grupo não existe', () => {
    renderProject({ ...PROJECT, group_id: null })
    expect(
      screen.queryByRole('button', { name: /Abrir o tópico do projeto/i })
    ).not.toBeInTheDocument()
  })

  it('oculta o link para terceiros que não são membros', () => {
    renderProject(
      { ...PROJECT, owner_id: 'user-other', is_group_member: false },
      'somebody-else'
    )
    expect(
      screen.queryByRole('button', { name: /Abrir o tópico do projeto/i })
    ).not.toBeInTheDocument()
  })
})