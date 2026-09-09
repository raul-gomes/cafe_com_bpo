import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { ProjectsSection } from '../src/components/network/ProjectsSection'
import { ProjectResponse } from '../src/api/network'

const mockGetProjects = vi.hoisted(() => vi.fn())
const mockCreateProject = vi.hoisted(() => vi.fn())
const mockUpdateProject = vi.hoisted(() => vi.fn())
const mockDeleteProject = vi.hoisted(() => vi.fn())
const mockSearchSkills = vi.hoisted(() => vi.fn())
const mockSearchProfessionals = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  getProjects: mockGetProjects,
  createProject: mockCreateProject,
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject,
  searchSkills: mockSearchSkills,
  searchProfessionals: mockSearchProfessionals,
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
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
  skills: [
    { id: 's1', name: 'Python', slug: 'python', is_active: true },
    { id: 's2', name: 'Excel', slug: 'excel', is_active: true },
  ],
  group_id: 'g1',
  is_group_member: true,
  is_owner: false,
  application_count: 0,
  applications_closed: false,
}

const FOREIGN_PROJECT: ProjectResponse = {
  ...PROJECT,
  id: 'p2',
  owner_id: 'user-2',
  title: 'Migração contábil',
  description: 'Migrar a contabilidade de clientes para uma nova plataforma.',
  skills: [{ id: 's3', name: 'Contabilidade', slug: 'contabilidade', is_active: true }],
}

function renderSection() {
  return render(
    <MemoryRouter>
      <ConfirmProvider>
        <ProjectsSection />
      </ConfirmProvider>
    </MemoryRouter>
  )
}

