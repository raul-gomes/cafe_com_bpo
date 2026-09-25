import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { GovernancaPage } from '../src/pages/panel/GovernancaPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

const conquistado = {
  id: 'deal-1',
  name: 'TechFinance BPOS',
  status: 'conquistado',
  reference_date: '2026-09-15T10:00:00',
  segment: 'Gestão financeira',
  cnpj: '39123456000180',
  city: 'São Paulo',
  state: 'SP',
  email: 'contato@techfinance.example',
  phone: '1134567890',
  color: '#10b981',
  representante_nome: 'Mariana Costa',
  representante_cargo: 'CFO',
  proposal: { id: 'p-1', final_price: 8990, created_at: '2026-09-02T09:00:00' },
  contract: { id: 'c-1', number: 12, status: 'ativo', finalized_at: '2026-09-15T10:00:00', created_at: '2026-09-15T09:00:00' },
  timeline: [
    { type: 'created', label: 'Prospecção iniciada', date: '2026-08-20T09:00:00' },
    { type: 'sent', label: 'Proposta enviada', date: '2026-09-02T09:00:00' },
    { type: 'approved', label: 'Proposta aprovada / Contrato assinado', date: '2026-09-15T10:00:00' },
  ],
}

const negociacao = {
  id: 'deal-2',
  name: 'Contabilidade Souza',
  status: 'em_negociacao',
  reference_date: '2026-09-18T14:00:00',
  segment: 'Contabilidade',
  cnpj: '18222333000177',
  city: 'Belo Horizonte',
  state: 'MG',
  email: 'comercial@souza.example',
  color: '#4287f5',
  proposal: { id: 'p-2', final_price: 5400, created_at: '2026-09-18T14:00:00' },
  timeline: [
    { type: 'created', label: 'Prospecção iniciada', date: '2026-09-05T10:00:00' },
    { type: 'sent', label: 'Proposta enviada', date: '2026-09-18T14:00:00' },
    { type: 'pending', label: 'Aguardando aprovação', mock: true },
  ],
}

const perdido = {
  id: 'deal-3',
  name: 'Café Exportadora',
  status: 'perdido',
  reference_date: '2026-09-10T11:30:00',
  segment: 'Agronegócio',
  cnpj: '27444555000100',
  city: 'Uberlândia',
  state: 'MG',
  email: 'propostas@cafeexport.example',
  color: '#ef4444',
  proposal: { id: 'p-3', final_price: 12500, created_at: '2026-09-08T15:00:00' },
  timeline: [
    { type: 'created', label: 'Prospecção iniciada', date: '2026-08-27T09:00:00' },
    { type: 'sent', label: 'Proposta enviada', date: '2026-09-08T15:00:00' },
    { type: 'rejected', label: 'Proposta recusada', date: '2026-09-10T11:30:00' },
  ],
}

const dealAgosto = {
  ...negociacao,
  id: 'deal-4',
  name: 'Logística Vale',
  reference_date: '2026-08-12T09:30:00',
  segment: 'Logística',
  color: '#f59e0b',
  proposal: { id: 'p-4', final_price: 3200, created_at: '2026-08-12T09:00:00' },
  timeline: [
    { type: 'created', label: 'Prospecção iniciada', date: '2026-07-30T09:00:00' },
    { type: 'sent', label: 'Proposta enviada', date: '2026-08-12T09:00:00' },
    { type: 'pending', label: 'Aguardando aprovação', mock: true },
  ],
}

vi.mock('../src/api/governanca', () => ({
  getGovernanca: vi.fn(),
}))

vi.mock('../src/api/prospects', () => ({
  unreproveProspect: vi.fn(),
}))

vi.mock('../src/api/contracts', () => ({
  getContract: vi.fn(),
  previewContract: vi.fn(),
}))

vi.mock('../src/api/client', () => ({
  apiClient: { get: vi.fn() },
}))

import { getGovernanca } from '../src/api/governanca'
import { unreproveProspect } from '../src/api/prospects'
import { getContract, previewContract } from '../src/api/contracts'
import { apiClient } from '../src/api/client'

