import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AdminUsersPage } from '../src/pages/panel/admin/AdminUsersPage'

/*
 * Admin › Usuários: the administrator hands out access without charging —
 * promote to beta (for a chosen period) and promote/demote the admin role.
 */

const apiGet = vi.hoisted(() => vi.fn())
const apiPost = vi.hoisted(() => vi.fn())
const apiDelete = vi.hoisted(() => vi.fn())
const apiPatch = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('../src/api/client', () => ({
  apiClient: { get: apiGet, post: apiPost, delete: apiDelete, patch: apiPatch },
}))
vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError, info: vi.fn(), warning: vi.fn() },
}))

let authUser = { id: 'admin-1', role: 'admin' }
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: authUser, isAuthenticated: true, isLoading: false }),
}))

const base = {
  name: 'Pessoa Um',
  email: 'p1@cafe.com',
  created_at: '2026-10-01T00:00:00Z',
  access_expires_at: null,
  courtesy: null,
}
const freeUser = { ...base, id: 'user-1', role: 'user', access_state: 'free' }
const betaUser = {
  ...base,
  id: 'user-2',
  name: 'Pessoa Beta',
  email: 'beta@cafe.com',
  role: 'user',
  access_state: 'beta',
  access_expires_at: '2027-01-01T00:00:00Z',
}
const otherAdmin = {
  ...base,
  id: 'admin-2',
  name: 'Outro Admin',
  email: 'adm@cafe.com',
  role: 'admin',
  access_state: 'admin',
}
const selfAdmin = {
  ...base,
  id: 'admin-1',
  name: 'Eu Admin',
  email: 'me@cafe.com',
  role: 'admin',
  access_state: 'admin',
}

function renderPage(users: unknown[]) {
  apiGet.mockResolvedValue({ data: users, headers: { 'x-total-count': String(users.length) } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Admin › Usuários: promover a beta e a admin', () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiDelete.mockReset()
    apiPatch.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    apiPost.mockResolvedValue({ data: { expires_at: '2027-01-01T00:00:00Z' } })
    apiPatch.mockResolvedValue({ data: { id: 'user-1', role: 'admin' } })
    apiDelete.mockResolvedValue({ data: undefined })
    authUser = { id: 'admin-1', role: 'admin' }
  })

  it('libera o beta para o usuário com o prazo padrão', async () => {
    renderPage([freeUser])
    await screen.findByText('Pessoa Um')

    fireEvent.click(screen.getByRole('button', { name: 'Promover a beta' }))
    expect(await screen.findByText(/Beta para Pessoa Um/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Liberar beta' }))

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/admin/users/user-1/beta', { days: 365 })
    )
  })

  it('encerra o beta do usuário', async () => {
    renderPage([betaUser])
    await screen.findByText('Pessoa Beta')

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar beta' }))

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith('/admin/users/user-2/beta')
    )
  })

  it('promove um usuário a administrador', async () => {
    renderPage([freeUser])
    await screen.findByText('Pessoa Um')

    fireEvent.click(screen.getByRole('button', { name: 'Promover a admin' }))

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/admin/users/user-1/role', { role: 'admin' })
    )
  })

  it('rebaixa outro administrador', async () => {
    renderPage([otherAdmin])
    await screen.findByText('Outro Admin')

    fireEvent.click(screen.getByRole('button', { name: 'Rebaixar' }))

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/admin/users/admin-2/role', { role: 'user' })
    )
  })

  it('não oferece rebaixar a própria conta', async () => {
    renderPage([selfAdmin])
    await screen.findByText('Eu Admin')

    expect(screen.queryByRole('button', { name: 'Rebaixar' })).not.toBeInTheDocument()
  })
})
