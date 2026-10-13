import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { safeReturnTo, loginPathFor } from '../src/lib/returnTo'
import { LoginForm } from '../src/components/auth/LoginForm'
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute'

/*
 * AUD-039: an expired session sent people to /login with only the pathname,
 * the login ignored it and went to /painel, and ProtectedRoute kept nothing.
 * The destination must come back intact (query and hash too) without opening
 * a redirect to another site.
 */

const auth = vi.hoisted(() => ({ isAuthenticated: false, isLoading: false, login: vi.fn() }))
const apiPost = vi.hoisted(() => vi.fn())

vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../src/api/client', () => ({ apiClient: { post: apiPost } }))
vi.mock('../src/api/team', () => ({ acceptInvitation: vi.fn() }))

describe('safeReturnTo', () => {
  it('keeps an internal destination with query and hash', () => {
    expect(safeReturnTo('/painel/contratos/123?aba=texto#clausula-2')).toBe('/painel/contratos/123?aba=texto#clausula-2')
  })

  it.each([
    'https://evil.example/painel',
    '//evil.example/painel',
    '/\\evil.example',
    'javascript:alert(1)',
    'painel',
    '/login?return_to=/painel',
    '/auth/callback',
    '',
    null,
  ])('refuses %s', raw => {
    expect(safeReturnTo(raw)).toBeNull()
  })

  it('builds the login path with the full current location', () => {
    expect(loginPathFor({ pathname: '/painel/orcamento/9', search: '?v=2', hash: '#itens' })).toBe(
      '/login?return_to=%2Fpainel%2Forcamento%2F9%3Fv%3D2%23itens'
    )
  })
})

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search + location.hash}</p>
}

describe('login volta ao destino original (AUD-039)', () => {
  beforeEach(() => {
    auth.isAuthenticated = false
    auth.login.mockReset().mockResolvedValue({})
    apiPost.mockReset().mockResolvedValue({ data: { access_token: 't' } })
  })

  const signIn = async (entry: string) => {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'ana@cafe.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'segredo-de-teste' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))
    return screen.findByTestId('where')
  }

  it('após entrar, abre o registro em que a sessão expirou', async () => {
    const where = await signIn('/login?session_expired=true&return_to=%2Fpainel%2Fcontratos%2F123%3Faba%3Dtexto%23c2')
    expect(where).toHaveTextContent('/painel/contratos/123?aba=texto#c2')
  })

  it('um destino externo cai no painel', async () => {
    const where = await signIn('/login?return_to=https%3A%2F%2Fevil.example')
    expect(where).toHaveTextContent(/^\/painel$/)
  })

  it('a rota protegida guarda o destino ao mandar para o login', async () => {
    render(
      <MemoryRouter initialEntries={['/painel/contratos/7?aba=texto']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/painel/*" element={<p>conteúdo</p>} />
          </Route>
          <Route path="/login" element={<Where />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/login?return_to=%2Fpainel%2Fcontratos%2F7%3Faba%3Dtexto')
    )
  })
})
