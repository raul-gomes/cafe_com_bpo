import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EmpresasPage } from '../src/pages/panel/EmpresasPage'

// Mock API calls
vi.mock('../src/api/clients', () => ({
  getClients: vi.fn().mockResolvedValue([
    { id: '1', name: 'Cliente A', cnpj: '12.345.678/0001-99' },
    { id: '2', name: 'Cliente B', cnpj: '98.765.432/0001-10' },
  ]),
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
  }),
}))

describe('EmpresasPage', () => {
  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/painel/empresas']}>
        <EmpresasPage />
      </MemoryRouter>
    )
  }

  it('renders page title as "Meus Clientes"', async () => {
    renderPage()

    // Wait for the page to load and check the title
    const title = await screen.findByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('Meus Clientes')
  })

  it('renders breadcrumb with "Meus Clientes"', async () => {
    renderPage()

    // Wait for the page to render with data
    const items = await screen.findAllByText('Meus Clientes')
    expect(items.length).toBeGreaterThanOrEqual(2)

    // Verify at least one is inside panel-breadcrumb
    const inBreadcrumb = Array.from(items).some(el => el.closest('.panel-breadcrumb'))
    expect(inBreadcrumb).toBe(true)
  })

  it('renders "Novo Cliente" button for creating', async () => {
    renderPage()

    // Check the create button text
    const newBtn = await screen.findByText('Novo Cliente')
    expect(newBtn).toBeInTheDocument()
  })
})
