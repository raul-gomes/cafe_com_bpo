import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { UpsellBanner } from '../src/components/panel/UpsellBanner'
import { renderWithProviders } from './test-utils'

/**
 * Banner de upsell mostrado apenas para o plano free (§5 Fase 10).
 *
 * A decisão de exibi-lo vive no `PanelLayout` (lê `access.access === 'free'`);
 * aqui o banner é testado sozinho: texto, CTA e o descarte por sessão.
 */
describe('UpsellBanner', () => {
  it('mostra o convite para assinar com CTA para /painel/pagamentos', () => {
    renderWithProviders(<UpsellBanner />)

    expect(screen.getByText('Você está no plano gratuito')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /assinar/i })).toHaveAttribute(
      'href',
      '/painel/pagamentos',
    )
    expect(screen.getByLabelText('Fechar aviso')).toBeInTheDocument()
  })

  it('dispensa o aviso até um novo carregamento', () => {
    renderWithProviders(<UpsellBanner />)

    fireEvent.click(screen.getByLabelText('Fechar aviso'))

    expect(screen.queryByText('Você está no plano gratuito')).not.toBeInTheDocument()

    // Um novo montar (reload) volta a exibir: o descarte é por sessão, em memória.
    renderWithProviders(<UpsellBanner />)
    expect(screen.getByText('Você está no plano gratuito')).toBeInTheDocument()
  })
})