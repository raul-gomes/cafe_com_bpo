import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AdminUsersPage } from '../src/pages/panel/admin/AdminUsersPage'
import { ADMIN_EXPORT_LIMIT } from '../src/api/platform'

/*
 * AUD-044: the admin users list stopped at 300 (confirmations at 500) without
 * saying so, and "Baixar para Excel" exported only that cut list.
 */

const apiGet = vi.hoisted(() => vi.fn())
const download = vi.hoisted(() => vi.fn())

vi.mock('../src/api/client', () => ({ apiClient: { get: apiGet, post: vi.fn(), delete: vi.fn(), patch: vi.fn() } }))
vi.mock('../src/lib/spreadsheet', () => ({ downloadSpreadsheet: download }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', role: 'admin' }, isAuthenticated: true, isLoading: false }),
}))

const user = (i: number) => ({
  id: `00000000-0000-0000-0000-00000000000${i}`,
  name: `Pessoa ${i}`,
  email: `p${i}@cafe.com`,
  role: 'user',
  created_at: '2026-10-01T00:00:00Z',
  access_state: 'free',
  access_expires_at: null,
  courtesy: null,
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Admin › Usuários: lista cortada é avisada e o Excel traz todos (AUD-044)', () => {
  beforeEach(() => {
    apiGet.mockReset()
    download.mockReset()
    apiGet.mockImplementation(async (_url: string, config?: { params?: { limit?: number } }) => {
      const all = [1, 2, 3, 4, 5].map(user)
      const items = config?.params?.limit ? all.slice(0, config.params.limit) : all.slice(0, 2)
      return { data: items, headers: { 'x-total-count': '5' } }
    })
  })

  it('avisa quando a tela mostra só parte dos usuários', async () => {
    renderPage()

    expect(await screen.findByText(/Mostrando 2 de 5 usuários/)).toBeInTheDocument()
  })

  it('o Excel pede a lista inteira ao servidor', async () => {
    renderPage()
    await screen.findByText('Pessoa 1')

    fireEvent.click(screen.getByRole('button', { name: /Baixar para Excel/i }))

    await waitFor(() => expect(download).toHaveBeenCalled())
    expect(apiGet).toHaveBeenLastCalledWith('/admin/users', {
      params: { limit: ADMIN_EXPORT_LIMIT },
    })
    expect(download.mock.calls[0][2]).toHaveLength(5)
  })
})
