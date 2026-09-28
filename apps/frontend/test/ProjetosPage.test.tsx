import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProjetosPage } from '../src/pages/panel/ProjetosPage'
import { ProjectResponse } from '../src/api/network'

const mockGetMyProjects = vi.hoisted(() => vi.fn())
const mockGetProjects = vi.hoisted(() => vi.fn())
const mockCreateProject = vi.hoisted(() => vi.fn())
const mockDeleteProject = vi.hoisted(() => vi.fn())
const mockToastSuccess = vi.hoisted(() => vi.fn())
const mockToastError = vi.hoisted(() => vi.fn())
const mockConfirm = vi.hoisted(() => vi.fn())
const mockUseNotificationsList = vi.hoisted(() => vi.fn())
const mockUseMarkEntityRead = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

vi.mock('../src/components/ui/ConfirmDialog', () => ({
  useConfirm: () => mockConfirm,
}))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useMarkEntityRead: () => ({ mutate: mockUseMarkEntityRead }),
    useNotificationsList: () => ({ data: mockUseNotificationsList() }),
    useUnreadCount: () => ({ data: { count: 0 } }),
  }),
}))

vi.mock('../src/api/network', () => ({
  getMyProjects: mockGetMyProjects,
  getProjects: mockGetProjects,
  createProject: mockCreateProject,
  deleteProject: mockDeleteProject,
}))

const BASE: ProjectResponse = {
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
  is_owner: true,
  application_count: 0,
  applications_closed: false,
}

