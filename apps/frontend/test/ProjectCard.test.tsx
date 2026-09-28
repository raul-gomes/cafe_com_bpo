import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectCard } from '../src/components/network/ProjectCard'
import { ProjectResponse } from '../src/api/network'

const mockApplyToProject = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useMarkEntityRead: () => ({ mutate: vi.fn() }),
    useNotificationsList: () => ({ data: [] }),
    useUnreadCount: () => ({ data: { count: 0 } }),
  }),
}))

vi.mock('../src/api/network', () => ({
  applyToProject: mockApplyToProject,
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
  is_group_member: false,
  is_owner: false,
  application_count: 0,
  applications_closed: false,
}

function renderCard(project: ProjectResponse = BASE) {
  return render(
    <MemoryRouter>
      <ProjectCard project={project} />
    </MemoryRouter>
  )
}

describe('ProjectCard — vitrine do fórum (sem gestão)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyToProject.mockResolvedValue({
      id: 'a1',
      project_id: 'p1',
      project_title: BASE.title,
      applicant: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
      message: 'Mensagem',
      status: 'pending',
      responded_at: null,
      created_at: '2026-09-19T00:00:00Z',
      conversation_id: null,
    })
  })

  it('mostra título, autoria, descrição e habilidades', () => {
    renderCard()

    expect(screen.getByText('Automação de fluxo fiscal')).toBeInTheDocument()
    expect(screen.getByText('Raul Gomes')).toBeInTheDocument()
    expect(
      screen.getByText(/automatizar o fluxo fiscal/i)
    ).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('não tem nenhum botão de gestão: o dono é levado para Gestão › Projetos', () => {
    renderCard({ ...BASE, is_owner: true })

    expect(
      screen.getByText(/Você criou este projeto/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Editar projeto/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Convidar/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Ver propostas/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Excluir projeto/i })
    ).not.toBeInTheDocument()
  })

  it('oferece enviar proposta para quem não é o dono', () => {
    renderCard()

    expect(
      screen.getByRole('button', { name: /Enviar proposta para Automação de fluxo fiscal/i })
    ).toBeInTheDocument()
  })

  it('não oferece proposta para o próprio dono', () => {
    renderCard({ ...BASE, is_owner: true })

    expect(
      screen.queryByRole('button', { name: /Enviar proposta/i })
    ).not.toBeInTheDocument()
  })

  it('esconde o botão e avisa quando a proposta já foi enviada', () => {
    renderCard({ ...BASE, has_applied: true, my_application_status: 'pending' })

    expect(
      screen.getByText(/Proposta enviada/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Enviar proposta/i })
    ).not.toBeInTheDocument()
  })

  it('avisa quando a proposta foi aceita', () => {
    renderCard({ ...BASE, has_applied: true, my_application_status: 'accepted' })

    expect(screen.getByText(/Proposta aceita/i)).toBeInTheDocument()
  })

  it('avisa quando a proposta foi recusada', () => {
    renderCard({ ...BASE, has_applied: true, my_application_status: 'declined' })

    expect(screen.getByText(/não foi aceita/i)).toBeInTheDocument()
  })

  it('avisa quando o projeto está fechado para novas propostas', () => {
    renderCard({ ...BASE, applications_closed: true })

    expect(
      screen.getByText(/fechado para novas propostas/i)
    ).toBeInTheDocument()
  })

  it('envia a proposta com a mensagem escrita', async () => {
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /Enviar proposta para Automação de fluxo fiscal/i })
    )
    fireEvent.change(screen.getByLabelText(/Por que você quer participar/i), {
      target: { value: 'Tenho cinco anos de automação fiscal.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Enviar proposta$/i }))

    await waitFor(() =>
      expect(mockApplyToProject).toHaveBeenCalledWith('p1', {
        message: 'Tenho cinco anos de automação fiscal.',
      })
    )
  })

  it('não envia proposta curta', async () => {
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /Enviar proposta para Automação de fluxo fiscal/i })
    )
    fireEvent.change(screen.getByLabelText(/Por que você quer participar/i), {
      target: { value: 'oi' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Enviar proposta$/i }))

    expect(
      await screen.findByText(/pelo menos 10 caracteres/i)
    ).toBeInTheDocument()
    expect(mockApplyToProject).not.toHaveBeenCalled()
  })

  it('mostra o link do tópico para quem é membro', () => {
    renderCard({ ...BASE, is_group_member: true })

    expect(
      screen.getByRole('button', { name: /Ver tópico do projeto/i })
    ).toBeInTheDocument()
  })

  it('esconde o link do tópico para quem não participa', () => {
    renderCard()

    expect(
      screen.queryByRole('button', { name: /Ver tópico do projeto/i })
    ).not.toBeInTheDocument()
  })

  it('torna o dono do projeto clicável para o perfil dele', () => {
    renderCard()

    expect(screen.getByRole('link', { name: 'Raul Gomes' })).toHaveAttribute(
      'href',
      '/painel/membros/user-1'
    )
  })
})
