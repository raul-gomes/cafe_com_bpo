import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { EmpresasPage } from '../src/pages/panel/EmpresasPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

// Mock API calls
vi.mock('../src/api/clients', () => ({
  getClients: vi.fn().mockResolvedValue([
    { id: '1', name: 'Cliente A', cnpj: '12.345.678/0001-99' },
    { id: '2', name: 'Cliente B', cnpj: '98.765.432/0001-10' },
  ]),
  getClientSegments: vi.fn().mockResolvedValue(['B2B - Tecnologia & Software', 'Outro']),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}))

// Mock useTasks hook
vi.mock('../src/api/hooks/useTasks', () => ({
  useTasks: () => ({
    useTemplatesList: () => ({ data: [] }),
    useAssignTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useClientAssignments: () => ({ data: [], refetch: vi.fn() }),
    useRemoveAssignment: () => ({ mutateAsync: vi.fn() }),
    useUpdateAssignment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }),
}))

vi.mock('../src/lib/brasilApi', () => ({
  lookupCnpj: vi.fn(),
  lookupCep: vi.fn(),
}))

import { lookupCnpj, lookupCep } from '../src/lib/brasilApi'

describe('EmpresasPage', () => {
  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/painel/empresas']}>
            <ConfirmProvider>
              <EmpresasPage />
            </ConfirmProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders page title as "Meus Clientes"', async () => {
    renderPage()
    const title = await screen.findByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('Meus Clientes')
  })

  it('renders breadcrumb with "Meus Clientes"', async () => {
    renderPage()
    const items = await screen.findAllByText('Meus Clientes')
    expect(items.length).toBeGreaterThanOrEqual(2)
    // Breadcrumb component renders inside a .panel-breadcrumb div
    const inBreadcrumb = Array.from(items).some(el => el.closest('.panel-breadcrumb'))
    expect(inBreadcrumb).toBe(true)
  })

  it('renders "Novo Cliente" button for creating', async () => {
    renderPage()
    const newBtn = await screen.findByText('Novo Cliente')
    expect(newBtn).toBeInTheDocument()
  })

  it('shows edit form inline inside the card when clicking a client card', async () => {
    renderPage()
    const clientText = await screen.findByText('Cliente A')
    const card = clientText.closest('[data-slot="card"]')!
    expect(card).toBeInTheDocument()
    expect(card.querySelector('input[placeholder*="Razão social"]')).toBeNull()
    fireEvent.click(card)
    const nameInput = card.querySelector('input[placeholder*="Razão social"]')
    expect(nameInput).toBeInTheDocument()
    expect(nameInput).toHaveValue('Cliente A')
    const newBtn = screen.getByText('Novo Cliente')
    expect(newBtn).toBeInTheDocument()
  })

  it('saves inline edit and closes the expanded card', async () => {
    renderPage()
    const user = userEvent.setup()
    // Click the client card to expand
    const clientText = await screen.findByText('Cliente A')
    const card = clientText.closest('[data-slot="card"]')!
    await user.click(card)
    // Verify edit form is visible
    expect(screen.getByPlaceholderText('Razão social ou nome fantasia')).toBeInTheDocument()
    // Find and click the save button inside the card
    const saveBtn = screen.getByRole('button', { name: /Salvar/i })
    expect(saveBtn).toBeInTheDocument()
    await user.click(saveBtn)
    // After saving, the card should no longer be expanded
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Razão social ou nome fantasia')).not.toBeInTheDocument()
    })
  })

  it('cancels inline edit and closes the expanded card without saving', async () => {
    renderPage()
    const user = userEvent.setup()
    // Click the client card to expand
    const clientText = await screen.findByText('Cliente B')
    const card = clientText.closest('[data-slot="card"]')!
    await user.click(card)
    // Find and click the cancel button inside the card
    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i })
    expect(cancelBtn).toBeInTheDocument()
    await user.click(cancelBtn)
    // After cancelling, the card should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Razão social ou nome fantasia')).not.toBeInTheDocument()
    })
  })

  it('does not show inline edit form for new client button', async () => {
    renderPage()
    const newBtn = await screen.findByText('Novo Cliente')
    fireEvent.click(newBtn)
    const topFormNameInput = screen.getByPlaceholderText('Razão social ou nome fantasia')
    expect(topFormNameInput).toBeInTheDocument()
  })

  it('autofills company and address data from CNPJ lookup on blur', async () => {
    const user = userEvent.setup()
    ;(lookupCnpj as ReturnType<typeof vi.fn>).mockResolvedValue({
      razao_social: 'Empresa XPTO LTDA',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01310100',
      email: 'contato@xpto.com',
      ddd_telefone_1: '11988887777',
      nome_fantasia: '',
    })
    renderPage()
    const newBtn = await screen.findByText('Novo Cliente')
    await user.click(newBtn)
    const cnpjInput = screen.getByPlaceholderText('00.000.000/0000-00')
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
    expect(screen.getByPlaceholderText('contato@empresa.com')).toHaveValue('contato@xpto.com')
    expect(screen.getByPlaceholderText('Razão social ou nome fantasia')).toHaveValue('Empresa XPTO LTDA')
    expect(lookupCnpj).toHaveBeenCalledWith('12345678000199')
  })

  it('does not autofill when CNPJ is not found', async () => {
    const user = userEvent.setup()
    ;(lookupCnpj as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    renderPage()
    const newBtn = await screen.findByText('Novo Cliente')
    await user.click(newBtn)
    const cnpjInput = screen.getByPlaceholderText('00.000.000/0000-00')
    await user.type(cnpjInput, '12345678000199')
    fireEvent.blur(cnpjInput)
    await waitFor(() => {
      expect(lookupCnpj).toHaveBeenCalledWith('12345678000199')
    })
    expect(screen.getByPlaceholderText('Razão social ou nome fantasia')).toHaveValue('')
    expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('')
  })

  it('autofills address data from CEP lookup on blur', async () => {
    const user = userEvent.setup()
    ;(lookupCep as ReturnType<typeof vi.fn>).mockResolvedValue({
      cep: '01310100',
      state: 'SP',
      city: 'São Paulo',
      neighborhood: 'Bela Vista',
      street: 'Avenida Paulista',
    })
    renderPage()
    const newBtn = await screen.findByText('Novo Cliente')
    await user.click(newBtn)
    const cepInput = screen.getByPlaceholderText('00000-000')
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

  it('does not autofill when CEP is not found', async () => {
    const user = userEvent.setup()
    ;(lookupCep as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    renderPage()
    const newBtn = await screen.findByText('Novo Cliente')
    await user.click(newBtn)
    const cepInput = screen.getByPlaceholderText('00000-000')
    await user.type(cepInput, '01310100')
    fireEvent.blur(cepInput)
    await waitFor(() => {
      expect(lookupCep).toHaveBeenCalledWith('01310100')
    })
    expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('')
    expect(screen.getByPlaceholderText('Cidade')).toHaveValue('')
  })
})
