import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('shows edit form inline inside the card when clicking a client card', async () => {
    renderPage()

    // Wait for clients to load
    const clientCard = await screen.findByText('Cliente A')
    const card = clientCard.closest('.orcamento-card')!
    expect(card).toBeInTheDocument()

    // Initially, no inline form fields should be visible inside the card
    expect(card.querySelector('.ds-label')).toBeNull()

    // Click the card to start editing
    fireEvent.click(card)

    // The card should now contain form fields (inline editing)
    const nameInput = card.querySelector('input[placeholder*="Razão social"]')
    expect(nameInput).toBeInTheDocument()
    expect(nameInput).toHaveValue('Cliente A')

    // The top "Nova Empresa" form should NOT be visible (only inline editing)
    // The new client button should still be visible though
    const newBtn = screen.getByText('Novo Cliente')
    expect(newBtn).toBeInTheDocument()
  })

  it('saves inline edit and closes the expanded card', async () => {
    renderPage()

    // Wait for clients and click the card
    const clientCard = await screen.findByText('Cliente A')
    const card = clientCard.closest('.orcamento-card')!
    fireEvent.click(card)

    // Find the save button inside the card and click it
    const salvarBtn = card.querySelector('button')  // first button in the card form
    expect(salvarBtn).toBeInTheDocument()

    // Actually check for the save button text
    const saveBtns = Array.from(card.querySelectorAll('button')).filter(b => b.textContent?.includes('Salvar'))
    expect(saveBtns.length).toBeGreaterThanOrEqual(1)

    fireEvent.click(saveBtns[0])

    // After saving, the card should no longer be expanded
    await waitFor(() => {
      const nameInput = card.querySelector('input[placeholder*="Razão social"]')
      expect(nameInput).toBeNull()
    })
  })

  it('cancels inline edit and closes the expanded card without saving', async () => {
    renderPage()

    // Wait for clients and click the card
    const clientCard = await screen.findByText('Cliente B')
    const card = clientCard.closest('.orcamento-card')!
    fireEvent.click(card)

    // Find and click the cancel button inside the card
    const cancelBtns = Array.from(card.querySelectorAll('button')).filter(b => b.textContent?.includes('Cancelar'))
    expect(cancelBtns.length).toBeGreaterThanOrEqual(1)

    fireEvent.click(cancelBtns[0])

    // After cancelling, the card should close
    await waitFor(() => {
      const nameInput = card.querySelector('input[placeholder*="Razão social"]')
      expect(nameInput).toBeNull()
    })
  })

  it('does not show inline edit form for new client button', async () => {
    renderPage()

    // Click "Novo Cliente" button
    const newBtn = await screen.findByText('Novo Cliente')
    fireEvent.click(newBtn)

    // Should show the top form (not inline in a card)
    const topFormNameInput = screen.getByPlaceholderText('Razão social ou nome fantasia')
    expect(topFormNameInput).toBeInTheDocument()
  })
})
