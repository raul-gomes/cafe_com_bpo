import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { UpgradeProvider } from '../src/components/ui/UpgradeModal'
import { ContratosPage } from '../src/pages/panel/ContratosPage'

const mockAccess = vi.hoisted(() => ({
  value: undefined as { access: string; read_only_modules: string[] } | undefined,
}))
vi.mock('../src/api/hooks/useAccess', () => ({ useAccess: () => ({ data: mockAccess.value }) }))

const mockGetContracts = vi.hoisted(() => vi.fn())
const mockGetContractTemplate = vi.hoisted(() => vi.fn())
const mockUpdateContractTemplate = vi.hoisted(() => vi.fn())

vi.mock('../src/api/contracts', () => ({
  getContracts: mockGetContracts,
  getContractTemplate: mockGetContractTemplate,
  updateContractTemplate: mockUpdateContractTemplate,
}))

vi.mock('../src/components/contracts/NovoContratoModal', () => ({
  NovoContratoModal: ({ open, onGenerated }: { open: boolean; onGenerated: (c: unknown) => void }) =>
    open ? (
      <button
        data-testid="novo-contrato-stub"
        onClick={() =>
          onGenerated({
            id: 'c1',
            prospect_id: 'p1',
            proposal_id: null,
            client_name: 'Alpha Consultoria',
            sections: [],
            status: 'draft',
            finalized_at: null,
            created_at: '2026-01-10T00:00:00Z',
            updated_at: '2026-01-10T00:00:00Z',
          })
        }
      >
        stub
      </button>
    ) : null,
}))

const DRAFT = {
  id: 'c1',
  prospect_id: 'p1',
  proposal_id: null,
  client_name: 'Alpha Consultoria',
  sections: [
    { title: 'Das Partes', content: 'Contratante: {{nome}}.' },
    { title: 'Do Objeto', content: 'Serviços de BPO.' },
  ],
  status: 'draft',
  finalized_at: null,
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
}

const FINALIZED = {
  ...DRAFT,
  id: 'c2',
  client_name: 'Beta Ltda',
  status: 'finalized',
  finalized_at: '2026-02-01T00:00:00Z',
}

const TEMPLATE = {
  id: 't1',
  sections: DRAFT.sections,
  updated_at: '2026-01-09T00:00:00Z',
}

describe('ContratosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAccess.value = undefined
    mockGetContracts.mockResolvedValue([DRAFT, FINALIZED])
    mockGetContractTemplate.mockResolvedValue(TEMPLATE)
    mockUpdateContractTemplate.mockResolvedValue(TEMPLATE)
  })

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/painel/contratos']}>
        <Routes>
          <Route
            path="/painel/contratos"
            element={
              <UpgradeProvider>
                <ConfirmProvider>
                  <ContratosPage />
                </ConfirmProvider>
              </UpgradeProvider>
            }
          />
          <Route path="/painel/contrato/:id" element={<div data-testid="detail-route">detalhe</div>} />
          <Route path="/painel/contrato/:id/visualizar" element={<div data-testid="view-route">visualizar</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('lista contratos com status', async () => {
    renderPage()
    expect(await screen.findByText('Alpha Consultoria')).toBeInTheDocument()
    expect(await screen.findByText('Beta Ltda')).toBeInTheDocument()
    expect(screen.getAllByText('Rascunho').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Finalizado').length).toBeGreaterThan(0)
  })

  it('mostra estado vazio quando não há contratos', async () => {
    mockGetContracts.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/nenhum contrato criado ainda/i)).toBeInTheDocument()
  })

  it('navega para o detalhe ao clicar em um contrato', async () => {
    renderPage()
    const card = await screen.findByTestId('contract-card-c1')
    fireEvent.click(card)
    expect(await screen.findByTestId('detail-route')).toBeInTheDocument()
  })

  it('navega para a visualização do contrato ao clicar em Visualizar', async () => {
    renderPage()
    const viewBtn = await screen.findByTestId('view-contract-c2')
    fireEvent.click(viewBtn)
    expect(await screen.findByTestId('view-route')).toBeInTheDocument()
  })

  it('carrega o modelo padrão e permite salvar alterações', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('tab', { name: /modelo padrão/i }))

    expect(await screen.findByText('Das Partes')).toBeInTheDocument()
    const saveBtn = screen.getByTestId('save-template-button')
    expect(saveBtn).toBeDisabled()

    // adicionar seção → marca sujo → habilita salvar
    await user.click(screen.getByRole('button', { name: /adicionar seção/i }))
    await user.type(screen.getByTestId('contract-section-title'), 'Da Vigência')
    await user.type(screen.getByTestId('contract-section-content'), '12 meses.')
    await user.click(screen.getByRole('button', { name: /salvar seção/i }))

    await waitFor(() => expect(saveBtn).toBeEnabled())
    await user.click(saveBtn)

    expect(mockUpdateContractTemplate).toHaveBeenCalledWith([
      ...TEMPLATE.sections,
      { title: 'Da Vigência', content: '12 meses.' },
    ])
  })

  it('visualiza o modelo padrão com os tokens como estão', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('tab', { name: /modelo padrão/i }))
    await user.click(await screen.findByTestId('template-preview-button'))

    expect(await screen.findByText('Modelo padrão de contrato')).toBeInTheDocument()
    expect(screen.getAllByText('{{nome}}').length).toBeGreaterThan(0)
    expect(screen.getByText(/aguardam preenchimento manual/i)).toBeInTheDocument()

    await user.click(screen.getByTestId('template-preview-button'))
    expect(screen.queryByText(/aguardam preenchimento manual/i)).not.toBeInTheDocument()
  })

  it('abre o modal de novo contrato e navega após gerar', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByTestId('new-contract-button'))
    const stub = await screen.findByTestId('novo-contrato-stub')
    await user.click(stub)

    expect(await screen.findByTestId('detail-route')).toBeInTheDocument()
  })

  it('usuário free: clicar em "Novo contrato" abre o modal de upgrade e não abre o modal do contrato', async () => {
    mockAccess.value = { access: 'free', read_only_modules: ['captar', 'gestao'] }
    renderPage()
    fireEvent.click(await screen.findByTestId('new-contract-button'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Assine para liberar a escrita')
    expect(screen.queryByTestId('novo-contrato-stub')).toBeNull()
  })
})