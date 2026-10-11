import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrcamentoNovoPage } from '../src/pages/panel/OrcamentoNovoPage'
import { renderWithProviders } from './test-utils'

const FORM = {
  operation: {
    total_cost: 9600,
    people_count: 2,
    hours_per_month: 160,
    tax_rate: 0,
    commission_rate: 0,
  },
  services: [
    {
      name: 'Atendimento',
      type: 'time' as const,
      minutes_per_execution: 10,
      monthly_quantity: 5,
      fixed_value: 0,
      active: true,
    },
  ],
  desired_profit_margin: 0,
  term_discount: 0,
}

const mockPost = vi.hoisted(() => vi.fn())
const mockPut = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())
const mockGetProspects = vi.hoisted(() => vi.fn())

vi.mock('../src/api/client', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    patch: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  tokenStorage: {
    getToken: vi.fn().mockReturnValue('fake-token'),
    setToken: vi.fn(),
    clearToken: vi.fn(),
  },
}))

vi.mock('../src/api/prospects', () => ({
  getProspects: mockGetProspects,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// O layout é irrelevante para o contrato de salvamento: só o `onSave` importa.
// `prospects`/`prospectId` também: o seletor da tela continua offerta prospecção
// (decisão do dono, 2026-10-03), mas o campo enviado é `company_id`.
vi.mock('../src/components/pricing/PricingCalculatorLayout', () => ({
  PricingCalculatorLayout: ({ onSave, isSaving, prospects, onProspectChange }: any) => (
    <>
      <button onClick={() => onSave(FORM, 'Empresa Teste')} disabled={isSaving}>
        salvar
      </button>
      {prospects?.map((p: { id: string; name: string }) => (
        <button key={p.id} onClick={() => onProspectChange?.(p.id)}>
          {`vincular ${p.name}`}
        </button>
      ))}
    </>
  ),
}))

vi.mock('../src/components/ui/Breadcrumb', () => ({
  Breadcrumb: () => <nav data-testid="breadcrumb" />,
}))

describe('OrcamentoNovoPage — o preço salvo é o do servidor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProspects.mockResolvedValue([])
    mockGet.mockResolvedValue({ data: {} })
    mockPost.mockResolvedValue({
      data: { id: 'prop-1', result_payload: { final_price: 1234.56 } },
    })
    mockPut.mockResolvedValue({
      data: { id: 'prop-1', result_payload: { final_price: 1234.56 } },
    })
  })

  it('não envia o resultado calculado no navegador', async () => {
    renderWithProviders(<OrcamentoNovoPage />)
    fireEvent.click(screen.getByText('salvar'))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    const [url, body] = mockPost.mock.calls[0]
    expect(url).toBe('/proposals/')
    expect(body).not.toHaveProperty('result_payload')
    expect(body.client_name).toBe('Empresa Teste')
    expect(body.input_payload).toEqual(FORM)
  })

  it('exibe no aviso o total devolvido pelo servidor', async () => {
    renderWithProviders(<OrcamentoNovoPage />)
    fireEvent.click(screen.getByText('salvar'))

    await waitFor(async () => {
      const { toast } = await import('sonner')
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('1.234,56'),
      )
    })
  })

  it('avisa quando o servidor recusou a precificação', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } })
    renderWithProviders(<OrcamentoNovoPage />)
    fireEvent.click(screen.getByText('salvar'))

    await waitFor(async () => {
      const { toast } = await import('sonner')
      expect(toast.error).toHaveBeenCalled()
    })
  })
})

describe('OrcamentoNovoPage — o vínculo do orçamento é a empresa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProspects.mockResolvedValue([
      { id: 'empresa-1', name: 'Prospecto Alheio', email: 'a@b.com' },
    ])
    mockGet.mockResolvedValue({ data: {} })
    mockPost.mockResolvedValue({
      data: { id: 'prop-1', company_id: 'empresa-1', result_payload: {} },
    })
    mockPut.mockResolvedValue({
      data: { id: 'prop-1', company_id: 'empresa-1', result_payload: {} },
    })
  })

  it('envia company_id, e não prospect_id', async () => {
    renderWithProviders(<OrcamentoNovoPage />)

    fireEvent.click(await screen.findByText('vincular Prospecto Alheio'))
    fireEvent.click(screen.getByText('salvar'))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    const [, body] = mockPost.mock.calls[0]
    expect(body.company_id).toBe('empresa-1')
    expect(body).not.toHaveProperty('prospect_id')
  })

  it('não envia company_id quando o orçamento é de nome livre', async () => {
    renderWithProviders(<OrcamentoNovoPage />)
    fireEvent.click(screen.getByText('salvar'))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    const [, body] = mockPost.mock.calls[0]
    expect(body).not.toHaveProperty('company_id')
  })
})
