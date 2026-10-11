import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { UpgradeProvider } from '../src/components/ui/UpgradeModal'
import { OrcamentosPage } from '../src/pages/panel/OrcamentosPage'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockApiGet = vi.hoisted(() => vi.fn())
vi.mock('../src/api/client', () => ({ apiClient: { get: mockApiGet } }))

const mockAccess = vi.hoisted(() => ({
  value: undefined as { access: string; read_only_modules: string[] } | undefined,
}))
vi.mock('../src/api/hooks/useAccess', () => ({ useAccess: () => ({ data: mockAccess.value }) }))

describe('OrcamentosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({ data: [] })
    mockAccess.value = undefined
  })

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/painel/orcamentos']}>
        <Routes>
          <Route
            path="/painel/orcamentos"
            element={
              <UpgradeProvider>
                <ConfirmProvider>
                  <OrcamentosPage />
                </ConfirmProvider>
              </UpgradeProvider>
            }
          />
          <Route path="/painel/novo-orcamento" element={<div data-testid="novo-orcamento-route">novo</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('mostra estado vazio quando não há orçamentos', async () => {
    renderPage()

    expect(await screen.findByText('Nenhum orçamento encontrado')).toBeInTheDocument()
  })

  it('usuário free: clicar em "Nova Precificação" abre o modal de upgrade e não navega', async () => {
    mockAccess.value = { access: 'free', read_only_modules: ['captar', 'gestao'] }
    renderPage()
    await screen.findByText('Nenhum orçamento encontrado')
    fireEvent.click(screen.getAllByRole('button', { name: /nova precificação/i })[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Assine para liberar a escrita')
    expect(screen.queryByTestId('novo-orcamento-route')).toBeNull()
  })
})