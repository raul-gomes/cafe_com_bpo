import { screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLocation } from 'react-router-dom'
import { PanelSidebar } from '../src/components/panel/PanelSidebar'
import { NAV_SECTIONS } from '../src/components/panel/navigation'
import { renderWithProviders } from './test-utils'

vi.mock('../src/config/env', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/config/env')>()),
  PIX_KEY: 'cafe@cafecombpo.com.br',
}))

const mockUser: { id: string; email: string; name: string; role?: string } = {
  id: '1',
  email: 'test@cafe.com',
  name: 'Test User',
}
const mockLogout = vi.fn()

// GET /access drives the read-only locks (plan write gate). null = access not
// resolved yet, which exercises the path without locks.
const { mockAccessValue } = vi.hoisted(() => ({ mockAccessValue: { value: null as unknown } }))

vi.mock('../src/api/hooks/useAccess', () => ({
  useAccess: () => ({ data: mockAccessValue.value }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    setUser: vi.fn(),
    sessionExpired: false,
  }),
}))

const section = (id: string) => NAV_SECTIONS.find(s => s.id === id)!

function RouteProbe() {
  const location = useLocation()
  return <span data-testid="route-probe">{location.pathname}</span>
}

function renderSidebar(activeId = 'operacional', onSelectSection = vi.fn()) {
  renderWithProviders(
    <>
      <RouteProbe />
      <PanelSidebar activeSection={section(activeId)} inModule onSelectSection={onSelectSection} />
    </>,
    { initialEntries: ['/painel'] }
  )
  return { onSelectSection }
}

describe('PanelSidebar — one work module at a time', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete mockUser.role
  })

  it('shows one tab per module, hiding admin-only modules from non-admins', () => {
    renderSidebar()
    const tabs = within(screen.getByRole('tablist', { name: 'Módulo de trabalho' })).getAllByRole('tab')
    expect(tabs.map(t => t.getAttribute('aria-label'))).toEqual([
      'Operacional',
      'Captar',
      'Comunidade',
      'Gestão',
      'Aulas',
    ])
    expect(screen.getByRole('tab', { name: 'Operacional' })).toHaveAttribute('aria-selected', 'true')
  })

  it('admins also see the admin-only tabs', () => {
    mockUser.role = 'admin'
    renderSidebar()
    expect(screen.getByRole('tab', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Notas Fiscais' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Certificados Digitais' })).toBeInTheDocument()
  })

  it('Gestão no longer offers Gestão de equipes (deferred)', () => {
    renderSidebar('gestao')
    const nav = screen.getByRole('navigation', { name: 'Áreas de Gestão' })
    expect(within(nav).queryByRole('link', { name: 'Gestão de equipes' })).not.toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Projetos' })).toBeInTheDocument()
  })

  it('lists only the areas of the active module', () => {
    renderSidebar('captar')
    const nav = screen.getByRole('navigation', { name: 'Áreas de Captar' })
    expect(within(nav).getByRole('link', { name: 'Prospectos' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Contratos' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Gestor de Tarefas' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Fórum' })).not.toBeInTheDocument()
  })

  it.each([
    ['Captar', 'captar', '/painel/prospectos'],
    ['Comunidade', 'comunidade', '/painel/forum'],
    ['Gestão', 'gestao', '/painel/projetos'],
  ])('choosing the %s tab switches the module and opens its first area (%s → %s)', (label, id, path) => {
    const { onSelectSection } = renderSidebar()
    fireEvent.click(screen.getByRole('tab', { name: new RegExp('^' + label) }))
    expect(onSelectSection).toHaveBeenCalledWith(expect.objectContaining({ id }))
    expect(screen.getByTestId('route-probe')).toHaveTextContent(path)
  })

  it('navigates when an area of the module is clicked', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('link', { name: 'Gestor de Tarefas' }))
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/painel/tarefas')
  })

  it('account actions sit at the end of the module list (scroll along)', () => {
    renderSidebar()
    const nav = screen.getByRole('navigation', { name: 'Áreas de Operacional' })
    expect(within(nav).getByRole('button', { name: 'Reportar erro' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Colabore' })).toBeInTheDocument()
    fireEvent.click(within(nav).getByRole('button', { name: 'Sair da conta' }))
    expect(mockLogout).toHaveBeenCalled()
  })

  it('Colabore opens the PIX invitation (no redirect)', () => {
    renderSidebar()
    expect(screen.queryByText(/Sem você, isso não seria possível/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Colabore' }))
    expect(screen.getByText(/Sem você, isso não seria possível/)).toBeInTheDocument()
    expect(screen.getByText(/cafe@cafecombpo.com.br/)).toBeInTheDocument()
  })

  it('the café logo leads to the main panel', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /painel principal/i })).toHaveAttribute('href', '/painel')
  })
})


describe('PanelSidebar — read-only locks from the plan (GET /access)', () => {
  const FREE_ACCESS = {
    access: 'free',
    read_only_modules: ['captar', 'gestao'],
    writable_modules: ['comunidade', 'operacional', 'pagamentos'],
    expires_at: null,
    grace_until: null,
    shows_dunning_banner: false,
    shows_beta_banner: false,
    subscription_status: null,
    plan: null,
    is_admin: false,
  }
  const ACTIVE_ACCESS = {
    ...FREE_ACCESS,
    access: 'active',
    read_only_modules: [],
    writable_modules: ['comunidade', 'operacional', 'pagamentos', 'captar', 'gestao'],
    plan: { code: 'monthly', name: 'Mensal', price: '27.90', cycle: 'MONTHLY' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    delete mockUser.role
    mockAccessValue.value = null
  })

  it('free plan: Captar and Gestão tabs show the lock, Operacional does not', () => {
    mockAccessValue.value = FREE_ACCESS
    renderSidebar()
    expect(screen.getByRole('tab', { name: 'Captar (assinatura para criar e enviar)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Gestão (assinatura para criar e enviar)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Operacional' })).toBeInTheDocument()
  })

  it('free plan: navigation stays open on a read-only module', () => {
    mockAccessValue.value = FREE_ACCESS
    renderSidebar('captar')
    fireEvent.click(screen.getByRole('link', { name: 'Prospectos' }))
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/painel/prospectos')
  })

  it('subscriber: no locks anywhere', () => {
    mockAccessValue.value = ACTIVE_ACCESS
    renderSidebar()
    expect(screen.queryByRole('tab', { name: /assinatura/ })).not.toBeInTheDocument()
  })

  it('admin sees the Planos page in the Admin module', () => {
    mockUser.role = 'admin'
    renderSidebar('config')
    expect(screen.getByRole('link', { name: 'Planos' })).toHaveAttribute('href', '/painel/planos')
  })
})
