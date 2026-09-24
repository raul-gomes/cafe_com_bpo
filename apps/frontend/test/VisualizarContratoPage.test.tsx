import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { VisualizarContratoPage } from '../src/pages/panel/VisualizarContratoPage'

const mockGetContract = vi.hoisted(() => vi.fn())
const mockPreviewContract = vi.hoisted(() => vi.fn())

vi.mock('../src/api/contracts', () => ({
  getContract: mockGetContract,
  previewContract: mockPreviewContract,
}))

const CONTRACT = {
  id: 'c1',
  prospect_id: 'p1',
  proposal_id: null,
  client_name: 'Alpha Consultoria',
  sections: [
    { title: 'CLÁUSULA PRIMEIRA - DO OBJETO', content: 'A CONTRATADA prestará serviços de BPO financeiro pelo valor de {{valor_mensal}}.' },
    { title: 'CLÁUSULA OITAVA - DA VIGÊNCIA', content: 'x'.repeat(300) },
  ],
  status: 'draft',
  finalized_at: null,
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
}

const PREVIEW = {
  sections: [
    { title: 'CLÁUSULA PRIMEIRA - DO OBJETO', content: 'A CONTRATADA prestará serviços de BPO financeiro pelo valor mensal de R$ 2.500,00.' },
    { title: 'CLÁUSULA OITAVA - DA VIGÊNCIA', content: 'x'.repeat(300) },
  ],
}

const PREVIEW_WITH_PENDING = {
  sections: [
    { title: 'CLÁUSULA PRIMEIRA - DO OBJETO', content: 'Serviços de BPO financeiro pelo valor mensal de R$ 2.500,00, com CPF pendente {{cpf_contratada}}.' },
    { title: 'CLÁUSULA OITAVA - DA VIGÊNCIA', content: 'x'.repeat(300) },
  ],
}

