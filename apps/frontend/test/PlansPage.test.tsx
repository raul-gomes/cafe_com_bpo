import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { PlansPage } from '../src/pages/panel/PlansPage'
import type { Plan } from '../src/schemas/plans'

const mockListPlans = vi.hoisted(() => vi.fn())
const mockCreatePlan = vi.hoisted(() => vi.fn())
const mockUpdatePlan = vi.hoisted(() => vi.fn())

vi.mock('../src/api/plans', () => ({
  listPlans: mockListPlans,
  createPlan: mockCreatePlan,
  updatePlan: mockUpdatePlan,
}))

const MENSAL: Plan = {
  id: 'plan-1',
  code: 'monthly',
  name: 'Mensal',
  price: '27.90',
  cycle: 'MONTHLY',
  is_active: true,
  description: 'Acesso completo, cobrado todo mês',
  subscriber_count: 12,
}

const PRO: Plan = {
  id: 'plan-2',
  code: 'monthly_pro',
  name: 'Mensal Pro',
  price: '49.90',
  cycle: 'MONTHLY',
  is_active: false,
  description: null,
  subscriber_count: 0,
}

describe('PlansPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/painel/planos']}>
          <ConfirmProvider>
            <PlansPage />
          </ConfirmProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mockListPlans.mockResolvedValue([MENSAL, PRO])
    mockCreatePlan.mockResolvedValue(PRO)
    mockUpdatePlan.mockResolvedValue(MENSAL)
  })

  it('mostra o catálogo com o preço editável em reais e o ciclo em português', async () => {
    renderPage()

    // O preço é o campo que o admin edita, então ele aparece com o prefixo da
    // moeda e o valor em formato brasileiro — não como um texto ao lado.
    const price = await screen.findByTestId('plan-price-plan-1')
    expect(price).toHaveValue('27,90')
    expect(screen.getAllByText('R$')).toHaveLength(2)
    expect(screen.getByTestId('plan-cycle-plan-1')).toHaveTextContent('Mensal')
    expect(screen.getByTestId('plan-cycle-plan-2')).toHaveTextContent('Mensal')
  })

  it('mostra quantas assinaturas usam o plano antes de desativá-lo', async () => {
    renderPage()

    // O admin precisa saber o que está em jogo ao desativar um plano.
    expect(await screen.findByTestId('plan-subscribers-plan-1')).toHaveTextContent(
      '12 assinaturas',
    )
    expect(screen.getByTestId('plan-subscribers-plan-2')).toHaveTextContent(
      'Nenhuma assinatura',
    )
  })

  it('marca o plano desativado como inativo', async () => {
    renderPage()

    expect(await screen.findByText('Inativo')).toBeInTheDocument()
  })

  it('salva o preço digitado em formato brasileiro enviando decimal string', async () => {
    renderPage()
    const priceInput = await screen.findByTestId('plan-price-plan-1')
    fireEvent.change(priceInput, { target: { value: '31,90' } })
    fireEvent.click(screen.getByTestId('plan-save-plan-1'))

    await waitFor(() => {
      expect(mockUpdatePlan).toHaveBeenCalledWith('plan-1', { price: '31.90' })
    })
  })

  it('recusa preço inválido sem chamar a API', async () => {
    renderPage()
    const priceInput = await screen.findByTestId('plan-price-plan-1')
    fireEvent.change(priceInput, { target: { value: 'abc' } })
    fireEvent.click(screen.getByTestId('plan-save-plan-1'))

    expect(await screen.findByText('Informe um valor como 27,90.')).toBeInTheDocument()
    expect(mockUpdatePlan).not.toHaveBeenCalled()
  })

  it('recusa código com maiúscula na criação', async () => {
    renderPage()
    fireEvent.click(await screen.findByTestId('plan-new'))
    fireEvent.change(screen.getByTestId('plan-new-code'), { target: { value: 'Mensal' } })
    fireEvent.change(screen.getByTestId('plan-new-name'), { target: { value: 'Mensal' } })
    fireEvent.change(screen.getByTestId('plan-new-price'), { target: { value: '27,90' } })
    fireEvent.click(screen.getByTestId('plan-new-submit'))

    expect(
      await screen.findByText('Use apenas letras minúsculas, números, hífen e underscore.'),
    ).toBeInTheDocument()
    expect(mockCreatePlan).not.toHaveBeenCalled()
  })

  it('cria um plano com o código normalizado', async () => {
    renderPage()
    fireEvent.click(await screen.findByTestId('plan-new'))
    fireEvent.change(screen.getByTestId('plan-new-code'), { target: { value: 'monthly_v2' } })
    fireEvent.change(screen.getByTestId('plan-new-name'), { target: { value: 'Mensal V2' } })
    fireEvent.change(screen.getByTestId('plan-new-price'), { target: { value: '27,90' } })
    fireEvent.click(screen.getByTestId('plan-new-submit'))

    await waitFor(() => {
      expect(mockCreatePlan).toHaveBeenCalledWith({
        code: 'monthly_v2',
        name: 'Mensal V2',
        price: '27.90',
        cycle: 'MONTHLY',
      })
    })
  })

  it('desativa um plano apenas depois da confirmação', async () => {
    renderPage()
    fireEvent.click(await screen.findByTestId('plan-toggle-plan-1'))

    // A confirmação aparece antes de qualquer escrita.
    const confirmButton = await screen.findByRole('button', { name: /desativar/i })
    expect(mockUpdatePlan).not.toHaveBeenCalled()
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockUpdatePlan).toHaveBeenCalledWith('plan-1', { is_active: false })
    })
  })

  it('avisa quando o catálogo não carrega', async () => {
    mockListPlans.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText('Não foi possível carregar os planos.')).toBeInTheDocument()
  })
})