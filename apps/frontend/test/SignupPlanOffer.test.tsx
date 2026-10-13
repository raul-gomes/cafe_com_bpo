import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'

import { SignupPlanOffer } from '../src/components/payments/SignupPlanOffer'
import { renderWithProviders } from './test-utils'

const PLAN = {
  id: 'plan_pro',
  code: 'pro',
  name: 'Pro',
  price: '49.90',
  cycle: 'MONTHLY',
  is_active: true,
  description: 'Acesso total com escrita em todos os módulos.',
  subscriber_count: 0,
}

const renderOffer = (onContinue = () => {}) =>
  renderWithProviders(<SignupPlanOffer plan={PLAN} onContinue={onContinue} />, {
    initialEntries: ['/login'],
  })

describe('SignupPlanOffer', () => {
  it('mostra o investimento (preço do plano ativo) e as duas opções de continuidade', () => {
    renderOffer()

    expect(screen.getByText(/investimento/i)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 49,90/i)).toBeInTheDocument()
    expect(screen.getByText('/mês')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar sem assinar/i })).toBeInTheDocument()
  })

  it('o botão Assinar aponta para a tela de Pagamentos', () => {
    renderOffer()

    expect(screen.getByRole('link', { name: /assinar pro/i })).toHaveAttribute(
      'href',
      '/painel/pagamentos',
    )
  })

  it('"Continuar sem assinar" chama onContinue e não navega para o checkout', () => {
    const onContinue = vi.fn()
    renderOffer(onContinue)

    fireEvent.click(screen.getByRole('button', { name: /continuar sem assinar/i }))

    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link', { name: /assinar pro/i })).toHaveAttribute(
      'href',
      '/painel/pagamentos',
    )
  })
})