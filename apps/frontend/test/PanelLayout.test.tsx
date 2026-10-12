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

// GET /access drives the read-only locks (plan write gate). null = access not
// resolved yet, which exercises the path without locks.
const { mockAccessValue } = vi.hoisted(() => ({ mockAccessValue: { value: null as unknown } }))

vi.mock('../src/api/hooks/useAccess', () => ({
  useAccess: () => ({ data: mockAccessValue.value }),
}))

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

// NotificationBell calls the notifications API — becomes a no-op
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

describe('PanelLayout — work module and menu', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.body.dataset.cafeModule
  })

  it('the module color comes from the route and goes on body (reaches portal menus)', () => {
    renderLayout('/painel/prospectos')
    expect(document.body.dataset.cafeModule).toBe('captacao')
    expect(screen.getAllByRole('tab', { name: /^Captar/ })[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('the main panel has no module color (café yellow applies)', () => {
    renderLayout('/painel')
    expect(document.body.dataset.cafeModule).toBeUndefined()
  })

  it('switching tabs changes the module, the route and the color', () => {
    renderLayout('/painel/tarefas')
    expect(document.body.dataset.cafeModule).toBe('tarefas')

    fireEvent.click(screen.getAllByRole('tab', { name: 'Comunidade' })[0])

    expect(screen.getByTestId('page')).toHaveTextContent('Forum')
    expect(document.body.dataset.cafeModule).toBe('comunidade')
  })

  it('the arrow cycles full → icons only → hidden → full', () => {
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

  it('remembers the menu state between visits', () => {
    localStorage.setItem('cafe_bpo_sidebar_nav', 'collapsed')
    renderLayout('/painel/tarefas')
    expect(shell()).toHaveAttribute('data-nav', 'collapsed')
  })
})
