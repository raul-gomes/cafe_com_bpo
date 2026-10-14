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
  it('mostra o investimento e as duas opções, com "Assinar" pré-selecionada', () => {
    renderOffer()

    expect(screen.getByText(/R\$ 49,90/i)).toBeInTheDocument()
    expect(screen.getByText('/mês')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /assinar pro/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /continuar no plano gratuito/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('"Continuar" com a assinatura selecionada escolhe "subscribe"', () => {
    const onContinue = vi.fn()
    renderOffer(onContinue)

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }))

    expect(onContinue).toHaveBeenCalledWith('subscribe')
  })

  it('escolher o gratuito e "Continuar" decide por "free"', () => {
    const onContinue = vi.fn()
    renderOffer(onContinue)

    fireEvent.click(screen.getByRole('radio', { name: /continuar no plano gratuito/i }))
    expect(screen.getByRole('radio', { name: /continuar no plano gratuito/i })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }))

    expect(onContinue).toHaveBeenCalledWith('free')
  })
})
