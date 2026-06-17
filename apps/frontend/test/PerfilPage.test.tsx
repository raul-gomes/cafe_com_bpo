import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider } from '../src/context/AuthContext'
import { PerfilPage } from '../src/pages/panel/PerfilPage'
import { renderWithProviders } from './test-utils'

// Mock api/client to avoid real HTTP calls and provide controlled responses
vi.mock('../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../src/api/client')>('../src/api/client')
  return {
    ...actual,
    apiClient: {
      get: vi.fn().mockResolvedValue({ data: { id: '1', email: 'user@cafe.com', name: 'Raul Gomes' } }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: { id: '1', email: 'user@cafe.com', name: 'Raul Gomes' } }),
      defaults: { headers: { common: {} } },
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
    authStorage: {
      getToken: vi.fn().mockReturnValue('fake-token'),
      setToken: vi.fn(),
      getRefreshToken: vi.fn(),
      setRefreshToken: vi.fn(),
      clearToken: vi.fn(),
    },
  }
})

// Mock api/clients helpers used by PerfilPage
const mockUpdateProfile = vi.hoisted(() => vi.fn().mockResolvedValue({}))
vi.mock('../src/api/clients', () => ({
  uploadAvatar: vi.fn().mockResolvedValue({ avatar_url: 'https://example.com/avatar.png' }),
  updateProfile: mockUpdateProfile,
}))

// Static import of apiClient — vi.mock hoisting ensures we get the mocked version
import { apiClient as _apiClient } from '../src/api/client'
function mockUser(userData: Record<string, any>) {
  vi.mocked(_apiClient.get).mockResolvedValue({ data: userData })
}

const renderPage = () => {
  return renderWithProviders(
    <AuthProvider>
      <PerfilPage />
    </AuthProvider>,
    { initialEntries: ['/painel/perfil'] }
  )
}

const BASE_USER = {
  id: '1',
  email: 'user@cafe.com',
  name: 'Raul Gomes',
  role: 'user',
}

describe('PerfilPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders breadcrumb with "Meu Perfil"', async () => {
    mockUser(BASE_USER)
    renderPage()
    const perfilText = await screen.findByText('Meu Perfil')
    expect(perfilText).toBeInTheDocument()
  })

  it('renders Dados Pessoais tab with name, email (disabled) and whatsapp', async () => {
    mockUser({
      ...BASE_USER,
      whatsapp: '11988887777',
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Raul Gomes')).toBeInTheDocument()
      expect(screen.getByDisplayValue('user@cafe.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('(11) 98888-7777')).toBeInTheDocument()
    })

    const emailInput = screen.getByDisplayValue('user@cafe.com') as HTMLInputElement
    expect(emailInput.disabled).toBe(true)
  })

  it('switches to Empresa tab and shows all company fields', async () => {
    mockUser({
      ...BASE_USER,
      company_razao_social: 'Café com BPO Serviços Ltda',
      company_nome_fantasia: 'Café com BPO',
      company_cnpj: '12.345.678/0001-99',
    })

    renderPage()

    // Wait for page to load
    await screen.findByDisplayValue('Raul Gomes')

    // Switch to company tab
    const companyTab = screen.getByText('Empresa')
    fireEvent.click(companyTab)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Café com BPO Serviços Ltda')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Café com BPO')).toBeInTheDocument()
      expect(screen.getByDisplayValue('12.345.678/0001-99')).toBeInTheDocument()
    })
  })

  it('saves all profile fields via updateProfile', async () => {
    mockUser({
      ...BASE_USER,
      whatsapp: '11988887777',
      company_cnpj: '12.345.678/0001-99',
    })

    renderPage()

    await screen.findByDisplayValue('(11) 98888-7777')

    // Change whatsapp on personal tab
    const whatsappInput = screen.getByDisplayValue('(11) 98888-7777')
    fireEvent.change(whatsappInput, { target: { value: '11999990000' } })

    // Switch to Empresa tab and change CNPJ
    const companyTab = screen.getByText('Empresa')
    fireEvent.click(companyTab)

    await waitFor(() => {
      const cnpjInput = screen.getByDisplayValue('12.345.678/0001-99')
      fireEvent.change(cnpjInput, { target: { value: '98.765.432/0001-10' } })
    })

    // Submit
    const saveBtn = screen.getByText('Salvar Alterações')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
        whatsapp: '11999990000',
        company_cnpj: '98765432000110',
      }))
    })
  })

  it('shows success message after saving', async () => {
    mockUser(BASE_USER)

    renderPage()

    await screen.findByDisplayValue('Raul Gomes')

    const saveBtn = screen.getByText('Salvar Alterações')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Perfil atualizado com sucesso!')).toBeInTheDocument()
    })
  })

  it('shows company color code field in Personalização tab', async () => {
    mockUser({
      ...BASE_USER,
      company_color_code: '#3b82f6',
    })

    renderPage()

    await screen.findByDisplayValue('Raul Gomes')

    const customizationTab = screen.getByText('Personalização')
    fireEvent.click(customizationTab)

    await waitFor(() => {
      expect(screen.getByDisplayValue('#3b82f6')).toBeInTheDocument()
    })
  })
})
