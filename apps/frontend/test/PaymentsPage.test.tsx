import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { PaymentsPage } from '../src/pages/panel/PaymentsPage'
import type { Access } from '../src/schemas/access'
import type { Plan } from '../src/schemas/plans'
import type { BillingProfile } from '../src/schemas/subscription'

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))

const queryHooks = vi.hoisted(() => ({
  useAccess: vi.fn(),
}))

const subscriptionApi = vi.hoisted(() => ({
  getBillingProfile: vi.fn(),
  saveBillingProfile: vi.fn(),
  openCheckout: vi.fn(),
  cancelSubscription: vi.fn(),
  listBillingHistory: vi.fn(),
}))

const plansApi = vi.hoisted(() => ({ listPlans: vi.fn() }))

const accessApi = vi.hoisted(() => ({ getAccess: vi.fn() }))

vi.mock('sonner', () => ({ toast }))
vi.mock('../src/api/hooks/useAccess', () => queryHooks)
vi.mock('../src/api/subscription', () => subscriptionApi)
vi.mock('../src/api/plans', () => plansApi)
vi.mock('../src/api/access', () => accessApi)

const FREE_ACCESS: Access = {
  access: 'free',
  read_only_modules: [],
  writable_modules: ['captar', 'comunidade', 'gestao', 'operacional', 'pagamentos'],
  expires_at: null,
  grace_until: null,
  shows_dunning_banner: false,
  shows_beta_banner: false,
  subscription_status: null,
  plan: null,
  is_admin: false,
}

const BETA_ACCESS: Access = {
  ...FREE_ACCESS,
  access: 'beta',
  expires_at: '2026-11-04T00:00:00Z',
  shows_beta_banner: true,
}

const ACTIVE_ACCESS: Access = {
  ...FREE_ACCESS,
  access: 'active',
  expires_at: '2026-12-04T00:00:00Z',
  subscription_status: 'active',
  plan: { code: 'mensal', name: 'Mensal', price: '27.90', cycle: 'MONTHLY' },
}

const PAST_DUE_ACCESS: Access = {
  ...ACTIVE_ACCESS,
  access: 'past_due',
  grace_until: '2026-10-09T00:00:00Z',
  shows_dunning_banner: true,
}

const MENSAL: Plan = {
  id: 'plan-1',
  code: 'mensal',
  name: 'Mensal',
  price: '27.90',
  cycle: 'MONTHLY',
  is_active: true,
  description: 'Acesso completo, cobrado todo mês',
  subscriber_count: 1,
}

const PROFILE: BillingProfile = {
  cpf_cnpj: '24971563792',
  phone: '4738010919',
  address: 'Av. Paulista',
  address_number: '150',
  complement: null,
  city: 'São Paulo',
  state: 'SP',
  postal_code: '01310000',
}

const CHECKOUT = {
  link: 'https://sandbox.asaas.com/000/checkoutSession/show/chk_1',
  plan_name: 'Mensal',
  price: '27.90',
  cycle: 'MONTHLY',
  status: 'incomplete',
}

let assignMock: ReturnType<typeof vi.fn>
let queryClient: QueryClient

