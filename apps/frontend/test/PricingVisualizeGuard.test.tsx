import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { PublicPricingSimulator } from '../src/components/pricing/PublicPricingSimulator'
import ProposalPreviewPage from '../src/pages/ProposalPreviewPage'
import { SESSION_KEY } from '../src/schemas/proposalSession'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

/*
 * AUD-042: with 0 people or 0 hours the engine returns null, but "Visualizar
 * Proposta Detalhada" stored that null and opened the preview, which then read
 * pricing.breakdown and broke.
 */

const navigate = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false }),
}))

vi.mock('../src/components/ui/Navbar', () => ({ Navbar: () => null }))

function renderInApp(ui: React.ReactElement) {
  return render(
    <ConfirmProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ConfirmProvider>
  )
}

describe('calculadora pública: prévia só com cálculo válido (AUD-042)', () => {
  beforeEach(() => {
    navigate.mockClear()
    sessionStorage.clear()
  })

  it('com zero pessoas, avisa e não abre a prévia', () => {
    const { container } = renderInApp(<PublicPricingSimulator />)
    const people = container.querySelector<HTMLInputElement>('input[name="operation.people_count"]')!
    fireEvent.change(people, { target: { value: '0' } })

    fireEvent.click(screen.getByRole('button', { name: /Visualizar Proposta Detalhada/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/pelo menos 1 pessoa/i)
    expect(navigate).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('a prévia recusa um rascunho sem cálculo em vez de quebrar', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ form: {}, pricing: null, clientName: 'Empresa' }))
    renderInApp(<ProposalPreviewPage />)

    expect(screen.getByText('Nenhuma proposta encontrada.')).toBeInTheDocument()
  })
})
