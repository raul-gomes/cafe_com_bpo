import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ConversationPage } from '../src/pages/panel/ConversationPage'

const mockGetConversation = vi.hoisted(() => vi.fn())
const mockSendMessage = vi.hoisted(() => vi.fn())

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Raul Gomes' } }),
}))

vi.mock('../src/api/network', () => ({
  getConversation: mockGetConversation,
  sendMessage: mockSendMessage,
}))

const mockMarkEntityRead = vi.hoisted(() => vi.fn())

vi.mock('../src/api/hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    useMarkEntityRead: () => ({ mutate: mockMarkEntityRead }),
    useNotificationsList: () => ({ data: [] }),
    useUnreadCount: () => ({ data: { count: 0 } }),
  }),
}))

const DETAIL = {
  id: 'c1',
  project_id: 'p1',
  project_title: 'Automação de fluxo fiscal',
  topic_title: 'Ana Souza',
  participants: [
    { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
    { id: 'u2', name: 'Ana Souza', email: 'ana@cafe.com' },
  ],
  messages: [
    {
      id: 'm1',
      conversation_id: 'c1',
      sender_id: 'u2',
      sender: { id: 'u2', name: 'Ana Souza', email: 'ana@cafe.com' },
      body: 'Aceito! Prazer em colaborar.',
      created_at: '2026-09-08T12:00:00Z',
    },
  ],
  created_at: '2026-09-08T11:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/painel/conversas/c1']}>
      <Routes>
        <Route path="/painel/conversas/:id" element={<ConversationPage />} />
        <Route path="/painel/membros/:userId" element={<div>perfil</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ConversationPage — tópico privado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConversation.mockResolvedValue(DETAIL)
    mockSendMessage.mockResolvedValue({
      id: 'm2',
      conversation_id: 'c1',
      sender_id: 'user-1',
      sender: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
      body: 'Perfeito, vamos começar!',
      created_at: '2026-09-08T12:05:00Z',
    })
  })

  it('exibe a pessoa, o projeto e as mensagens em formato de tópico', async () => {
    renderPage()

    expect((await screen.findAllByText('Ana Souza')).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', { name: 'Ana Souza' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Tópico privado do projeto Automação de fluxo fiscal/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/em formato de fórum/i)).toBeInTheDocument()
    expect(screen.getByText('Aceito! Prazer em colaborar.')).toBeInTheDocument()
  })

  it('envia resposta e recarrega a conversa', async () => {
    renderPage()

    const textarea = await screen.findByRole('textbox', { name: /Resposta/i })
    fireEvent.change(textarea, { target: { value: 'Perfeito, vamos começar!' } })
    fireEvent.click(screen.getByRole('button', { name: /Publicar resposta/i }))

    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith('c1', 'Perfeito, vamos começar!')
    )
    expect(mockGetConversation).toHaveBeenCalled()
  })

  it('não envia resposta vazia', async () => {
    renderPage()

    await screen.findByRole('textbox', { name: /Resposta/i })
    const sendButton = screen.getByRole('button', { name: /Publicar resposta/i })
    expect(sendButton).toBeDisabled()
  })

  it('mostra erro ao falhar o envio', async () => {
    mockSendMessage.mockRejectedValue(new Error('fail'))
    renderPage()

    const textarea = await screen.findByRole('textbox', { name: /Resposta/i })
    fireEvent.change(textarea, { target: { value: 'oi' } })
    fireEvent.click(screen.getByRole('button', { name: /Publicar resposta/i }))

    expect(await screen.findByText(/Erro ao enviar a mensagem/i)).toBeInTheDocument()
  })
})

describe('ConversationPage - link para o perfil do membro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConversation.mockResolvedValue({
      ...DETAIL,
      messages: [
        ...DETAIL.messages,
        {
          id: 'm2',
          conversation_id: 'c1',
          sender_id: 'user-1',
          sender: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
          body: 'Perfeito, vamos começar!',
          created_at: '2026-09-08T13:00:00Z',
        },
      ],
    })
  })

  it('torna o titulo da conversa (pessoa com quem se fala) clicavel', async () => {
    renderPage()

    const heading = await screen.findByRole('heading', { name: 'Ana Souza' })
    const link = within(heading).getByRole('link', { name: 'Ana Souza' })
    expect(link).toHaveAttribute('href', '/painel/membros/u2')
  })

  it('torna o autor de cada mensagem clicavel', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: 'Raul Gomes' })
    expect(link).toHaveAttribute('href', '/painel/membros/user-1')
  })

  it('marca como vistas as notificacoes da conversa ao abrir', async () => {
    renderPage()

    await waitFor(() => expect(mockGetConversation).toHaveBeenCalledWith('c1'))
    expect(mockMarkEntityRead).toHaveBeenCalledWith({
      related_entity_type: 'conversation',
      related_entity_id: 'c1',
    })
  })
})
