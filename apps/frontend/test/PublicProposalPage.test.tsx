import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../src/context/AuthContext'
import { renderWithProviders } from './test-utils'
import PublicProposalPage from '../src/pages/PublicProposalPage'

const mockPublicProposal = vi.hoisted(() => ({
  client_name: 'Empresa do Cliente',
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
  result_payload: { final_price: 5000 },
  created_at: '2026-08-16T00:00:00.000Z',
  expires_at: '2026-08-17T00:00:00.000Z',
  client_decision: null as string | null,
  client_observation: null as string | null,
  client_decided_at: null as string | null,
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
    expect(screen.getByText(/Revise os detalhes abaixo/i)).toBeInTheDocument()
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