describe('ProjectsSection — preview do mural de projetos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProjects.mockResolvedValue({ items: [PROJECT], total: 1 })
    mockCreateProject.mockResolvedValue(PROJECT)
    mockUpdateProject.mockResolvedValue(PROJECT)
    mockDeleteProject.mockResolvedValue(undefined)
    mockSearchProfessionals.mockResolvedValue([])
  })

  it('lista projetos com título, autoria e skills', async () => {
    mockGetProjects.mockResolvedValue({ items: [PROJECT, FOREIGN_PROJECT], total: 2 })
    renderSection()

    expect(await screen.findByText('Automação de fluxo fiscal')).toBeInTheDocument()
    expect(screen.getByText('Migração contábil')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Excel')).toBeInTheDocument()
    expect(screen.getByText('Contabilidade')).toBeInTheDocument()
    expect(screen.getAllByText(/Raul Gomes/i).length).toBeGreaterThan(0)
  })

  it('mostra botões editar e excluir apenas para o dono do projeto', async () => {
    mockGetProjects.mockResolvedValue({ items: [PROJECT, FOREIGN_PROJECT], total: 2 })
    renderSection()

    expect(await screen.findByText('Automação de fluxo fiscal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Editar projeto Automação de fluxo fiscal/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Excluir projeto Automação de fluxo fiscal/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar projeto Migração contábil/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluir projeto Migração contábil/i })).not.toBeInTheDocument()
  })

  it('salva um novo projeto com formulário e recarrega a lista', async () => {
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /Criar Projeto/i }))
    fireEvent.change(screen.getByLabelText(/Título do projeto/i), {
      target: { value: 'Boa governança contábil' },
    })
    fireEvent.change(screen.getByLabelText(/Descrição do projeto/i), {
      target: { value: 'Organizar os processos contábeis dos clientes.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Salvar Projeto/i }))

    await waitFor(() =>
      expect(mockCreateProject).toHaveBeenCalledWith({
        title: 'Boa governança contábil',
        description: 'Organizar os processos contábeis dos clientes.',
        skills: [],
      })
    )
    expect(mockGetProjects).toHaveBeenCalledTimes(2)
  })

  it('edita um projeto do dono: expande o próprio card, pré-preenche e salva', async () => {
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /Editar projeto Automação de fluxo fiscal/i }))

    expect(screen.queryByText('Novo Projeto')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Título do projeto/i)).toHaveValue('Automação de fluxo fiscal')
    expect(screen.getByLabelText(/Descrição do projeto/i)).toHaveValue(
      'Projeto para automatizar o fluxo fiscal dos clientes do escritório.'
    )

    fireEvent.change(screen.getByLabelText(/Título do projeto/i), {
      target: { value: 'Automação fiscal 2.0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar Projeto/i }))

    await waitFor(() =>
      expect(mockUpdateProject).toHaveBeenCalledWith('p1', {
        title: 'Automação fiscal 2.0',
        description: 'Projeto para automatizar o fluxo fiscal dos clientes do escritório.',
        skills: ['Python', 'Excel'],
      })
    )
    expect(mockCreateProject).not.toHaveBeenCalled()
    expect(mockGetProjects).toHaveBeenCalledTimes(2)
  })

  it('cancela a edição inline sem salvar alterações', async () => {
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /Editar projeto Automação de fluxo fiscal/i }))
    fireEvent.change(screen.getByLabelText(/Título do projeto/i), {
      target: { value: 'Mudança descartada' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }))

    expect(mockUpdateProject).not.toHaveBeenCalled()
    expect(screen.getByText('Automação de fluxo fiscal')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelar/i })).not.toBeInTheDocument()
  })

  it('valida descrição muito curta (mínimo 10 caracteres)', async () => {
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /Criar Projeto/i }))
    fireEvent.change(screen.getByLabelText(/Título do projeto/i), {
      target: { value: 'Título válido' },
    })
    fireEvent.change(screen.getByLabelText(/Descrição do projeto/i), {
      target: { value: 'curto' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar Projeto/i }))

    expect(await screen.findByText(/pelo menos 10 caracteres/i)).toBeInTheDocument()
    expect(mockCreateProject).not.toHaveBeenCalled()
  })

  it('valida título e descrição obrigatórios no formulário', async () => {
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /Criar Projeto/i }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar Projeto/i }))

    expect(await screen.findByText(/Preencha título e descrição/i)).toBeInTheDocument()
    expect(mockCreateProject).not.toHaveBeenCalled()
  })

  it('cria o projeto já convidando profissionais selecionados', async () => {
    mockSearchProfessionals.mockResolvedValue([
      {
        id: 'u2',
        name: 'Ana Souza',
        email: 'ana@cafe.com',
        biografia: 'BPO financeiro há 5 anos.',
        skills: [{ id: 's1', name: 'Python', slug: 'python', is_active: true }],
      },
    ])
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /Criar Projeto/i }))
    fireEvent.change(screen.getByLabelText(/Título do projeto/i), {
      target: { value: 'Boa governança contábil' },
    })
    fireEvent.change(screen.getByLabelText(/Descrição do projeto/i), {
      target: { value: 'Organizar os processos contábeis dos clientes.' },
    })

    const skillsInput = screen.getByRole('textbox', { name: /Habilidades/i })
    fireEvent.change(skillsInput, { target: { value: 'Python' } })
    fireEvent.keyDown(skillsInput, { key: 'Enter' })

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))

    await screen.findByText(/Profissionais selecionados \(1\)/i)
    fireEvent.change(
      screen.getByRole('textbox', { name: /Mensagem para Ana Souza/i }),
      { target: { value: 'Topa uma parceria no BPO?' } }
    )

    fireEvent.click(screen.getByRole('button', { name: /Salvar Projeto/i }))

    await waitFor(() =>
      expect(mockCreateProject).toHaveBeenCalledWith({
        title: 'Boa governança contábil',
        description: 'Organizar os processos contábeis dos clientes.',
        skills: ['Python'],
        invites: [
          {
            invited_user_id: 'u2',
            message: 'Topa uma parceria no BPO?',
          },
        ],
      })
    )
    expect(mockGetProjects).toHaveBeenCalledTimes(2)
  })

  it('exige mensagem personalizada para cada profissional selecionado', async () => {
    mockSearchProfessionals.mockResolvedValue([
      {
        id: 'u2',
        name: 'Ana Souza',
        email: 'ana@cafe.com',
        biografia: 'BPO financeiro há 5 anos.',
        skills: [{ id: 's1', name: 'Python', slug: 'python', is_active: true }],
      },
    ])
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /Criar Projeto/i }))
    fireEvent.change(screen.getByLabelText(/Título do projeto/i), {
      target: { value: 'Boa governança contábil' },
    })
    fireEvent.change(screen.getByLabelText(/Descrição do projeto/i), {
      target: { value: 'Organizar os processos contábeis dos clientes.' },
    })
    const skillsInput = screen.getByRole('textbox', { name: /Habilidades/i })
    fireEvent.change(skillsInput, { target: { value: 'Python' } })
    fireEvent.keyDown(skillsInput, { key: 'Enter' })

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))

    fireEvent.click(screen.getByRole('button', { name: /Salvar Projeto/i }))

    expect(
      await screen.findByText(
        /Preencha a mensagem personalizada de cada profissional selecionado/i
      )
    ).toBeInTheDocument()
    expect(mockCreateProject).not.toHaveBeenCalled()
  })
})