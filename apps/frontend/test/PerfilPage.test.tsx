import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    tokenStorage: {
      getToken: vi.fn().mockReturnValue('fake-token'),
      setToken: vi.fn(),
      clearToken: vi.fn(),
    },
  }
})

// Mock api/clients helpers used by PerfilPage
const mockUpdateProfile = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mockGetMySkills = vi.hoisted(() => vi.fn())
// Ensure sonner toast doesn't require DOM rendering
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('../src/api/network', () => ({
  getMySkills: mockGetMySkills,
  addMySkill: vi.fn(),
  removeMySkill: vi.fn(),
  searchSkills: vi.fn().mockResolvedValue([]),
}))
vi.mock('../src/api/clients', () => ({
  uploadAvatar: vi.fn().mockResolvedValue({ avatar_url: 'https://example.com/avatar.png' }),
  updateProfile: mockUpdateProfile,
}))

vi.mock('../src/lib/brasilApi', () => ({
  lookupCnpj: vi.fn(),
  lookupCep: vi.fn(),
}))

import { lookupCnpj, lookupCep } from '../src/lib/brasilApi'

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
    mockGetMySkills.mockResolvedValue([])
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

  it('renders masked CPF in Dados Pessoais and saves it unmasked', async () => {
    mockUser({ ...BASE_USER, cpf: '39053344705' })

    renderPage()

    await screen.findByDisplayValue('390.533.447-05')

    const cpfInput = screen.getByDisplayValue('390.533.447-05')
    fireEvent.change(cpfInput, { target: { value: '111.444.777-35' } })
    expect(screen.getByDisplayValue('111.444.777-35')).toBeInTheDocument()

    const saveBtn = screen.getByText('Salvar Alterações')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
        cpf: '11144477735',
      }))
    })
  })

  it('renders Cargo do Representante in Dados Pessoais and saves it', async () => {
    mockUser({ ...BASE_USER, representante_cargo: 'Sócio' })

    renderPage()

    await screen.findByDisplayValue('Sócio')

    const cargoInput = screen.getByDisplayValue('Sócio')
    fireEvent.change(cargoInput, { target: { value: 'Diretor Administrativo' } })

    const saveBtn = screen.getByText('Salvar Alterações')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
        representante_cargo: 'Diretor Administrativo',
      }))
    })
  })

  it('switches to Empresa tab and shows all company fields', async () => {
    mockUser({
      ...BASE_USER,
      company_razao_social: 'Café com BPO Serviços Ltda',
      company_nome_fantasia: 'Café com BPO',
      company_cnpj: '12.345.678/0001-99',
      company_city: 'São Paulo',
      company_state: 'SP',
      company_cep: '01310100',
      company_professional_email: 'contato@cafe.com',
    })

    renderPage()

    // Wait for page to load
    await screen.findByDisplayValue('Raul Gomes')

    // Switch to company tab (abas Empresa e Contato foram unificadas)
    const companyTab = screen.getByText('Empresa')
    fireEvent.click(companyTab)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Café com BPO Serviços Ltda')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Café com BPO')).toBeInTheDocument()
      expect(screen.getByDisplayValue('12.345.678/0001-99')).toBeInTheDocument()
      // campos vindos da antiga aba Contato agora estão na aba Empresa
      expect(screen.getByDisplayValue('contato@cafe.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('São Paulo')).toBeInTheDocument()
      expect(screen.getByDisplayValue('SP')).toBeInTheDocument()
      expect(screen.getByDisplayValue('01310-100')).toBeInTheDocument()
    })

    // A aba Contato não existe mais
    expect(screen.queryByText('Contato')).not.toBeInTheDocument()
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

  it('autofills company and address data from CNPJ lookup on blur (aba Empresa)', async () => {
    const user = userEvent.setup()
    mockUser(BASE_USER)
    ;(lookupCnpj as ReturnType<typeof vi.fn>).mockResolvedValue({
      razao_social: 'Empresa XPTO LTDA',
      nome_fantasia: '',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: 'Sala 2',
      bairro: 'Bela Vista',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01310100',
      email: 'contato@xpto.com',
      ddd_telefone_1: '11988887777',
    })

    renderPage()

    await screen.findByDisplayValue('Raul Gomes')

    fireEvent.click(screen.getByText('Empresa'))

    const cnpjInput = await screen.findByPlaceholderText('Ex: 12.345.678/0001-99')
    await user.type(cnpjInput, '12345678000199')
    fireEvent.blur(cnpjInput)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('Avenida Paulista')
    })
    expect(screen.getByPlaceholderText('Número')).toHaveValue('1000')
    expect(screen.getByPlaceholderText('Bairro')).toHaveValue('Bela Vista')
    expect(screen.getByPlaceholderText('Cidade')).toHaveValue('São Paulo')
    expect(screen.getByPlaceholderText('UF')).toHaveValue('SP')
    expect(screen.getByPlaceholderText('00000-000')).toHaveValue('01310-100')
    expect(screen.getByPlaceholderText('Ex: contato@empresa.com')).toHaveValue('contato@xpto.com')
    expect(screen.getByPlaceholderText('Ex: BPO Soluções Financeiras Ltda')).toHaveValue('Empresa XPTO LTDA')
    expect(lookupCnpj).toHaveBeenCalledWith('12.345.678/0001-99')
  })

  it('does not autofill when CNPJ is not found', async () => {
    const user = userEvent.setup()
    mockUser(BASE_USER)
    ;(lookupCnpj as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    renderPage()

    await screen.findByDisplayValue('Raul Gomes')
    fireEvent.click(screen.getByText('Empresa'))

    const cnpjInput = await screen.findByPlaceholderText('Ex: 12.345.678/0001-99')
    await user.type(cnpjInput, '12345678000199')
    fireEvent.blur(cnpjInput)

    await waitFor(() => {
      expect(lookupCnpj).toHaveBeenCalledWith('12.345.678/0001-99')
    })
    expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('')
    expect(screen.getByPlaceholderText('Ex: BPO Soluções Financeiras Ltda')).toHaveValue('')
  })

  it('autofills address data from CEP lookup on blur (aba Empresa)', async () => {
    const user = userEvent.setup()
    mockUser(BASE_USER)
    ;(lookupCep as ReturnType<typeof vi.fn>).mockResolvedValue({
      cep: '01310100',
      state: 'SP',
      city: 'São Paulo',
      neighborhood: 'Bela Vista',
      street: 'Avenida Paulista',
    })

    renderPage()

    await screen.findByDisplayValue('Raul Gomes')
    fireEvent.click(screen.getByText('Empresa'))

    const cepInput = await screen.findByPlaceholderText('00000-000')
    await user.type(cepInput, '01310100')
    fireEvent.blur(cepInput)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('Avenida Paulista')
    })
    expect(screen.getByPlaceholderText('Bairro')).toHaveValue('Bela Vista')
    expect(screen.getByPlaceholderText('Cidade')).toHaveValue('São Paulo')
    expect(screen.getByPlaceholderText('UF')).toHaveValue('SP')
    expect(lookupCep).toHaveBeenCalledWith('01310100')
  })

  it('saves structured address fields unmasked via updateProfile', async () => {
    mockUser({
      ...BASE_USER,
      company_city: 'São Paulo',
      company_state: 'SP',
    })

    renderPage()

    await screen.findByDisplayValue('Raul Gomes')
    fireEvent.click(screen.getByText('Empresa'))

    const cepInput = await screen.findByPlaceholderText('00000-000')
    fireEvent.change(cepInput, { target: { value: '01310-100' } })
    expect(screen.getByDisplayValue('01310-100')).toBeInTheDocument()

    const saveBtn = screen.getByText('Salvar Alterações')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
        company_cep: '01310100',
        company_state: 'SP',
        company_city: 'São Paulo',
      }))
    })
  })

  it('shows success message after saving', async () => {
    mockUser(BASE_USER)
    const { toast } = await import('sonner')

    renderPage()

    await screen.findByDisplayValue('Raul Gomes')

    const saveBtn = screen.getByText('Salvar Alterações')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Perfil atualizado com sucesso!')
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

  it('uses theme tokens (not hardcoded colors) on the segment select (regressão s08)', async () => {
    mockUser(BASE_USER)
    const { container } = renderPage()

    await screen.findByDisplayValue('Raul Gomes')

    const companyTab = screen.getByText('Empresa')
    fireEvent.click(companyTab)

    await waitFor(() => {
      const segmentSelect = container.querySelector<HTMLSelectElement>('select[name="company_segment"]')
      expect(segmentSelect).not.toBeNull()
      if (segmentSelect) {
        const className = segmentSelect.className

        // Deve usar tokens de tema (text-foreground + dark bg), nunca cores fixas brancas/pretas
        expect(className).toContain('text-foreground')
        expect(className).toContain('bg-transparent')
        expect(className).toContain('dark:bg-input/30')
        expect(className).toContain('[&>option]:bg-background')
        expect(className).not.toMatch(/bg-white|text-black|#fff|#ffffff/)
      }
    })
  })
})
