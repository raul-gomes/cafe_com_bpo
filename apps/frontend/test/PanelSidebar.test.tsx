import { screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLocation } from 'react-router-dom'
import { PanelSidebar } from '../src/components/panel/PanelSidebar'
import { NAV_SECTIONS } from '../src/components/panel/navigation'
import { renderWithProviders } from './test-utils'

vi.mock('../src/config/env', () => ({
  PIX_KEY: 'cafe@cafecombpo.com.br',
}))

const mockUser: { id: string; email: string; name: string; role?: string } = {
  id: '1',
  email: 'test@cafe.com',
  name: 'Test User',
}
const mockLogout = vi.fn()

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

describe('PanelSidebar — um módulo de trabalho por vez', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete mockUser.role
  })

  it('mostra uma aba por módulo, sem Admin para quem não é admin', () => {
    renderSidebar()
    const tabs = within(screen.getByRole('tablist', { name: 'Módulo de trabalho' })).getAllByRole('tab')
    expect(tabs.map(t => t.getAttribute('aria-label'))).toEqual([
      'Operacional',
      'Captar',
      'Comunidade',
      'Gestão',
      'Notas Fiscais',
      'Certificados Digitais',
    ])
    expect(screen.getByRole('tab', { name: 'Operacional' })).toHaveAttribute('aria-selected', 'true')
  })

  it('admin também vê a aba Admin', () => {
    mockUser.role = 'admin'
    renderSidebar()
    expect(screen.getByRole('tab', { name: 'Admin' })).toBeInTheDocument()
  })

  it('lista só as áreas do módulo ativo', () => {
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
  ])('ao escolher a aba %s, troca o módulo e abre a primeira área (%s → %s)', (label, id, path) => {
    const { onSelectSection } = renderSidebar()
    fireEvent.click(screen.getByRole('tab', { name: label }))
    expect(onSelectSection).toHaveBeenCalledWith(expect.objectContaining({ id }))
    expect(screen.getByTestId('route-probe')).toHaveTextContent(path)
  })

  it('navega ao clicar numa área do módulo', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('link', { name: 'Gestor de Tarefas' }))
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/painel/tarefas')
  })

  it('ações de conta ficam no fim da lista do módulo (rolam junto)', () => {
    renderSidebar()
    const nav = screen.getByRole('navigation', { name: 'Áreas de Operacional' })
    expect(within(nav).getByRole('button', { name: 'Reportar erro' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Colabore' })).toBeInTheDocument()
    fireEvent.click(within(nav).getByRole('button', { name: 'Sair da conta' }))
    expect(mockLogout).toHaveBeenCalled()
  })

  it('Colabore abre o convite com o PIX (sem redirecionar)', () => {
    renderSidebar()
    expect(screen.queryByText(/Sem você, isso não seria possível/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Colabore' }))
    expect(screen.getByText(/Sem você, isso não seria possível/)).toBeInTheDocument()
    expect(screen.getByText(/cafe@cafecombpo.com.br/)).toBeInTheDocument()
  })

  it('o café leva ao painel principal', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /painel principal/i })).toHaveAttribute('href', '/painel')
  })
})