describe('VisualizarContratoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetContract.mockResolvedValue(CONTRACT)
    mockPreviewContract.mockResolvedValue(PREVIEW)
  })

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/painel/contrato/c1/visualizar']}>
        <Routes>
          <Route path="/painel/contrato/:id/visualizar" element={<VisualizarContratoPage />} />
          <Route path="/painel/contratos" element={<div data-testid="contracts-route">contratos</div>} />
          <Route path="/painel/contrato/:id" element={<div data-testid="detail-route">detalhe</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('exibe o contrato com as variáveis mapeadas preenchidas com valores reais', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /visualizar contrato/i })).toBeInTheDocument()
    expect(screen.getAllByText('Alpha Consultoria').length).toBeGreaterThan(0)
    expect(screen.getByText('CLÁUSULA PRIMEIRA - DO OBJETO')).toBeInTheDocument()
    expect(screen.getByText(/pelo valor mensal de R\$ 2\.500,00/i)).toBeInTheDocument()
    expect(screen.queryByText('{{valor_mensal}}')).not.toBeInTheDocument()
    expect(screen.queryByText(/aguardam preenchimento manual/i)).not.toBeInTheDocument()
  })

  it('renderiza a tabela do plano e a tabela numerada de serviços com total', async () => {
    mockPreviewContract.mockResolvedValue({
      sections: [
        {
          title: 'CLÁUSULA SÉTIMA - DOS VALORES E DOS REAJUSTES',
          content:
            '7.4. ...\n\n' +
            '| Item | Descrição | Limite do Plano |\n' +
            '|------|-----------|-----------------|\n' +
            '| Plano | Plano contratado | Básico |\n' +
            '| Contas Bancárias | Contas para conciliação | Até 2 contas |\n\n' +
            'Serviços contratados:\n\n' +
            '| Nº | Serviço contratado | Valor do serviço | Quantidade | Total do serviço |\n' +
            '|----|--------------------|------------------:|-----------:|------------------:|\n' +
            '| 1 | Implantação e Treinamento | R$ 100,00 | 10 | R$ 1.000,00 |\n' +
            '| 2 | Controle de contas pagar e a receber | R$ 50,00 | 5 | R$ 250,00 |\n' +
            '| **Total dos serviços** | | | | **R$ 1.250,00** |',
        },
      ],
    })
    renderPage()

    const tables = await screen.findAllByTestId('contract-table')
    expect(tables).toHaveLength(2)

    const plan = tables[0]
    expect(within(plan).getByText('Item')).toBeInTheDocument()
    expect(within(plan).getByText('Descrição')).toBeInTheDocument()
    expect(within(plan).getByText('Limite do Plano')).toBeInTheDocument()
    expect(within(plan).getByText('Plano contratado')).toBeInTheDocument()
    expect(within(plan).getByText('Até 2 contas')).toBeInTheDocument()

    const table = tables[1]
    expect(within(table).getByText('Nº')).toBeInTheDocument()
    expect(within(table).getByText('Serviço contratado')).toBeInTheDocument()
    expect(within(table).getByText('Valor do serviço')).toBeInTheDocument()
    expect(within(table).getByText('Quantidade')).toBeInTheDocument()
    expect(within(table).getByText('Total do serviço')).toBeInTheDocument()
    expect(within(table).getByText('1')).toBeInTheDocument()
    expect(within(table).getByText('Implantação e Treinamento')).toBeInTheDocument()
    expect(within(table).getByText('R$ 100,00')).toBeInTheDocument()
    expect(within(table).getByText('10')).toBeInTheDocument()
    expect(within(table).getByText('Controle de contas pagar e a receber')).toBeInTheDocument()
    expect(within(table).getByText('R$ 1.250,00')).toBeInTheDocument()
    expect(within(table).getByText('Total dos serviços')).toBeInTheDocument()
    expect(screen.queryByText('Serviço 8')).not.toBeInTheDocument()
  })

  it('mostra o conteúdo completo sem truncar', async () => {
    renderPage()
    await screen.findByRole('heading', { name: /visualizar contrato/i })
    expect(screen.getByText('CLÁUSULA OITAVA - DA VIGÊNCIA')).toBeInTheDocument()
    expect(document.body.textContent).toContain('x'.repeat(300))
    expect(document.body.textContent).not.toContain('...')
  })

  it('destaca tokens ainda sem valor na visualização', async () => {
    mockPreviewContract.mockResolvedValue(PREVIEW_WITH_PENDING)
    renderPage()
    await screen.findByRole('heading', { name: /visualizar contrato/i })

    expect(screen.getAllByText('{{cpf_contratada}}').length).toBeGreaterThan(0)
    expect(screen.getByText(/aguardam preenchimento manual/i)).toBeInTheDocument()
  })

  it('renderiza múltiplas tabelas e parágrafos sem warnings de key do React', async () => {
    mockPreviewContract.mockResolvedValue({
      sections: [
        {
          title: 'Anexo I',
          content:
            'Parágrafo antes.\n\n' +
            '| Item | Limite |\n' +
            '|------|--------|\n' +
            '| Lançamentos | 500 |\n\n' +
            'Parágrafo após a primeira tabela.\n\n' +
            '| Nº | Serviço |\n' +
            '|----|---------|\n' +
            '| 1 | BPO |',
        },
        {
          title: 'Assinaturas',
          content:
            '| Parte | Assinatura |\n' +
            '|-------|------------|\n' +
            '| CONTRATADA | |\n',
        },
      ],
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderPage()

    await screen.findByRole('heading', { name: /visualizar contrato/i })
    expect(screen.getAllByTestId('contract-table')).toHaveLength(3)
    const keyWarning = errorSpy.mock.calls.some((call) =>
      String(call[0]).includes('unique "key" prop'),
    )
    expect(keyWarning).toBe(false)
    errorSpy.mockRestore()
  })

  it('volta para a listagem ao clicar em Voltar', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /voltar/i }))
    expect(await screen.findByTestId('contracts-route')).toBeInTheDocument()
  })

  it('disponibiliza a impressão do documento', async () => {
    const spy = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByTestId('print-contract-button'))
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('mostra erro quando o contrato não é carregado', async () => {
    mockGetContract.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText(/não foi possível carregar o contrato/i)).toBeInTheDocument()
  })
})