describe('GovernancaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getGovernanca as ReturnType<typeof vi.fn>).mockResolvedValue({
      months: ['2026-09', '2026-08'],
      deals: [conquistado, negociacao, perdido, dealAgosto],
    })
    ;(apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: 'p-1',
        client_name: 'TechFinance BPOS',
        input_payload: {
          complexity: 'alta',
          revenue: 12000,
          services: [{ name: 'Gestão financeira', active: true }],
        },
        result_payload: {
          final_price: 8990,
          breakdown: { total_service_cost: 6000, profit_amount: 1500, tax_amount: 1490 },
        },
        created_at: '2026-09-02T09:00:00',
      },
    })
    ;(getContract as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c-1',
      number: 12,
      client_name: 'TechFinance BPOS',
      sections: [{ title: 'Cláusula Primeira', content: 'Do objeto' }],
      fields: {},
      status: 'finalized',
      finalized_at: '2026-09-15T10:00:00',
      created_at: '2026-09-15T09:00:00',
      updated_at: '2026-09-15T09:00:00',
      prospect_id: null,
      proposal_id: 'p-1',
    })
    ;(previewContract as ReturnType<typeof vi.fn>).mockResolvedValue({
      sections: [{ title: 'Cláusula Primeira', content: 'Do objeto' }],
    })
  })

  const renderPage = () => {
    return render(
      <ConfirmProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/painel/governanca']}>
            <GovernancaPage />
          </MemoryRouter>
        </QueryClientProvider>
      </ConfirmProvider>
    )
  }

  it('rende o título e os cards de resumo do mês', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Governança')
    expect(await screen.findByTestId('stat-conquistado')).toHaveTextContent('1')
    expect(screen.getByTestId('stat-em_negociacao')).toHaveTextContent('1')
    expect(screen.getByTestId('stat-perdido')).toHaveTextContent('1')
    expect(screen.getByTestId('stat-faturamento')).toHaveTextContent('R$ 8.990,00')
  })

  it('filtra os negócios ao trocar de mês', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('TechFinance BPOS')
    expect(screen.queryByText('Logística Vale')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('month-picker'))
    await user.click(screen.getByTestId('month-option-8'))

    await waitFor(() => {
      expect(screen.getByText('Logística Vale')).toBeInTheDocument()
      expect(screen.queryByText('TechFinance BPOS')).not.toBeInTheDocument()
    })
  })

  it('troca entre as abas Conquistados / Em negociação / Perdidos', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByTestId('tab-conquistado'))
    expect(screen.getByText('TechFinance BPOS')).toBeInTheDocument()
    expect(screen.queryByText('Contabilidade Souza')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('tab-em_negociacao'))
    expect(screen.getByText('Contabilidade Souza')).toBeInTheDocument()

    await user.click(screen.getByTestId('tab-perdido'))
    expect(screen.getByText('Café Exportadora')).toBeInTheDocument()
    expect(screen.queryByText('TechFinance BPOS')).not.toBeInTheDocument()
  })

  it('filtra por termo de busca (cidade)', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('TechFinance BPOS')

    await user.type(screen.getByTestId('governanca-search'), 'Souza')

    await waitFor(() => {
      expect(screen.getByText('Contabilidade Souza')).toBeInTheDocument()
      expect(screen.queryByText('TechFinance BPOS')).not.toBeInTheDocument()
    })
  })

  it('expande o card de um conquistado mostrando timeline e links', async () => {
    renderPage()
    const user = userEvent.setup()

    const toggles = await screen.findAllByTestId('deal-card-toggle')
    await user.click(toggles[0])

    await waitFor(() => {
      const detail = screen.getByTestId('deal-detail')
      expect(within(detail).getByText('Timeline')).toBeInTheDocument()
      expect(within(detail).getByText('Proposta aprovada / Contrato assinado')).toBeInTheDocument()
      expect(within(detail).getByTestId('deal-view-proposal')).toBeInTheDocument()
      expect(within(detail).getByTestId('deal-view-contract')).toBeInTheDocument()
    })
  })

  it('mostra estado vazio quando a busca não encontra resultados', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('TechFinance BPOS')

    await user.type(screen.getByTestId('governanca-search'), 'inexistente')

    await waitFor(() => {
      expect(screen.getByText(/Nenhum negócio/)).toBeInTheDocument()
    })
  })

  it('navega entre meses pelos botões prev/next (calendário)', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('TechFinance BPOS')

    const prev = screen.getByTestId('month-prev')
    const next = screen.getByTestId('month-next')

    // Mês atual → próximo desabilitado; voltar sempre é possível
    expect(next).toBeDisabled()
    expect(prev).not.toBeDisabled()

    await user.click(prev)
    await waitFor(() => {
      expect(screen.getByText('Logística Vale')).toBeInTheDocument()
      expect(screen.queryByText('TechFinance BPOS')).not.toBeInTheDocument()
      expect(next).not.toBeDisabled()
    })

    await user.click(next)
    await waitFor(() => {
      expect(screen.getByText('TechFinance BPOS')).toBeInTheDocument()
      expect(screen.queryByText('Logística Vale')).not.toBeInTheDocument()
      expect(next).toBeDisabled()
    })
  })

  it('abre o seletor do mês com os 12 meses do ano e navega entre anos', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('TechFinance BPOS')

    await user.click(screen.getByTestId('month-picker'))

    const picker = screen.getByTestId('month-picker')
    expect(screen.getAllByTestId(/^month-option-/)).toHaveLength(12)
    expect(within(picker).getByText('Setembro de 2026')).toBeInTheDocument()
    expect(screen.getByTestId('picker-year')).toHaveTextContent('2026')

    await user.click(screen.getByTestId('year-prev'))
    await waitFor(() => {
      expect(screen.getByTestId('picker-year')).toHaveTextContent('2025')
    })

    await user.click(screen.getByTestId('month-option-5'))
    await waitFor(() => {
      expect(within(screen.getByTestId('month-picker')).getByText('Maio de 2025')).toBeInTheDocument()
      expect(screen.queryByText('TechFinance BPOS')).not.toBeInTheDocument()
    })
  })

  it('volta um perdido para a negociação pelo card da Governança', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByTestId('tab-perdido'))
    const toggles = screen.getAllByTestId('deal-card-toggle')
    await user.click(toggles[toggles.length - 1])

    await waitFor(() => {
      expect(screen.getByTestId('deal-unreprove')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('deal-unreprove'))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /voltar à negociação/i }))

    await waitFor(() => {
      expect(unreproveProspect).toHaveBeenCalledWith('deal-3')
    })
  })

  it('abre o orçamento em um modal sem redirecionar de página', async () => {
    renderPage()
    const user = userEvent.setup()

    const toggle = (await screen.findAllByTestId('deal-card-toggle'))[0]
    await user.click(toggle)

    await user.click(await screen.findByTestId('deal-view-proposal'))

    expect(await screen.findByTestId('deal-docs-modal')).toBeInTheDocument()
    expect(screen.getByTestId('deal-docs-title')).toHaveTextContent('Orçamento - TechFinance BPOS')
    expect(apiClient.get).toHaveBeenCalledWith('/proposals/p-1')
    await waitFor(() => {
      expect(screen.getByText('Resumo Financeiro')).toBeInTheDocument()
    })
  })

  it('abre o contrato em um modal sem redirecionar de página', async () => {
    renderPage()
    const user = userEvent.setup()

    const toggle = (await screen.findAllByTestId('deal-card-toggle'))[0]
    await user.click(toggle)

    await user.click(await screen.findByTestId('deal-view-contract'))

    expect(await screen.findByTestId('deal-docs-modal')).toBeInTheDocument()
    expect(screen.getByTestId('deal-docs-title')).toHaveTextContent('Contrato nº 0012')
    expect(getContract).toHaveBeenCalledWith('c-1')
    expect(previewContract).toHaveBeenCalledWith('c-1')
    await waitFor(() => {
      const modal = screen.getByTestId('deal-docs-modal')
      expect(within(modal).getByText('Cliente: TechFinance BPOS')).toBeInTheDocument()
      expect(within(modal).getByText('Cláusula Primeira')).toBeInTheDocument()
    })
  })
})