import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Routes, Route, MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PanelLayout } from '../src/components/panel/PanelLayout'

// Mock auth to control user + logout
const mockUser: { id: string; email: string; name: string; role?: string } = {
  id: '1',
  email: 'test@cafe.com',
  name: 'Test User',
}

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    setUser: vi.fn(),
    sessionExpired: false,
  }),
}))

// NotificationBell hits the notifications API — mock to a no-op
vi.mock('../src/components/panel/NotificationBell', () => ({
  NotificationBell: () => null,
}))

// PIX_KEY stable for the donation modal (opened via sidebar footer)
vi.mock('../src/config/env', () => ({
  PIX_KEY: 'cafe@cafecombpo.com.br',
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function renderLayout(initialEntry = '/painel') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/painel" element={<PanelLayout />}>
            <Route index element={<div data-testid="page">Dashboard</div>} />
            <Route path="tarefas" element={<div data-testid="page">Tarefas</div>} />
            <Route path="prospectos" element={<div data-testid="page">Prospectos</div>} />
            <Route path="orcamentos" element={<div data-testid="page">Orcamentos</div>} />
            <Route path="forum" element={<div data-testid="page">Forum</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PanelLayout — modo de trabalho com cor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('aplica data-mode operacional por padrão', () => {
    renderLayout()
    expect(document.querySelector('.panel-mode-grid[data-mode="operacional"]')).toBeInTheDocument()
  })

  it('muda data-mode ao selecionar outro menu na sidebar', () => {
    renderLayout()

    const wrapper = document.querySelector('.panel-mode-grid[data-mode]')
    expect(wrapper).toHaveAttribute('data-mode', 'operacional')

    fireEvent.click(screen.getByRole('button', { name: /selecionar menu/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Captar' }))

    expect(wrapper).toHaveAttribute('data-mode', 'captar')
  })

  it('navega para a primeira opção do modo selecionado e atualiza o data-mode', () => {
    renderLayout('/painel')

    fireEvent.click(screen.getByRole('button', { name: /selecionar menu/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Comunidade' }))

    expect(document.querySelector('.panel-mode-grid[data-mode]')).toHaveAttribute('data-mode', 'comunidade')
    expect(screen.getByTestId('page')).toHaveTextContent('Forum')
  })
})