import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectsSection } from '../src/components/network/ProjectsSection'
import { ProjectResponse } from '../src/api/network'

const mockGetProjects = vi.hoisted(() => vi.fn())
const mockApplyToProject = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  getProjects: mockGetProjects,
  applyToProject: mockApplyToProject,
}))

const PROJECT: ProjectResponse = {
  id: 'p1',
  owner_id: 'user-2',
  owner: { id: 'user-2', name: 'Raul Gomes', email: 'raul@cafe.com' },
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
  is_group_member: false,
  is_owner: false,
  application_count: 0,
  applications_closed: false,
}

const MY_PROJECT: ProjectResponse = {
  ...PROJECT,
  id: 'p2',
  owner_id: 'user-1',
  owner: { id: 'user-1', name: 'Ana Souza', email: 'ana@cafe.com' },
  title: 'Migração contábil',
  is_owner: true,
}

function renderSection() {
  return render(
    <MemoryRouter>
      <ProjectsSection />
    </MemoryRouter>
  )
}

describe('ProjectsSection — vitrine do fórum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProjects.mockResolvedValue({ items: [PROJECT], total: 1 })
  })

  it('lista os projetos publicados pela comunidade', async () => {
    renderSection()

    expect(
      await screen.findByText('Automação de fluxo fiscal')
    ).toBeInTheDocument()
    expect(mockGetProjects).toHaveBeenCalledWith(20, 0, '')
  })

  it('mostra tanto projetos próprios quanto de terceiros em uma lista única', async () => {
    mockGetProjects.mockResolvedValue({
      items: [PROJECT, MY_PROJECT],
      total: 2,
    })
    renderSection()

    expect(await screen.findByText('Automação de fluxo fiscal')).toBeInTheDocument()
    expect(screen.getByText('Migração contábil')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Meus projetos/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Projetos da comunidade/i })).not.toBeInTheDocument()
  })

  it('não tem botão de criar projeto: a gestão vive em Gestão › Projetos', async () => {
    renderSection()

    expect(
      await screen.findByText('Automação de fluxo fiscal')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Criar Projeto/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Novo Projeto/i)).not.toBeInTheDocument()
  })

  it('não tem mais o bloco de Novidades, que foi para Gestão › Projetos', async () => {
    renderSection()

    expect(
      await screen.findByText('Automação de fluxo fiscal')
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Novidades/i)).not.toBeInTheDocument()
  })

  it('mostra estado vazio com o caminho para criar em Gestão › Projetos', async () => {
    mockGetProjects.mockResolvedValue({ items: [], total: 0 })
    renderSection()

    expect(await screen.findByText(/Nenhum projeto publicado/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Criar projeto em Gestão/i })).toHaveAttribute(
      'href',
      '/painel/projetos'
    )
  })

  it('busca por titulo com debounce de 300ms (uma request por busca, nao uma por tecla)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderSection()
      expect(mockGetProjects).toHaveBeenCalledTimes(1)

      const campo = screen.getByRole('searchbox', { name: /buscar projeto/i })
      fireEvent.change(campo, { target: { value: 'auto' } })
      fireEvent.change(campo, { target: { value: 'automa' } })
      fireEvent.change(campo, { target: { value: 'automação' } })
      await vi.advanceTimersByTimeAsync(300)

      expect(mockGetProjects).toHaveBeenCalledTimes(2)
      expect(mockGetProjects).toHaveBeenLastCalledWith(20, 0, 'automação')
    } finally {
      vi.useRealTimers()
    }
  })

  it('descarta a resposta antiga quando a busca termina depois', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let resolverAntigo: (v: unknown) => void = () => undefined
      mockGetProjects.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolverAntigo = resolve
          })
      )
      renderSection()
      const campo = screen.getByRole('searchbox', { name: /buscar projeto/i })
      fireEvent.change(campo, { target: { value: 'fis' } })
      await vi.advanceTimersByTimeAsync(300)

      mockGetProjects.mockResolvedValue({ items: [PROJECT], total: 1 })
      fireEvent.change(campo, { target: { value: 'fiscal' } })
      await vi.advanceTimersByTimeAsync(300)
      expect(await screen.findByText('Automação de fluxo fiscal')).toBeInTheDocument()

      // a resposta velha chega depois e não pode sobrescrever a busca nova
      resolverAntigo({ items: [], total: 0 })
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getByText('Automação de fluxo fiscal')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('limpar a busca volta a listar tudo', async () => {
    renderSection()
    const campo = await screen.findByRole('searchbox', { name: /buscar projeto/i })
    fireEvent.change(campo, { target: { value: 'fiscal' } })
    await waitFor(() => expect(mockGetProjects).toHaveBeenLastCalledWith(20, 0, 'fiscal'))

    fireEvent.click(screen.getByRole('button', { name: /limpar busca/i }))
    expect(campo).toHaveValue('')
    await waitFor(() => expect(mockGetProjects).toHaveBeenLastCalledWith(20, 0, ''))
  })

  it('distingue mural vazio de busca sem resultado', async () => {
    renderSection()
    const campo = await screen.findByRole('searchbox', { name: /buscar projeto/i })
    mockGetProjects.mockResolvedValue({ items: [], total: 0 })
    fireEvent.change(campo, { target: { value: 'inexistente' } })

    expect(
      await screen.findByText(/Nenhum projeto encontrado/i)
    ).toBeInTheDocument()
  })

  it('avisa quando o mural não carrega', async () => {
    mockGetProjects.mockRejectedValue(new Error('boom'))
    renderSection()

    expect(
      await screen.findByText(/Erro ao carregar o mural de projetos/i)
    ).toBeInTheDocument()
  })

  it('tira o esqueleto quando a carga termina', async () => {
    renderSection()

    await waitFor(() =>
      expect(screen.getByText('Automação de fluxo fiscal')).toBeInTheDocument()
    )
    expect(document.querySelectorAll('.animate-pulse').length).toBe(0)
  })
})
