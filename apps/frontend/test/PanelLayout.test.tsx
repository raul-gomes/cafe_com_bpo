import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Routes, Route, MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PanelLayout } from '../src/components/panel/PanelLayout'

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

// NotificationBell consulta a API de notificações — vira um no-op
vi.mock('../src/components/panel/NotificationBell', () => ({
  NotificationBell: () => null,
}))

vi.mock('../src/config/env', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/config/env')>()),
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
            <Route index element={<div data-testid="page">Painel principal</div>} />
            <Route path="tarefas" element={<div data-testid="page">Tarefas</div>} />
            <Route path="prospectos" element={<div data-testid="page">Prospectos</div>} />
            <Route path="forum" element={<div data-testid="page">Forum</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const shell = () => document.querySelector('.app-shell') as HTMLElement
const toggle = () => document.querySelector('.panel-rail-toggle') as HTMLElement

describe('PanelLayout — módulo de trabalho e menu', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.body.dataset.cafeModule
  })

  it('a cor do módulo vem da rota e vai no body (alcança menus em portal)', () => {
    renderLayout('/painel/prospectos')
    expect(document.body.dataset.cafeModule).toBe('captacao')
    expect(screen.getAllByRole('tab', { name: /^Captar/ })[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('no painel principal não há cor de módulo (vale o amarelo do café)', () => {
    renderLayout('/painel')
    expect(document.body.dataset.cafeModule).toBeUndefined()
  })

  it('trocar de aba muda o módulo, a rota e a cor', () => {
    renderLayout('/painel/tarefas')
    expect(document.body.dataset.cafeModule).toBe('tarefas')

    fireEvent.click(screen.getAllByRole('tab', { name: 'Comunidade' })[0])

    expect(screen.getByTestId('page')).toHaveTextContent('Forum')
    expect(document.body.dataset.cafeModule).toBe('comunidade')
  })

  it('a seta percorre completo → só ícones → retraído → completo', () => {
    renderLayout('/painel/tarefas')
    expect(shell()).toHaveAttribute('data-nav', 'expanded')
    fireEvent.click(toggle())
    expect(shell()).toHaveAttribute('data-nav', 'collapsed')
    fireEvent.click(toggle())
    expect(shell()).toHaveAttribute('data-nav', 'hidden')
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle())
    expect(shell()).toHaveAttribute('data-nav', 'expanded')
  })

  it('lembra o estado do menu entre visitas', () => {
    localStorage.setItem('cafe_bpo_sidebar_nav', 'collapsed')
    renderLayout('/painel/tarefas')
    expect(shell()).toHaveAttribute('data-nav', 'collapsed')
  })
})
