import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicShell } from '../src/components/auth/PublicShell'
import { Navbar } from '../src/components/ui/Navbar'
import { nextOpenCafe } from '../src/components/home/cafes'

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

function renderPublic() {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/simulador']}>
        <Routes>
          <Route element={<PublicShell />}>
            <Route path="/simulador" element={<><Navbar /><main>Simulador</main></>} />
            <Route path="/login" element={<div data-testid="login-destination">Login page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('public header and the standalone login page', () => {
  it('shows the actions in the order Precificação, Quero ser Beta, Login', () => {
    renderPublic()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(Array.from(nav.children).map(el => el.textContent)).toEqual(['Precificação', 'Quero ser Beta', 'Login'])
  })

  it('the Login button goes to the standalone /login page (no dialog over the current page)', () => {
    renderPublic()
    expect(screen.queryByTestId('login-destination')).not.toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Login' }))

    expect(screen.getByTestId('login-destination')).toBeInTheDocument()
    expect(screen.queryByText('Simulador', { selector: 'main' })).not.toBeInTheDocument()
  })
})

describe('next open café (last Wednesday of the month)', () => {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  it('before the last Wednesday, it is this month\'s', () => {
    expect(iso(nextOpenCafe(new Date(2026, 9, 11)))).toBe('2026-10-28')
  })

  it('the day itself still counts', () => {
    expect(iso(nextOpenCafe(new Date(2026, 9, 28, 20, 0)))).toBe('2026-10-28')
  })

  it('after the last Wednesday, it moves to next month', () => {
    expect(iso(nextOpenCafe(new Date(2026, 9, 29)))).toBe('2026-11-25')
  })

  it('rolls over the year correctly', () => {
    expect(iso(nextOpenCafe(new Date(2026, 11, 31)))).toBe('2027-01-27')
  })
})
