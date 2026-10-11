import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { useAccess } from '../src/api/hooks/useAccess'
import { apiClient, tokenStorage } from '../src/api/client'
import { queryClient } from '../src/api/queryClient'

/**
 * Regressão (bug real): trocar de usuário na mesma sessão SPA exibia o acesso
 * do usuário anterior. O `GET /access` é guardado sob a chave global
 * `['access']` com `staleTime` de 5 min; sem limpar a cache do React Query no
 * login/logout, um `operador2` via o card de "Conta de administrador" do admin
 * que saiu antes dele — mesmo o banco dizendo `role='user'`.
 */

// Mock do refresh via axios cru (chamado no mount do AuthProvider sem token).
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios')
  return {
    ...actual,
    default: new Proxy(actual.default, {
      apply(target, thisArg, args) { return Reflect.apply(target, thisArg, args) },
      get(target, prop) {
        if (prop === 'post') {
          return vi.fn().mockRejectedValue(new Error('No refresh cookie'))
        }
        return Reflect.get(target, prop)
      },
    }),
  }
})

vi.mock('../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../src/api/client')>('../src/api/client')
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
    tokenStorage: {
      getToken: vi.fn(),
      setToken: vi.fn(),
      clearToken: vi.fn(),
    },
  }
})

const ADMIN_ACCESS = {
  access: 'free',
  read_only_modules: [],
  writable_modules: ['captar', 'comunidade', 'gestao', 'operacional', 'pagamentos'],
  expires_at: null,
  grace_until: null,
  shows_dunning_banner: false,
  shows_beta_banner: false,
  subscription_status: null,
  plan: null,
  is_admin: true,
}

const USER_ACCESS = {
  ...ADMIN_ACCESS,
  read_only_modules: ['captar', 'gestao'],
  is_admin: false,
}

const Harness = () => {
  const { user, login, logout } = useAuth()
  const { data: access } = useAccess()

  return (
    <div>
      <span data-testid="user-email">{user?.email ?? 'none'}</span>
      <span data-testid="is-admin">{access?.is_admin === undefined ? 'loading' : String(access.is_admin)}</span>
      <button onClick={() => login('admin-token')}>login admin</button>
      <button onClick={() => login('user-token')}>login user</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

describe('cache entre usuários', () => {
  let accessCalls = 0

  beforeEach(() => {
    vi.clearAllMocks()
    accessCalls = 0
    queryClient.clear()

    let storedToken: string | null = null
    vi.mocked(tokenStorage.getToken).mockImplementation(() => storedToken)
    vi.mocked(tokenStorage.setToken).mockImplementation((token: string | null) => {
      storedToken = token
    })
    vi.mocked(tokenStorage.clearToken).mockImplementation(() => {
      storedToken = null
    })
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} })

    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/auth/me') {
        const token = tokenStorage.getToken()
        if (token === 'admin-token') {
          return { data: { id: 'a1', email: 'admin@cafecombpo.com.br', role: 'admin' } }
        }
        return { data: { id: 'u1', email: 'operador2@cafecombpo.com.br', role: 'user' } }
      }
      if (url === '/access') {
        accessCalls += 1
        const token = tokenStorage.getToken()
        return { data: token === 'admin-token' ? ADMIN_ACCESS : USER_ACCESS }
      }
      throw new Error(`unexpected GET ${url}`)
    })
  })

  it('após logout+login, o novo usuário não herda o is_admin em cache do anterior', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('user-email')).toHaveTextContent('none'))

    // Admin entra: GET /access dispara e devolve is_admin=true (cache aquecido).
    screen.getByText('login admin').click()
    await waitFor(() => expect(screen.getByTestId('user-email')).toHaveTextContent('admin@cafecombpo.com.br'))
    await waitFor(() => expect(screen.getByTestId('is-admin')).toHaveTextContent('true'))
    const callsAfterAdmin = accessCalls
    expect(callsAfterAdmin).toBeGreaterThanOrEqual(1)

    // Logout e login como usuário comum na mesma SPA.
    screen.getByText('logout').click()
    await waitFor(() => expect(screen.getByTestId('user-email')).toHaveTextContent('none'))

    screen.getByText('login user').click()
    await waitFor(() => expect(screen.getByTestId('user-email')).toHaveTextContent('operador2@cafecombpo.com.br'))

    // O coração da regressão: a cache do admin foi limpa, então o /access é
    // buscado de novo e is_admin=false. Sem o clear, o dado verde (5 min de
    // staleTime) reaparece como se fosse do operador2.
    await waitFor(() => expect(accessCalls).toBeGreaterThan(callsAfterAdmin))
    await waitFor(() => expect(screen.getByTestId('is-admin')).toHaveTextContent('false'))
  })
})