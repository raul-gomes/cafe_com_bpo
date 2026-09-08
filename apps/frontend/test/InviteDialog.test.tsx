import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InviteDialog } from '../src/components/network/InviteDialog'
import { ProjectResponse } from '../src/api/network'

const mockSearchSkills = vi.hoisted(() => vi.fn())
const mockSearchProfessionals = vi.hoisted(() => vi.fn())
const mockCreateInvitation = vi.hoisted(() => vi.fn())
const mockGetProjectInvitations = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  searchSkills: mockSearchSkills,
  searchProfessionals: mockSearchProfessionals,
  createInvitation: mockCreateInvitation,
  getProjectInvitations: mockGetProjectInvitations,
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
}

function renderDialog() {
  return render(
    <InviteDialog project={PROJECT} open onOpenChange={() => undefined} />
  )
}

describe('InviteDialog — convidar profissionais por habilidades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchSkills.mockResolvedValue([])
    mockSearchProfessionals.mockResolvedValue([])
    mockGetProjectInvitations.mockResolvedValue([])
  })

  it('encontra profissionais por habilidades e envia convite personalizado', async () => {
    mockSearchProfessionals.mockResolvedValue([
      {
        id: 'u2',
        name: 'Ana Souza',
        email: 'ana@cafe.com',
        biografia: 'BPO financeiro há 5 anos.',
        skills: [{ id: 's1', name: 'Python', slug: 'python', is_active: true }],
      },
    ])
    renderDialog()

    fireEvent.change(screen.getByLabelText(/Habilidades/i), {
      target: { value: 'Python' },
    })
    fireEvent.keyDown(screen.getByLabelText(/Habilidades/i), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: /Buscar profissionais/i }))

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Convidar/i }))

    fireEvent.change(screen.getByRole('textbox', { name: /Mensagem personalizada/i }), {
      target: { value: 'Gostei muito do seu perfil para este projeto!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar convite/i }))

    await waitFor(() =>
      expect(mockCreateInvitation).toHaveBeenCalledWith('p1', {
        invited_user_id: 'u2',
        message: 'Gostei muito do seu perfil para este projeto!',
      })
    )
  })

  it('exige ao menos uma habilidade para buscar', async () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /Buscar profissionais/i }))

    expect(await screen.findByText(/Informe ao menos uma habilidade/i)).toBeInTheDocument()
    expect(mockSearchProfessionals).not.toHaveBeenCalled()
  })

  it('lista pessoas já convidadas com status', async () => {
    mockGetProjectInvitations.mockResolvedValue([
      {
        id: 'i1',
        project_id: 'p1',
        project_title: 'Automação de fluxo fiscal',
        invited_user: { id: 'u2', name: 'Ana Souza', email: 'ana@cafe.com' },
        message: 'Bora?',
        status: 'pending',
        responded_at: null,
        created_at: '2026-09-08T00:00:00Z',
        conversation_id: null,
      },
    ])
    renderDialog()

    expect(await screen.findByText('Já convidados para este projeto')).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
  })
})