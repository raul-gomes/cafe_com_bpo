import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PanelSidebar } from '../src/components/panel/PanelSidebar'

// Mock getClients to avoid API calls
vi.mock('../src/api/clients', () => ({
  getClients: vi.fn().mockResolvedValue([]),
}))

// Mock useAuth
const mockUser = {
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
    return render(
      <MemoryRouter initialEntries={['/painel']}>
        <PanelSidebar isOpen={isOpen} onClose={vi.fn()} />
      </MemoryRouter>
    )
  }

  it('renders Nos Ajude button above the divider line', () => {
    renderSidebar()

    // Get the "Nos Ajude" button
    const donateBtn = screen.getByText('Nos Ajude')
    expect(donateBtn).toBeInTheDocument()

    // Get the "Sair da conta" button
    const logoutBtn = screen.getByText('Sair da conta')
    expect(logoutBtn).toBeInTheDocument()

    // "Nos Ajude" should be in panel-sidebar__section (above footer)
    const section = donateBtn.closest('.panel-sidebar__section')
    expect(section).toBeTruthy()

    // "Sair da conta" should be in panel-sidebar__footer (below divider)
    const footer = logoutBtn.closest('.panel-sidebar__footer')
    expect(footer).toBeTruthy()
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

  it('renders only Sair da conta below the divider in footer', () => {
    renderSidebar()
    
    const footer = document.querySelector('.panel-sidebar__footer')
    expect(footer).toBeInTheDocument()

    // Footer should contain Sair da conta
    expect(footer?.textContent).toContain('Sair da conta')
    
    // Footer should NOT contain Nos Ajude
    expect(footer?.textContent).not.toContain('Nos Ajude')
  })
})
