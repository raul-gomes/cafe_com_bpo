import { screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import { AdminRoute } from '../src/components/auth/AdminRoute'
import { renderWithProviders } from './test-utils'

// Auth state drives the guard: it is reset before each case.
const { authState } = vi.hoisted(() => ({
  authState: {
    user: null as { role?: string } | null,
    isAuthenticated: false,
    isLoading: false,
  },
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => authState,
}))

function renderGuard() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<span data-testid="login" />} />
      <Route element={<AdminRoute />}>
        <Route path="/painel/admin" element={<span data-testid="admin-content" />} />
      </Route>
    </Routes>,
    { initialEntries: ['/painel/admin'] }
  )
}

describe('AdminRoute', () => {
  beforeEach(() => {
    authState.user = null
    authState.isAuthenticated = false
    authState.isLoading = false
  })

  it('redirects unauthenticated visitors to /login', () => {
    renderGuard()
    expect(screen.getByTestId('login')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
  })

  it('blocks non-admin members with the restricted notice', () => {
    authState.user = { role: 'operador' }
    authState.isAuthenticated = true
    renderGuard()
    expect(screen.getByText('Acesso Restrito')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
  })

  it('renders the guarded child route for admins', () => {
    authState.user = { role: 'admin' }
    authState.isAuthenticated = true
    renderGuard()
    expect(screen.getByTestId('admin-content')).toBeInTheDocument()
  })
})
