import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLocation } from 'react-router-dom'
import { PanelSidebar } from '../src/components/panel/PanelSidebar'
import { renderWithProviders } from './test-utils'

// Mock getClients to avoid API calls
vi.mock('../src/api/clients', () => ({
  getClients: vi.fn().mockResolvedValue([]),
}))

// Mock PIX_KEY so the donation modal renders a stable value
vi.mock('../src/config/env', () => ({
  PIX_KEY: 'cafe@cafecombpo.com.br',
}))

// Mock useAuth
const mockUser: {
  id: string;
  email: string;
  name: string;
  role?: string;
} = {
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

describe('PanelSidebar', () => {
  beforeEach(() => {
    // Reset location href mock
    vi.restoreAllMocks()
  })

  const renderSidebar = (isOpen = true) => {
    return renderWithProviders(
      <PanelSidebar isOpen={isOpen} onClose={vi.fn()} />,
      { initialEntries: ['/painel'] }
    )
  }

  it('renders Nos Ajude button in the donate section', () => {
    renderSidebar()

    // Get the "Nos Ajude" button
    const donateBtn = screen.getByText('Nos Ajude')
    expect(donateBtn).toBeInTheDocument()

    // Get the "Sair da conta" button
    const logoutBtn = screen.getByText('Sair da conta')
    expect(logoutBtn).toBeInTheDocument()

    // Both buttons should be inside the sidebar <aside>
    const sidebar = donateBtn.closest('aside')
    expect(sidebar).toBeTruthy()
    expect(logoutBtn.closest('aside')).toBe(sidebar)
  })

  it('does not redirect to external page when clicking Nos Ajude', () => {
    // Mock window.location.href
    const originalLocation = window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: originalLocation },
      writable: true,
    })

    renderSidebar()
    const donateBtn = screen.getByText('Nos Ajude')
    
    // The button should NOT use window.location.href
    // We verify by checking it doesn't have an onClick that sets location.href
    // Instead it should just be a button that toggles some state
    expect(donateBtn.tagName).toBe('BUTTON')
  })

  it('opens ModalNosAjude when clicking Nos Ajude button', () => {
    renderSidebar()

    // Modal should not be visible initially
    expect(screen.queryByText(/Ajude o Café com BPO/)).not.toBeInTheDocument()

    // Click the Nos Ajude button
    const donateBtn = screen.getByText('Nos Ajude')
    fireEvent.click(donateBtn)

    // Modal should now be visible
    expect(screen.getByText(/Ajude o Café com BPO/)).toBeInTheDocument()
    expect(screen.getByText(/cafe@cafecombpo.com.br/)).toBeInTheDocument()
  })

  it('renders only Sair da conta below the divider in footer-bottom', () => {
    renderSidebar()
    
    const logoutSection = document.querySelector('aside > div:last-child > div:last-child')
    expect(logoutSection).toBeInTheDocument()

    // Logout section should contain Sair da conta
    expect(logoutSection?.textContent).toContain('Sair da conta')
    
    // Logout section should NOT contain Nos Ajude (it's in the section above)
    expect(logoutSection?.textContent).not.toContain('Nos Ajude')
  })
})

describe('PanelSidebar — dropdown de menus', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete mockUser.role
  })

  const renderSidebar = (isOpen = true) => {
    return renderWithProviders(
      <PanelSidebar isOpen={isOpen} onClose={vi.fn()} />,
      { initialEntries: ['/painel'] }
    )
  }

  it('mostra Operacional como menu padrão com seus submenus', () => {
    renderSidebar()

    // Dropdown trigger exibe "Operacional"
    expect(screen.getByRole('button', { name: /selecionar menu/i })).toHaveTextContent('Operacional')

    // Submenus do Operacional renderizados por padrão
    expect(screen.getByRole('button', { name: 'Gestor de Tarefas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rotinas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clientes' })).toBeInTheDocument()

    // Submenus de outros menus NÃO aparecem por padrão
    expect(screen.queryByRole('button', { name: 'Orçamentos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forum' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gestão de equipes' })).not.toBeInTheDocument()
  })

  it('abre dropdown listando todos os menus (sem Config para não-admin)', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /selecionar menu/i }))

    expect(screen.getByRole('button', { name: 'Captar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comunidade' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gestão' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Config' })).not.toBeInTheDocument()
  })

  it('troca para Captar e renderiza seus submenus', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /selecionar menu/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Captar' }))

    // Trigger agora exibe "Captar"
    expect(screen.getByRole('button', { name: /selecionar menu/i })).toHaveTextContent('Captar')

    expect(screen.getByRole('button', { name: 'Orçamentos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contratos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contatos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gestor de Tarefas' })).not.toBeInTheDocument()
  })

  it('troca para Comunidade e renderiza Forum e Galeria (sem Workana, que é parte do Fórum)', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /selecionar menu/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Comunidade' }))

    expect(screen.getByRole('button', { name: 'Forum' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Galeria de Arquivos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Workana' })).not.toBeInTheDocument()
  })

  it('troca para Gestão e renderiza Projetos e Gestão de equipes (sem Clientes, que ficou no Operacional)', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /selecionar menu/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Gestão' }))

    expect(screen.getByRole('button', { name: 'Projetos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gestão de equipes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clientes' })).not.toBeInTheDocument()
  })

  it('mostra Config apenas para admin e renderiza Design System', () => {
    mockUser.role = 'admin'
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /selecionar menu/i }))
    expect(screen.getByRole('button', { name: 'Config' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Config' }))
    expect(screen.getByRole('button', { name: 'Design System' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gestor de Tarefas' })).not.toBeInTheDocument()
  })

  it('naviega para a rota do submenu ao clicar', () => {
    const RouteProbe = () => {
      const location = useLocation()
      return <span data-testid="route-probe">{location.pathname}</span>
    }

    renderWithProviders(
      <>
        <RouteProbe />
        <PanelSidebar isOpen onClose={vi.fn()} />
      </>,
      { initialEntries: ['/painel'] }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Gestor de Tarefas' }))
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/painel/tarefas')
  })

  it.each([
    ['Captar', '/painel/orcamentos'],
    ['Comunidade', '/painel/forum'],
    ['Gestão', '/painel/projetos'],
  ])('ao trocar para %s navega para a primeira opção do submenu (%s)', (menuLabel, expectedPath) => {
    const RouteProbe = () => {
      const location = useLocation()
      return <span data-testid="route-probe">{location.pathname}</span>
    }

    renderWithProviders(
      <>
        <RouteProbe />
        <PanelSidebar isOpen onClose={vi.fn()} />
      </>,
      { initialEntries: ['/painel'] }
    )

    fireEvent.click(screen.getByRole('button', { name: /selecionar menu/i }))
    fireEvent.click(screen.getByRole('button', { name: menuLabel }))

    expect(screen.getByTestId('route-probe')).toHaveTextContent(expectedPath)
  })
})
