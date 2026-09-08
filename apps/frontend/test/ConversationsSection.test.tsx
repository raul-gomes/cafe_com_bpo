import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ConversationsSection } from '../src/components/network/ConversationsSection'

const mockGetConversations = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  getConversations: mockGetConversations,
}))

const CONVERSATION = {
  id: 'c1',
  project_id: 'p1',
  project_title: 'Automação de fluxo fiscal',
  participant: { id: 'u2', name: 'Ana Souza', email: 'ana@cafe.com' },
  last_message: 'Aceito! Prazer em colaborar.',
  last_message_at: '2026-09-08T12:00:00Z',
  created_at: '2026-09-08T11:00:00Z',
}

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/painel/forum']}>
      <Routes>
        <Route
          path="/painel/conversas/:id"
          element={<div data-testid="chat-page">chat</div>}
        />
        <Route path="*" element={<ConversationsSection />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ConversationsSection — aba Conversas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConversations.mockResolvedValue([CONVERSATION])
  })

  it('lista conversas com participante, projeto e última mensagem', async () => {
    renderSection()

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('Automação de fluxo fiscal')).toBeInTheDocument()
    expect(screen.getByText('Aceito! Prazer em colaborar.')).toBeInTheDocument()
  })

  it('abre a página da conversa ao clicar', async () => {
    mockGetConversations.mockResolvedValue([CONVERSATION])
    renderSection()

    fireEvent.click(await screen.findByText('Ana Souza'))

    await waitFor(() => expect(mockGetConversations).toHaveBeenCalled())
    expect(await screen.findByTestId('chat-page')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há conversas', async () => {
    mockGetConversations.mockResolvedValue([])
    renderSection()

    expect(await screen.findByText('Nenhuma conversa ainda')).toBeInTheDocument()
  })
})