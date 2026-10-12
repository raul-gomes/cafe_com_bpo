import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicShell } from '../src/components/auth/LoginDialogContext'
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
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('public header and login dialog', () => {
  it('shows the actions in the order Precificação, Quero ser Beta, Login', () => {
    renderPublic()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(Array.from(nav.children).map(el => el.textContent)).toEqual(['Precificação', 'Quero ser Beta', 'Login'])
  })

  it('Login opens the dialog over the current page and Escape closes it', () => {
    renderPublic()
    expect(screen.queryByRole('dialog', { name: 'Login' })).not.toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Login' }))
    expect(screen.getByRole('dialog', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByText('Simulador', { selector: 'main' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Login' })).not.toBeInTheDocument()
  })

  it('keeps keyboard focus inside the dialog and gives it back to Login on close (AUD-036)', () => {
    renderPublic()
    const opener = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Login' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Login' })
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])')
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(opener)
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
