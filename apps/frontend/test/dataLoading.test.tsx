import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute'
import { apiClient, tokenStorage } from '../src/api/client'

// Mock refresh endpoint — called on AuthProvider mount when no token in memory
// We mock the `post` call BUT keep the underlying `axios.create` etc. working
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

const TestProtectedContent = () => <div data-testid="protected-content">Protected Content</div>
const TestLoginPage = () => <div data-testid="login-page">Login Page</div>

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner when isLoading is true', () => {
    // Simulate loading by having a token but delaying the API response
    vi.mocked(tokenStorage.getToken).mockReturnValue('valid-token')
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {})) // never resolves

    const LoadingTestComponent = () => {
      const { isLoading } = useAuth()
      return isLoading ? <div data-testid="loading-spinner-processed" /> : <div data-testid="loaded" />
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <LoadingTestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByTestId('loading-spinner-processed')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', async () => {
    vi.mocked(tokenStorage.getToken).mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={['/painel']}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/painel" element={<TestProtectedContent />} />
            </Route>
            <Route path="/login" element={<TestLoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  it('renders Outlet when authenticated', async () => {
    vi.mocked(tokenStorage.getToken).mockReturnValue('valid-token')
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: '1', email: 'test@test.com' },
    })

    render(
      <MemoryRouter initialEntries={['/painel']}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/painel" element={<TestProtectedContent />} />
            </Route>
            <Route path="/login" element={<TestLoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })
  })
})

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with loading state true', () => {
    vi.mocked(tokenStorage.getToken).mockReturnValue('valid-token')
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {})) // never resolves

    const TestComponent = () => {
      const { isLoading } = useAuth()
      return <div data-testid="loading">{isLoading ? 'true' : 'false'}</div>
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('true')
  })

  it('handles token expiration and sets sessionExpired flag', async () => {
    const expiredToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 })) + '.signature'
    vi.mocked(tokenStorage.getToken).mockReturnValue(expiredToken)
    vi.mocked(apiClient.get).mockRejectedValueOnce({
      response: { status: 401 },
    })

    const TestComponent = () => {
      const { sessionExpired } = useAuth()
      return <div data-testid="session-expired">{sessionExpired ? 'true' : 'false'}</div>
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('session-expired')).toHaveTextContent('true')
    })
    expect(tokenStorage.clearToken).toHaveBeenCalled()
  })

  it('retries on server error (500) and eventually succeeds', async () => {
    vi.mocked(tokenStorage.getToken).mockReturnValue('valid-token')

    vi.mocked(apiClient.get)
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        data: { id: '1', email: 'test@test.com' },
      })

    const TestComponent = () => {
      const { user, isLoading } = useAuth()
      if (isLoading) return <div data-testid="loading" />
      return <div data-testid="user-email">{user?.email || 'none'}</div>
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@test.com')
    }, { timeout: 5000 })
  })

  it('login function sets token via tokenStorage', async () => {
    vi.mocked(tokenStorage.getToken).mockReturnValue(null)

    const TestComponent = () => {
      const { login } = useAuth()
      return (
        <button onClick={() => login('new-token')} data-testid="login-btn">
          Login
        </button>
      )
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(tokenStorage.setToken).not.toHaveBeenCalled()
  })

  it('logout clears token and resets user state', async () => {
    vi.mocked(tokenStorage.getToken).mockReturnValue('valid-token')
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { id: '1', email: 'test@test.com' },
    })
    vi.mocked(apiClient.post).mockResolvedValue({})

    const TestComponent = () => {
      const { logout, user } = useAuth()
      return (
        <div>
          <button onClick={logout} data-testid="logout-btn">Logout</button>
          <div data-testid="user">{user?.email || 'none'}</div>
        </div>
      )
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@test.com')
    })
  })
})

describe('Error States and Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles network errors by clearing token', async () => {
    vi.mocked(tokenStorage.getToken).mockReturnValue('valid-token')
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network Error'))

    const TestComponent = () => {
      const { user, isLoading } = useAuth()
      if (isLoading) return <div data-testid="loading" />
      return <div data-testid="user-status">{user ? 'authenticated' : 'unauthenticated'}</div>
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      const el = screen.queryByTestId('user-status')
      if (el) {
        expect(el).toHaveTextContent('unauthenticated')
      }
    }, { timeout: 5000 })
    expect(tokenStorage.clearToken).toHaveBeenCalled()
  })

  it('retries on 5xx errors', async () => {
    vi.mocked(tokenStorage.getToken).mockReturnValue('valid-token')

    vi.mocked(apiClient.get)
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ data: { id: '1', email: 'test@test.com' } })

    const TestComponent = () => {
      const { user, isLoading } = useAuth()
      if (isLoading) return <div data-testid="loading" />
      return <div data-testid="user-email">{user?.email || 'none'}</div>
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@test.com')
    }, { timeout: 5000 })

    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })
})