describe('PaymentsPage', () => {
  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/painel/pagamentos']}>
          <ConfirmProvider>
            <PaymentsPage />
          </ConfirmProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    queryHooks.useAccess.mockReturnValue({ data: FREE_ACCESS })
    accessApi.getAccess.mockResolvedValue(FREE_ACCESS)
    plansApi.listPlans.mockResolvedValue([MENSAL])
    subscriptionApi.getBillingProfile.mockRejectedValue({ response: { status: 404 } })
    subscriptionApi.saveBillingProfile.mockRejectedValue(new Error('not reached'))
    subscriptionApi.openCheckout.mockResolvedValue(CHECKOUT)
    subscriptionApi.cancelSubscription.mockResolvedValue({
      current_period_end: '2026-11-04T00:00:00Z',
    })
    subscriptionApi.listBillingHistory.mockResolvedValue([])

    assignMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignMock, search: '' },
    })
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('free sem dados salvos: avisa para preencher a cobrança em vez de abrir o checkout', async () => {
    renderPage()

    const subscribe = await screen.findByRole('button', { name: /assinar mensal/i })
    fireEvent.click(subscribe)

    await waitFor(() => {
      expect(subscriptionApi.openCheckout).not.toHaveBeenCalled()
    })
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('dados de cobrança'))
    expect(assignMock).not.toHaveBeenCalled()
  })

  it('free com dados salvos: assina e redireciona para o link do checkout', async () => {
    subscriptionApi.getBillingProfile.mockResolvedValue(PROFILE)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /assinar mensal/i }))

    await waitFor(() => {
      expect(subscriptionApi.openCheckout).toHaveBeenCalledWith('plan-1')
    })
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(CHECKOUT.link)
    })
  })

  it('active: mostra o plano atual e cancela com confirmação, informando até quando o acesso fica', async () => {
    queryHooks.useAccess.mockReturnValue({ data: ACTIVE_ACCESS })
    renderPage()

    const planName = await screen.findByText('Mensal')
    expect(planName).toBeInTheDocument()
    expect(screen.getByText('R$ 27,90')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /assinar/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar assinatura' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, cancelar' }))

    await waitFor(() => {
      expect(subscriptionApi.cancelSubscription).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('04/11/2026'))
    })
  })

  it('past_due: mostra o alerta de dunning com a data-limite e oferece regularizar, não cancelar', async () => {
    queryHooks.useAccess.mockReturnValue({ data: PAST_DUE_ACCESS })
    renderPage()

    expect(await screen.findByText(/pagamento.*atraso/i)).toBeInTheDocument()
    expect(screen.getByText('09/10/2026')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /regularizar pagamento/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar assinatura' })).toBeNull()
  })

it('past_due: clicar em regularizar reabre o checkout do plano atual e redireciona', async () => {
    queryHooks.useAccess.mockReturnValue({ data: PAST_DUE_ACCESS })
    renderPage()

    // O botão não depende do catálogo, mas o regularizar precisa do `id` do
    // plano para abrir o checkout — espera o catálogo no cache antes do clique
    // para o handler enxergar o plano (mesmo estado de um usuário que clica
    // com a página carregada).
    const button = await screen.findByRole('button', {
      name: /regularizar pagamento/i,
    })
    await waitFor(() => expect(queryClient.getQueryData(['plans'])).toEqual([MENSAL]))
    fireEvent.click(button)

    await waitFor(() => {
      expect(subscriptionApi.openCheckout).toHaveBeenCalledWith('plan-1')
    })
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(CHECKOUT.link)
    })
  })

  it('beta: mostra o prazo do beta e o catálogo para assinar', async () => {
    queryHooks.useAccess.mockReturnValue({ data: BETA_ACCESS })
    renderPage()

    expect(await screen.findByText('Seu acesso beta está ativo')).toBeInTheDocument()
    expect(screen.getByText('04/11/2026')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /assinar mensal/i })).toBeInTheDocument()
  })

  it('retorno do checkout pago: confirma por toast e limpa a query string', async () => {
    // The server already reports the plan active (webhook arrived first).
    accessApi.getAccess.mockResolvedValue(ACTIVE_ACCESS)
    const replaceSpy = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => undefined)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignMock, search: '?checkout=paid' },
    })
    renderPage()

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Pagamento confirmado'))
    })
    expect(replaceSpy).toHaveBeenCalledWith({}, '', '/painel/pagamentos')
    replaceSpy.mockRestore()
  })

  it('retorno pago sem confirmacao do servidor: avisa que aguarda, nao confirma (AUD-034)', async () => {
    const replaceSpy = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => undefined)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignMock, search: '?checkout=paid' },
    })
    renderPage()

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('aguardando a confirmação'))
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(accessApi.getAccess).toHaveBeenCalled()
    replaceSpy.mockRestore()
  })

  it('salvar cobrança com CNPJ inválido: mostra a mensagem do backend no formulário, não o toast genérico', async () => {
    subscriptionApi.saveBillingProfile.mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: [
            {
              loc: ['body', 'cpf_cnpj'],
              msg: 'Value error, Informe um CPF ou CNPJ válido',
              type: 'value_error',
            },
          ],
        },
      },
    })
    renderPage()

    const cpfInput = await screen.findByLabelText(/CPF\/CNPJ/)
    fireEvent.change(cpfInput, {
      target: { value: '12345678000190' },
    })
    fireEvent.change(screen.getByLabelText(/Telefone/), {
      target: { value: '47999998888' },
    })
    fireEvent.change(screen.getByLabelText(/Endereço/), {
      target: { value: 'Av. Paulista' },
    })
    fireEvent.change(screen.getByLabelText(/Número/), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByLabelText(/Cidade/), {
      target: { value: 'São Paulo' },
    })
    fireEvent.change(screen.getByLabelText(/UF/), {
      target: { value: 'SP' },
    })
    fireEvent.change(screen.getByLabelText(/CEP/), {
      target: { value: '01310000' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }))

    // §17.8: "Erro de validação aparece no formulário" — o 422 do servidor é uma
    // lista de erros, e o frontend deve mostrar a mensagem do campo, não o toast
    // genérico "Não foi possível salvar os dados de cobrança."
    await screen.findByText('Informe um CPF ou CNPJ válido')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('bloco de histórico: renderiza as cobranças do mês com valor e link da fatura em texto', async () => {
    subscriptionApi.listBillingHistory.mockResolvedValue([
      {
        id: 'row-1',
        cycle_month: '2026-09',
        amount: '27.90',
        status: 'confirmed',
        paid_at: '2026-09-05T12:00:00Z',
        invoice_url: 'https://sandbox.asaas.com/invoice/inv_1',
      },
    ])
    renderPage()

    expect(await screen.findByText(/setembro 2026/i)).toBeInTheDocument()
    const invoice = screen.getByRole('link', { name: /fatura/i })
    expect(invoice).toHaveAttribute('href', 'https://sandbox.asaas.com/invoice/inv_1')
    const amounts = screen.getAllByText('R$ 27,90')
    expect(amounts.length).toBeGreaterThan(0)
  })
})