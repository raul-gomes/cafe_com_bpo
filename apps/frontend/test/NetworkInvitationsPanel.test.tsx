import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { NetworkInvitationsPanel } from '../src/components/network/NetworkInvitationsPanel'

const mockGetMyInvitations = vi.hoisted(() => vi.fn())
const mockAcceptInvitation = vi.hoisted(() => vi.fn())
const mockDeclineInvitation = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  getMyInvitations: mockGetMyInvitations,
  acceptInvitation: mockAcceptInvitation,
  declineInvitation: mockDeclineInvitation,
}))

const INVITE = {
  id: 'i1',
  project_id: 'p1',
  project_title: 'Automação de fluxo fiscal',
  invited_user: { id: 'ua', name: null, email: 'membro@cafe.com' },
  message: 'Achei seu perfil perfeito para este projeto!',
  status: 'pending',
  responded_at: null,
  created_at: '2026-09-08T00:00:00Z',
  conversation_id: null,
}

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/painel/forum']}>
      <Routes>
        <Route
          path="/painel/conversas/:id"
          element={<div data-testid="chat-page">chat</div>}
        />
        <Route path="*" element={<NetworkInvitationsPanel />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('NetworkInvitationsPanel — convites recebidos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMyInvitations.mockResolvedValue([INVITE])
    mockAcceptInvitation.mockResolvedValue({ ...INVITE, status: 'accepted', conversation_id: 'c1' })
    mockDeclineInvitation.mockResolvedValue({ ...INVITE, status: 'declined' })
  })

  it('não renderiza nada sem convites pendentes', async () => {
    mockGetMyInvitations.mockResolvedValue([])
    renderPanel()

    await waitFor(() => expect(mockGetMyInvitations).toHaveBeenCalled())
    expect(screen.queryByText('Convites recebidos')).not.toBeInTheDocument()
  })

  it('exibe convite pendente com projeto e mensagem do dono', async () => {
    renderPanel()

    expect(await screen.findByText('Convites recebidos')).toBeInTheDocument()
    expect(screen.getByText(/Automação de fluxo fiscal/i)).toBeInTheDocument()
    expect(screen.getByText(/Achei seu perfil perfeito/i)).toBeInTheDocument()
  })

  it('aceita o convite e navega para a conversa privada', async () => {
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: /Aceitar e conversar/i }))

    await waitFor(() =>
      expect(mockAcceptInvitation).toHaveBeenCalledWith('i1')
    )
    expect(await screen.findByTestId('chat-page')).toBeInTheDocument()
  })

  it('recusa o convite e remove do painel', async () => {
    mockGetMyInvitations
      .mockResolvedValueOnce([INVITE])
      .mockResolvedValueOnce([])
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: /Recusar/i }))

    await waitFor(() => expect(mockDeclineInvitation).toHaveBeenCalledWith('i1'))
    await waitFor(() =>
      expect(screen.queryByText('Convites recebidos')).not.toBeInTheDocument()
    )
  })
})