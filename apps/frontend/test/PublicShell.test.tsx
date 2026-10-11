import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicShell } from '../src/components/auth/LoginDialogContext'
import { Navbar } from '../src/components/ui/Navbar'
import { proximoCafeAberto } from '../src/components/home/cafes'

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

describe('topo público e login suspenso', () => {
  it('mostra as ações na ordem Simulador, Quero ser Beta, Login', () => {
    renderPublic()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(Array.from(nav.children).map(el => el.textContent)).toEqual(['Simulador', 'Quero ser Beta', 'Login'])
  })

  it('Login abre a janela por cima da página atual e Escape fecha', () => {
    renderPublic()
    expect(screen.queryByRole('dialog', { name: 'Login' })).not.toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Login' }))
    expect(screen.getByRole('dialog', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByText('Simulador', { selector: 'main' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Login' })).not.toBeInTheDocument()
  })
})

describe('próximo café aberto (última quarta do mês)', () => {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  it('antes da última quarta, é a deste mês', () => {
    expect(iso(proximoCafeAberto(new Date(2026, 9, 11)))).toBe('2026-10-28')
  })

  it('no próprio dia ainda vale', () => {
    expect(iso(proximoCafeAberto(new Date(2026, 9, 28, 20, 0)))).toBe('2026-10-28')
  })

  it('depois da última quarta, passa para o mês seguinte', () => {
    expect(iso(proximoCafeAberto(new Date(2026, 9, 29)))).toBe('2026-11-25')
  })

  it('vira o ano corretamente', () => {
    expect(iso(proximoCafeAberto(new Date(2026, 11, 31)))).toBe('2027-01-27')
  })
})
