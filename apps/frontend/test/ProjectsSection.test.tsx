import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { ProjectsSection } from '../src/components/network/ProjectsSection'
import { ProjectResponse } from '../src/api/network'

const mockGetProjects = vi.hoisted(() => vi.fn())
const mockCreateProject = vi.hoisted(() => vi.fn())
const mockDeleteProject = vi.hoisted(() => vi.fn())
const mockSearchSkills = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  getProjects: mockGetProjects,
  createProject: mockCreateProject,
  deleteProject: mockDeleteProject,
  searchSkills: mockSearchSkills,
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
    <ConfirmProvider>
      <ProjectsSection />
    </ConfirmProvider>
  )
}

describe('ProjectsSection — preview do mural de projetos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProjects.mockResolvedValue({ items: [PROJECT], total: 1 })
    mockCreateProject.mockResolvedValue(PROJECT)
    mockDeleteProject.mockResolvedValue(undefined)
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

  it('mostra botão excluir apenas para o dono do projeto', async () => {
    mockGetProjects.mockResolvedValue({ items: [PROJECT, FOREIGN_PROJECT], total: 2 })
    renderSection()

    expect(await screen.findByText('Automação de fluxo fiscal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Excluir projeto Automação de fluxo fiscal/i })).toBeInTheDocument()
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

  it('valida título e descrição obrigatórios no formulário', async () => {
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /Criar Projeto/i }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar Projeto/i }))

    expect(await screen.findByText(/Preencha título e descrição/i)).toBeInTheDocument()
    expect(mockCreateProject).not.toHaveBeenCalled()
  })
})