const MEU: ProjectResponse = { ...BASE }
const PARTICIPO: ProjectResponse = {
  ...BASE,
  id: 'p2',
  title: 'Migração de ERP contábil',
  owner_id: 'user-9',
  owner: { id: 'user-9', name: 'Ana Souza', email: 'ana@cafe.com' },
  is_owner: false,
  is_group_member: true,
  group_id: 'g2',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/painel/projetos']}>
      <Routes>
        <Route path="/painel/projetos" element={<ProjetosPage />} />
        <Route path="/painel/projetos/:id" element={<div>detalhe</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProjetosPage — Gestão › Projetos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockResolvedValue(true)
    mockUseNotificationsList.mockReturnValue([])
    mockGetMyProjects.mockResolvedValue([MEU, PARTICIPO])
    mockCreateProject.mockResolvedValue(MEU)
    mockDeleteProject.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra breadcrumb e título da página', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Projetos' })).toBeInTheDocument()
    expect(screen.getByText('Painel')).toBeInTheDocument()
  })

  it('separa os projetos que eu criei dos que eu participo', async () => {
    renderPage()

    expect(await screen.findByText('Automação de fluxo fiscal')).toBeInTheDocument()
    const abaMeus = screen.getByRole('tab', { name: /Meus projetos/i })
    expect(within(abaMeus).getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Participo/i }))
    expect(screen.getByText('Migração de ERP contábil')).toBeInTheDocument()
    expect(screen.queryByText('Automação de fluxo fiscal')).not.toBeInTheDocument()
  })

  it('resume os indicadores no topo', async () => {
    mockGetMyProjects.mockResolvedValue([
      { ...MEU, application_count: 2 },
      PARTICIPO,
    ])
    renderPage()

    expect(await screen.findByText('Propostas aguardando você')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Projetos que você participa')).toBeInTheDocument()
  })

  it('exibe o contador de propostas pendentes no card do dono', async () => {
    mockGetMyProjects.mockResolvedValue([{ ...MEU, application_count: 3 }])
    renderPage()

    expect(await screen.findByText('3 novas propostas')).toBeInTheDocument()
  })

  it('avisa quando o projeto está fechado para novas propostas', async () => {
    mockGetMyProjects.mockResolvedValue([{ ...MEU, applications_closed: true }])
    renderPage()

    expect(await screen.findByText('Propostas fechadas')).toBeInTheDocument()
  })

  it('leva ao detalhe do projeto', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('link', { name: /Abrir projeto/i }))

    expect(await screen.findByText('detalhe')).toBeInTheDocument()
  })

  it('oferece o link do tópico do projeto', async () => {
    renderPage()

    expect(await screen.findByRole('link', { name: /Ver tópico/i })).toBeInTheDocument()
  })

  it('não oferece link de tópico para quem não participa do projeto', async () => {
    mockGetMyProjects.mockResolvedValue([{ ...MEU, group_id: null, is_group_member: false }])
    renderPage()

    await screen.findByText('Automação de fluxo fiscal')
    expect(screen.queryByRole('link', { name: /Ver tópico/i })).not.toBeInTheDocument()
  })

  it('busca com debounce de 300ms e descarta a resposta antiga', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderPage()
    await waitFor(() => expect(mockGetMyProjects).toHaveBeenCalledTimes(1))

    const busca = screen.getByLabelText('Buscar projetos')
    fireEvent.change(busca, { target: { value: 'auto' } })
    fireEvent.change(busca, { target: { value: 'automação' } })
    expect(mockGetMyProjects).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(300)
    await waitFor(() => expect(mockGetMyProjects).toHaveBeenCalledTimes(2))
    expect(mockGetMyProjects).toHaveBeenLastCalledWith({ q: 'automação' })
  })

  it('mostra a lupa dentro do campo de busca e botão de limpar', async () => {
    renderPage()

    const busca = await screen.findByLabelText('Buscar projetos')
    const grupo = busca.closest('[data-slot="input-group"]')
    expect(grupo).not.toBeNull()
    expect(grupo?.querySelector('[data-slot="input-group-addon"] svg')).not.toBeNull()

    fireEvent.change(busca, { target: { value: 'fiscal' } })
    const limpar = await screen.findByRole('button', { name: /limpar busca/i })
    fireEvent.click(limpar)
    expect(busca).toHaveValue('')
  })

  it('cria um projeto com título, descrição e habilidades', async () => {
    mockCreateProject.mockResolvedValue(MEU)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Novo projeto/i }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Novo projeto' } })
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Descrição completa do projeto para a comunidade.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar projeto/i }))

    await waitFor(() =>
      expect(mockCreateProject).toHaveBeenCalledWith({
        title: 'Novo projeto',
        description: 'Descrição completa do projeto para a comunidade.',
        skills: [],
      })
    )
  })

  it('exige título e descrição com 10 caracteres para criar', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Novo projeto/i }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar projeto/i }))

    expect(await screen.findByText('Informe o título do projeto')).toBeInTheDocument()
    expect(mockCreateProject).not.toHaveBeenCalled()
  })

  it('avisa quando o projeto não pôde ser salvo', async () => {
    mockCreateProject.mockRejectedValue(new Error('boom'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Novo projeto/i }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Projeto' } })
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Descrição longa o suficiente do projeto.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar projeto/i }))

    expect(await screen.findByText('Não foi possível salvar o projeto.')).toBeInTheDocument()
  })

  it('arquiva o projeto com confirmação e recarrega a lista', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Arquivar Automação de fluxo fiscal/i }))
    expect(mockConfirm).toHaveBeenCalled()
    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(mockGetMyProjects).toHaveBeenCalledTimes(2))
  })

  it('não arquiva quando a confirmação é recusada', async () => {
    mockConfirm.mockResolvedValue(false)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Arquivar Automação de fluxo fiscal/i }))

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    expect(mockDeleteProject).not.toHaveBeenCalled()
  })

  it('não oferece arquivar no projeto que eu apenas participo', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: /Participo/i }))

    expect(
      screen.queryByRole('button', { name: /Arquivar Migração de ERP contábil/i })
    ).not.toBeInTheDocument()
  })

  it('explica o estado vazio da aba Meus projetos', async () => {
    mockGetMyProjects.mockResolvedValue([])
    renderPage()

    expect(
      await screen.findByText(/Você ainda não criou nenhum projeto/i)
    ).toBeInTheDocument()
  })

  it('avisa quando a lista não carrega', async () => {
    mockGetMyProjects.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(
      await screen.findByText('Não foi possível carregar seus projetos. Tente novamente.')
    ).toBeInTheDocument()
  })

  it('leva ao detalhe a partir das novas propostas', async () => {
    mockUseNotificationsList.mockReturnValue([
      {
        id: 'n1',
        type: 'project_application',
        title: 'Nova proposta',
        message: 'Alguém_propôs para Automação de fluxo fiscal',
        is_read: false,
        related_entity_id: 'p1',
        created_at: '2026-09-27T12:00:00Z',
      },
    ])
    renderPage()

    const aviso = await screen.findByText(/Alguém_propôs/)
    fireEvent.click(aviso)

    expect(await screen.findByText('detalhe')).toBeInTheDocument()
  })
})
