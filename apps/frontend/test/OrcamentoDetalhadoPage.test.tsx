import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../src/context/AuthContext'
import { OrcamentoDetalhadoPage } from '../src/pages/panel/OrcamentoDetalhadoPage'
import { renderWithProviders } from './test-utils'

const mockProposal = vi.hoisted(() => ({
  id: 'prop-1',
  client_name: 'Empresa Exemplo',
  input_payload: {
    operation: {
      total_cost: 1000,
      people_count: 1,
      hours_per_month: 160,
    },
    desired_profit_margin: 0.5,
    services: [{ name: 'Emissão de NF automática', active: true }],
  },
  result_payload: {
    final_price: 5000,
    base_price: 1000,
    breakdown: {
      total_service_cost: 2000,
      profit_amount: 1500,
      tax_amount: 1500,
    },
  },
  created_at: '2026-08-16T00:00:00.000Z',
}))

vi.mock('../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../src/api/client')>('../src/api/client')
  return {
    ...actual,
    apiClient: {
      get: vi.fn().mockResolvedValue({ data: mockProposal }),
      post: vi.fn().mockResolvedValue({ data: {} }),
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

const mockGetClients = vi.hoisted(() => vi.fn())

vi.mock('../src/api/clients', () => ({
  getClients: mockGetClients,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// PDF generation is not tested here — avoid real @react-pdf render
vi.mock('../src/lib/useGeneratePDF', () => ({
  useGeneratePDF: () => ({
    generate: vi.fn().mockResolvedValue(true),
    isGenerating: false,
    error: null,
  }),
}))

import { apiClient as _apiClient } from '../src/api/client'

const renderPage = () => {
  return renderWithProviders(
    <AuthProvider>
      <Routes>
        <Route path="/painel/orcamento/:id" element={<OrcamentoDetalhadoPage />} />
      </Routes>
    </AuthProvider>,
    { initialEntries: ['/painel/orcamento/prop-1'] }
  )
}

describe('OrcamentoDetalhadoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGetClients.mockResolvedValue([
      {
        id: 'client-1',
        name: 'Empresa Exemplo',
        email: 'contato@exemplo.com',
        phone: '5511988887777',
      },
    ])
  })

  it('sends email to the client registered email (regressão email)', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Empresa Exemplo' })

    const emailBtn = screen.getByText('E-mail')
    fireEvent.click(emailBtn)

    await waitFor(() => {
      expect(_apiClient.post).toHaveBeenCalledWith(
        '/proposals/prop-1/send-email',
        expect.objectContaining({ email: 'contato@exemplo.com' })
      )
    })
  })

  it('shows toast when client has no registered email', async () => {
    mockGetClients.mockResolvedValue([
      { id: 'client-1', name: 'Empresa Exemplo', phone: '5511988887777' },
    ])
    renderPage()

    await screen.findByRole('heading', { name: 'Empresa Exemplo' })

    const emailBtn = screen.getByText('E-mail')
    fireEvent.click(emailBtn)

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Nenhum e-mail cadastrado')
      )
    })
    expect(_apiClient.post).not.toHaveBeenCalled()
  })

  it('opens wa.me with the client registered phone', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPage()

    await screen.findByRole('heading', { name: 'Empresa Exemplo' })

    const waBtn = screen.getByText('Enviar via WhatsApp')
    fireEvent.click(waBtn)

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/wa\.me\/5511988887777\?text=/),
        '_blank'
      )
    })
    openSpy.mockRestore()
  })

  it('shows toast when client has no registered phone', async () => {
    mockGetClients.mockResolvedValue([
      { id: 'client-1', name: 'Empresa Exemplo', email: 'contato@exemplo.com' },
    ])
    renderPage()

    await screen.findByRole('heading', { name: 'Empresa Exemplo' })

    const waBtn = screen.getByText('Enviar via WhatsApp')
    fireEvent.click(waBtn)

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Nenhum telefone cadastrado')
      )
    })
  })
})
