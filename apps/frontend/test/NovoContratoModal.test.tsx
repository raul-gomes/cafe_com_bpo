import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NovoContratoModal } from '../src/components/contracts/NovoContratoModal'

const mockGetProspects = vi.hoisted(() => vi.fn())
const mockGenerateContract = vi.hoisted(() => vi.fn())
const mockGetMissingFields = vi.hoisted(() => vi.fn())
const mockApiGet = vi.hoisted(() => vi.fn())

vi.mock('../src/api/prospects', () => ({
  getProspects: mockGetProspects,
}))
vi.mock('../src/api/contracts', () => ({
  generateContract: mockGenerateContract,
  getContractMissingFields: mockGetMissingFields,
}))
vi.mock('../src/api/client', () => ({
  apiClient: { get: mockApiGet },
}))

const PROSPECTS = [
  { id: 'p1', name: 'Alpha Consultoria' },
  { id: 'p3', name: 'Sem Orçamento Ltda' },
]
const PROPOSALS = [
  { id: 'o1', client_name: 'Alpha Consultoria', prospect_id: 'p1', created_at: '2026-01-01T00:00:00Z' },
  { id: 'o2', client_name: 'Beta Ltda', prospect_id: 'p2', created_at: '2026-01-02T00:00:00Z' },
]
const DESCRIPTORS = [
  { key: 'sistema_gestao', label: 'Sistema de gestão', kind: 'text', default: '', group: 'Operação' },
  { key: 'dia_vencimento', label: 'Dia de vencimento', kind: 'number', default: '10', group: 'Financeiro' },
]
const GENERATED = {
  id: 'c1',
  number: 1,
  prospect_id: 'p1',
  proposal_id: 'o1',
  client_name: 'Alpha Consultoria',
  sections: [],
  fields: {},
  status: 'draft',
  finalized_at: null,
  created_at: '2026-01-03T00:00:00Z',
  updated_at: '2026-01-03T00:00:00Z',
}

describe('NovoContratoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProspects.mockResolvedValue(PROSPECTS)
    mockApiGet.mockResolvedValue({ data: PROPOSALS })
    mockGetMissingFields.mockResolvedValue({ fields: DESCRIPTORS, count: DESCRIPTORS.length })
    mockGenerateContract.mockResolvedValue(GENERATED)
  })

  const open = () => {
    const onGenerated = vi.fn()
    render(
      <NovoContratoModal
        open
        onClose={() => {}}
        onGenerated={onGenerated}
      />
    )
    return onGenerated
  }

  const pickProspect = async (value: string) => {
    const prospectSelect = await screen.findByTestId('contract-prospect-select')
    await fireEvent.change(prospectSelect, { target: { value } })
    return screen.getByTestId('contract-proposal-select')
  }

  const goToFields = async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByText('Dados do contrato')
    await waitFor(() => {
      expect(mockGetMissingFields).toHaveBeenCalled()
    })
  }

  it('carrega prospectos e orçamentos ao abrir', async () => {
    open()
    await screen.findByText('Alpha Consultoria')
    expect(mockGetProspects).toHaveBeenCalled()
    expect(mockApiGet).toHaveBeenCalledWith('/proposals/')
  })

  it('gera contrato via modal de campos vinculando prospecto e orçamento', async () => {
    const onGenerated = open()
    const user = userEvent.setup()

    const proposalSelect = await pickProspect('p1')
    await waitFor(() => {
      expect(proposalSelect).toBeEnabled()
    })

    const options = Array.from(proposalSelect.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toContain('Alpha Consultoria')
    expect(options).not.toContain('Beta Ltda')

    await fireEvent.change(proposalSelect, { target: { value: 'o1' } })
    await goToFields()

    await user.click(screen.getByRole('button', { name: /gerar contrato/i }))

    expect(mockGenerateContract).toHaveBeenCalledWith({
      prospect_id: 'p1',
      proposal_id: 'o1',
      fields: expect.objectContaining({ dia_vencimento: '10' }),
    })
    expect(onGenerated).toHaveBeenCalledWith(GENERATED)
  })

  it('gera contrato sem orçamento vinculado', async () => {
    const onGenerated = open()
    const user = userEvent.setup()

    const proposalSelect = await pickProspect('p1')
    await waitFor(() => {
      expect(proposalSelect).toBeEnabled()
    })
    await fireEvent.change(proposalSelect, { target: { value: '' } })
    await goToFields()

    await user.click(screen.getByRole('button', { name: /gerar contrato/i }))

    expect(mockGenerateContract).toHaveBeenCalledWith({
      prospect_id: 'p1',
      proposal_id: null,
      fields: expect.objectContaining({ dia_vencimento: '10' }),
    })
    expect(onGenerated).toHaveBeenCalledWith(GENERATED)
  })

  it('desabilita o botão de continuar antes de escolher prospecto', async () => {
    open()
    const nextBtn = await screen.findByRole('button', { name: /continuar/i })
    expect(nextBtn).toBeDisabled()
  })

  it('mostra mensagem quando o prospecto não tem orçamentos', async () => {
    open()
    await pickProspect('p3')
    const message = await screen.findByText(/ainda não possui orçamentos vinculados/i)
    expect(message).toBeInTheDocument()
  })

  it('consulta os campos faltantes ao continuar', async () => {
    open()
    await pickProspect('p1')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(mockGetMissingFields).toHaveBeenCalledWith('p1', null)
    })
    expect(await screen.findByLabelText(/sistema de gestão/i)).toBeInTheDocument()
  })
})