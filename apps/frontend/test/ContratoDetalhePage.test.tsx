import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { ContratoDetalhePage } from '../src/pages/panel/ContratoDetalhePage'

const mockGetContract = vi.hoisted(() => vi.fn())
const mockUpdateContract = vi.hoisted(() => vi.fn())
const mockFinalizeContract = vi.hoisted(() => vi.fn())
const mockDeleteContract = vi.hoisted(() => vi.fn())

vi.mock('../src/api/contracts', () => ({
  getContract: mockGetContract,
  updateContract: mockUpdateContract,
  finalizeContract: mockFinalizeContract,
  deleteContract: mockDeleteContract,
}))

const DRAFT = {
  id: 'c1',
  prospect_id: 'p1',
  proposal_id: 'o1',
  client_name: 'Alpha Consultoria',
  sections: [
    { title: 'Das Partes', content: 'Contratante: Alpha Consultoria.' },
    { title: 'Do Objeto', content: 'Serviços de BPO financeiro.' },
  ],
  status: 'draft',
  finalized_at: null,
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
}

const FINALIZED = {
  ...DRAFT,
  status: 'finalized',
  finalized_at: '2026-02-01T00:00:00Z',
}

describe('ContratoDetalhePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetContract.mockResolvedValue(DRAFT)
    mockUpdateContract.mockImplementation(async (_id, sections) => ({
      ...DRAFT,
      sections,
    }))
    mockFinalizeContract.mockResolvedValue({ contract_id: 'c1', client_id: 'cl1' })
    mockDeleteContract.mockResolvedValue({})
  })

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/painel/contrato/c1']}>
        <ConfirmProvider>
          <Routes>
            <Route path="/painel/contrato/:id" element={<ContratoDetalhePage />} />
            <Route path="/painel/contratos" element={<div data-testid="contracts-route">contratos</div>} />
            <Route path="/painel/contrato/:id/visualizar" element={<div data-testid="view-route">visualizar</div>} />
          </Routes>
        </ConfirmProvider>
      </MemoryRouter>
    )
  }

  it('exibe o contrato em rascunho com ações de edição', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /alpha consultoria/i })).toBeInTheDocument()
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finalizar contrato/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /visualizar/i })).toBeInTheDocument()
  })

  it('navega para a visualização do contrato ao clicar em Visualizar', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /visualizar/i }))
    expect(await screen.findByTestId('view-route')).toBeInTheDocument()
  })

  it('edita uma seção e salva as alterações', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click((await screen.findAllByRole('button', { name: /editar seção/i }))[0])
    const titleInput = screen.getByTestId('contract-section-title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Das Partes Contratante')
    await user.click(screen.getByRole('button', { name: /salvar seção/i }))

    const saveBtn = screen.getByTestId('save-contract-button')
    await user.click(saveBtn)

    expect(mockUpdateContract).toHaveBeenCalledWith('c1', [
      { title: 'Das Partes Contratante', content: 'Contratante: Alpha Consultoria.' },
      DRAFT.sections[1],
    ])
  })

  it('finaliza o contrato após confirmação e converte o prospecto', async () => {
    mockGetContract.mockResolvedValueOnce(DRAFT).mockResolvedValue(FINALIZED)
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /finalizar contrato/i }))
    await user.click(screen.getByRole('button', { name: 'Finalizar' }))

    expect(mockFinalizeContract).toHaveBeenCalledWith('c1')
    expect(await screen.findByText(/não pode mais ser editado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /finalizar contrato/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /adicionar seção/i })).not.toBeInTheDocument()
  })

  it('exclui o contrato após confirmação e volta para a listagem', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /excluir contrato/i }))
    await user.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(mockDeleteContract).toHaveBeenCalledWith('c1')
    expect(await screen.findByTestId('contracts-route')).toBeInTheDocument()
  })

  it('mostra contrato finalizado como imutável e sem ações', async () => {
    mockGetContract.mockResolvedValue(FINALIZED)
    renderPage()

    expect(await screen.findByText(/não pode mais ser editado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /salvar alterações/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /excluir contrato/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /adicionar seção/i })).not.toBeInTheDocument()
  })

  it('mostra erro quando o contrato não é carregado', async () => {
    mockGetContract.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText(/não foi possível carregar o contrato/i)).toBeInTheDocument()
  })
})