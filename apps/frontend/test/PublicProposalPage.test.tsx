import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../src/context/AuthContext'
import { renderWithProviders } from './test-utils'
import PublicProposalPage from '../src/pages/PublicProposalPage'

const mockPublicProposal = vi.hoisted(() => ({
  client_name: 'Empresa do Cliente',
  number: 42,
  input_payload: {
    operation: {
      total_cost: 1000,
      people_count: 1,
      hours_per_month: 160,
      tax_rate: 15,
      commission_rate: 0,
    },
    desired_profit_margin: 0.5,
    term_discount: 0,
    services: [
      { id: 1, active: true, name: 'BPO Financeiro', type: 'time', minutes_per_execution: 60, monthly_quantity: 80 },
    ],
  },
  result_payload: {
    final_price: 5000,
    breakdown: {
      total_service_cost: 100,
      service_costs: [
        { name: 'BPO Financeiro', type: 'time', cost: 100, monthly_quantity: 80 },
      ],
    },
  },
  created_at: '2026-08-16T00:00:00.000Z',
  expires_at: '2026-08-17T00:00:00.000Z',
  client_decision: null as string | null,
  client_observation: null as string | null,
  client_decided_at: null as string | null,
  provider: {
    name: 'Raul Gomes',
    email: 'contato@bpocsul.com.br',
    company_nome_fantasia: 'Consultoria BPO Sul',
    company_razao_social: 'Consultoria BPO Sul LTDA',
    company_logo_url: 'https://cdn.example.com/logo-bpo.png',
    avatar_url: 'https://cdn.example.com/avatar-bpo.png',
    company_color_code: '#2b6cb0',
    company_color_secondary: '#e2e8f0',
    company_commercial_phone: '1133334444',
    whatsapp: '5511933334444',
  },
}))

vi.mock('../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../src/api/client')>('../src/api/client')
  return {
    ...actual,
    apiClient: {
      get: vi.fn().mockResolvedValue({ data: mockPublicProposal }),
      post: vi.fn().mockImplementation((url: string, body?: { decision?: string; observation?: string | null }) => {
        if (url.includes('/decision')) {
          return Promise.resolve({
            data: {
              ...mockPublicProposal,
              client_decision: body?.decision ?? null,
              client_observation: body?.observation ?? null,
              client_decided_at: '2026-08-17T02:00:00.000Z',
            },
          })
        }
        return Promise.resolve({ data: mockPublicProposal })
      }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
      defaults: { headers: { common: {} } },
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
    tokenStorage: {
      getToken: vi.fn().mockReturnValue('fake-token'),
      setToken: vi.fn(),
      clearToken: vi.fn(),
    },
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('../src/components/proposal/ProposalDownloadGate', () => ({
  ProposalDownloadGate: () => null,
}))

import { apiClient as _apiClient } from '../src/api/client'

const renderPage = () => {
  return renderWithProviders(
    <AuthProvider>
      <Routes>
        <Route path="/orcamento/:hash" element={<PublicProposalPage />} />
      </Routes>
    </AuthProvider>,
    { initialEntries: ['/orcamento/share-abc'] }
  )
}

describe('PublicProposalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads and renders the proposal summary', async () => {
    renderPage()

    await screen.findByRole('heading', { name: /Seu orçamento está pronto/i })
    expect(screen.getByText(/Revise os detalhes e informe seu parecer/i)).toBeInTheDocument()
  })

  it('renders orçamento number and per-service monthly value', async () => {
    renderPage()

    await screen.findByRole('heading', { name: /Seu orçamento está pronto/i })

    expect(screen.getByText('Nº do Orçamento')).toBeInTheDocument()
    expect(screen.getByText('0042')).toBeInTheDocument()
    expect(screen.getByText('Valor Mensal')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 5.000,00').length).toBeGreaterThanOrEqual(1)
  })

  it('renders BPO branding: logo, brand colors and provider identity', async () => {
    renderPage()

    await screen.findByRole('heading', { name: /Seu orçamento está pronto/i })

    // Logo do BPO (não o padrão do Café com BPO)
    const logo = screen.getByAltText('Logo da empresa') as HTMLImageElement
    expect(logo.src).toContain('logo-bpo.png')

    // Cores da identidade visual aplicadas no container da proposta
    const container = document.querySelector(
      '.proposal-container-v2',
    ) as HTMLElement
    expect(container.style.getPropertyValue('--cor-1')).toBe('#2b6cb0')
    expect(container.style.getPropertyValue('--cor-2')).toBe('#e2e8f0')

    // Nome do provedor (fantasia) no cabeçalho/meta e contato no rodapé
    expect(screen.getAllByText(/Consultoria BPO Sul/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/contato@bpocsul.com.br/i).length).toBeGreaterThanOrEqual(1)
    const phones = screen.getAllByText(/\(11\) 3333-4444/)
    expect(phones.length).toBeGreaterThanOrEqual(1)
  })

  it('shows invalid link state when proposal cannot be fetched', async () => {
    (_apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('404'))
    renderPage()

    await screen.findByText(/Link inválido ou expirado/i)
  })

  it('submits an Approved decision with observation', async () => {
    renderPage()

    await screen.findByRole('heading', { name: /Seu orçamento está pronto/i })

    fireEvent.click(screen.getByRole('button', { name: 'Aprovado' }))
    fireEvent.change(screen.getByLabelText(/Observação sobre o orçamento/i), {
      target: { value: 'Pode prosseguir.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar parecer' }))

    await waitFor(() => {
      expect(_apiClient.post).toHaveBeenCalledWith(
        '/proposals/public/share-abc/decision',
        { decision: 'approved', observation: 'Pode prosseguir.' }
      )
    })
    await screen.findByText(/Parecer registrado: Aprovado/i)
  })

  it('lets the client change a previously submitted decision', async () => {
    mockPublicProposal.client_decision = 'changes'
    mockPublicProposal.client_observation = 'Ajustar escopo'
    mockPublicProposal.client_decided_at = '2026-08-17T02:00:00.000Z'

    renderPage()

    await screen.findByRole('heading', { name: /Seu orçamento está pronto/i })
    expect(screen.getByText(/Parecer registrado: Com alterações/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Alterar meu parecer/i }))
    expect(screen.getByRole('button', { name: 'Enviar parecer' })).toBeInTheDocument()

    mockPublicProposal.client_decision = null
    mockPublicProposal.client_observation = null
    mockPublicProposal.client_decided_at = null
  })

  it('observation is optional', async () => {
    renderPage()

    await screen.findByRole('heading', { name: /Seu orçamento está pronto/i })

    fireEvent.click(screen.getByRole('button', { name: 'Reprovado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar parecer' }))

    await waitFor(() => {
      expect(_apiClient.post).toHaveBeenCalledWith(
        '/proposals/public/share-abc/decision',
        { decision: 'rejected', observation: null }
      )
    })
  })
})