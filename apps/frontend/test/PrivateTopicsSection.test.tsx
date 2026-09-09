import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { PrivateTopicsSection } from '../src/components/network/PrivateTopicsSection'

const mockGetConversations = vi.hoisted(() => vi.fn())
const mockGetMyGroups = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  getConversations: mockGetConversations,
  getMyGroups: mockGetMyGroups,
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/painel/forum']}>
      <Routes>
        <Route path="/painel/forum" element={<PrivateTopicsSection />} />
        <Route path="/painel/conversas/:id" element={<LocationProbe />} />
        <Route path="/painel/grupos/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PrivateTopicsSection — tópicos privados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConversations.mockResolvedValue([
      {
        id: 'c1',
        project_id: 'p1',
        project_title: 'Automação de fluxo fiscal',
        participant: { id: 'u2', name: 'Ana Souza', email: 'ana@cafe.com' },
        last_message: 'Aceito!',
        last_message_at: '2026-09-08T12:00:00Z',
        created_at: '2026-09-08T11:00:00Z',
      },
    ])
    mockGetMyGroups.mockResolvedValue([
      {
        id: 'g9',
        project_id: 'p9',
        project_title: 'Migração de plataforma contábil',
        member_count: 3,
        last_post_at: null,
        created_at: '2026-09-08T09:00:00Z',
      },
    ])
  })

  it('lista conversas privadas e tópicos de projetos juntos', async () => {
    renderSection()

    expect(
      await screen.findByText('Automação de fluxo fiscal')
    ).toBeInTheDocument()
    expect(screen.getByText('Migração de plataforma contábil')).toBeInTheDocument()
    expect(screen.getByText('Privada')).toBeInTheDocument()
    expect(screen.getByText('Tópico do projeto')).toBeInTheDocument()
    expect(screen.getByText(/Privada com Ana Souza/i)).toBeInTheDocument()
    expect(screen.getByText(/3 participantes/i)).toBeInTheDocument()
  })

  it('conversa navega para /painel/conversas/:id', async () => {
    renderSection()
    fireEvent.click(await screen.findByText('Automação de fluxo fiscal'))
    expect(screen.getByTestId('location').textContent).toBe('/painel/conversas/c1')
  })

  it('exibe estado vazio quando não há tópicos', async () => {
    mockGetConversations.mockResolvedValue([])
    mockGetMyGroups.mockResolvedValue([])
    renderSection()

    expect(await screen.findByText('Nenhum tópico privado')).toBeInTheDocument()
  })

  it('mostra erro quando a carga falha', async () => {
    mockGetConversations.mockRejectedValue(new Error('fail'))
    renderSection()

    expect(
      await screen.findByText(/Erro ao carregar os tópicos privados/i)
    ).toBeInTheDocument()
  })
})