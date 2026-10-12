import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CafeBanner } from '../src/components/home/CafeBanner'
import { CafeRsvpStrip } from '../src/components/home/CafeRsvp'
import CafesPage from '../src/pages/CafesPage'

/*
 * AUD-037: the banner and the cards computed "last Wednesday, 14h" in the
 * browser while the RSVP strip used the date set in Admin (site/public). Every
 * public mention must show the administered meeting, in Brasília time.
 */

const platformApi = vi.hoisted(() => ({
  getPublicSite: vi.fn(),
  confirmCafePresence: vi.fn(),
}))

vi.mock('../src/api/platform', () => platformApi)

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false }),
}))

vi.mock('../src/components/auth/LoginDialogContext', () => ({
  useLoginDialog: () => ({ openLogin: vi.fn() }),
}))

// Wednesday 21/10/2026 at 15:30 in Brasília: not the last Wednesday, not 14h.
const ADMIN_MEETING = '2026-10-21T18:30:00Z'

function renderWithSite(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('data do café: uma fonte só (AUD-037)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    platformApi.getPublicSite.mockResolvedValue({
      login_notice: { title: 't', message: 'm', link_label: null, link_url: null },
      cafe_meeting: { title: 'Café aberto', starts_at: ADMIN_MEETING, duration_minutes: 60 },
    })
  })

  it('o banner mostra o encontro definido no Admin', async () => {
    renderWithSite(<CafeBanner />)

    expect(
      await screen.findByText('quarta-feira, 21 de outubro, às 15h30', {}, { timeout: 3000 })
    ).toBeInTheDocument()
  })

  it('o card da agenda mostra o mesmo encontro', async () => {
    renderWithSite(<CafesPage />)

    expect(await screen.findByText('quarta-feira, 21 de outubro, às 15h30')).toBeInTheDocument()
  })

  it('a faixa de confirmação continua com a mesma data', async () => {
    renderWithSite(<CafeRsvpStrip />)

    expect(await screen.findByText(/Quarta-feira, 21 de outubro/)).toBeInTheDocument()
  })
})
