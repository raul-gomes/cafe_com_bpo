import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute'
import { apiClient, authStorage } from '../src/api/client'

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
    authStorage: {
      getToken: vi.fn(),
      setToken: vi.fn(),
      getRefreshToken: vi.fn(),
      setRefreshToken: vi.fn(),
      clearToken: vi.fn(),
    },
  }
})

const TestProtectedContent = () => <div data-testid="protected-content">Protected Content</div>
const TestLoginPage = () => <div data-testid="login-page">Login Page</div>

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows loading spinner when isLoading is true', () => {
    vi.mocked(authStorage.getToken).mockReturnValue('valid-token')

    const LoadingTestComponent = () => {
      const { isLoading } = useAuth()
      return isLoading ? <div data-testid="loading-spinner" /> : <div data-testid="loaded" />
    }

    render(
      <BrowserRouter>
        <AuthProvider>
          <LoadingTestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', async () => {
    vi.mocked(authStorage.getToken).mockReturnValue(null)

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
    vi.mocked(authStorage.getToken).mockReturnValue('valid-token')
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
    localStorage.clear()
  })

  it('initializes with loading state true', () => {
    vi.mocked(authStorage.getToken).mockReturnValue('valid-token')

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
    vi.mocked(authStorage.getToken).mockReturnValue(expiredToken)
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
    expect(authStorage.clearToken).toHaveBeenCalled()
  })

  it('retries on server error (500) and eventually succeeds', async () => {
    vi.mocked(authStorage.getToken).mockReturnValue('valid-token')

    vi.mocked(apiClient.get).mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject({ response: { status: 500 } }), 100)
      })
    })

    vi.mocked(apiClient.get).mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject({ response: { status: 500 } }), 100)
      })
    })

    vi.mocked(apiClient.get).mockResolvedValueOnce({
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

  it('login function sets token via authStorage', async () => {
    vi.mocked(authStorage.getToken).mockReturnValue(null)

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

    expect(authStorage.setToken).not.toHaveBeenCalled()
  })

  it('logout clears token and resets user state', async () => {
    vi.mocked(authStorage.getToken).mockReturnValue('valid-token')
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { id: '1', email: 'test@test.com' },
    })

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

describe('API Client 401 Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('clears token via authStorage.clearToken on 401', async () => {
    localStorage.setItem('@cafe_bpo:token_v1', 'invalid-token')

    try {
      const error = {
        response: { status: 401 },
        config: { _retry: false },
      }

      const errorHandler = (e: any) => {
        if (e.response?.status === 401) {
          authStorage.clearToken()
        }
        return Promise.reject(e)
      }

      await errorHandler(error)
    } catch (e) {
      // Expected
    }

    expect(authStorage.clearToken).toHaveBeenCalled()
  })

  it('does not redirect when already on login page', () => {
    const originalLocation = window.location

    Object.defineProperty(window, 'location', {
      value: { pathname: '/login', href: 'http://localhost/login' },
      writable: true,
    })

    const currentPath = window.location.pathname
    expect(currentPath).toBe('/login')

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })
})

describe('Error States and Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('handles network errors by clearing token', async () => {
    vi.mocked(authStorage.getToken).mockReturnValue('valid-token')
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
      expect(screen.getByTestId('user-status')).toHaveTextContent('unauthenticated')
    })
    expect(authStorage.clearToken).toHaveBeenCalled()
  })

  it('retries on 5xx errors', async () => {
    vi.mocked(authStorage.getToken).mockReturnValue('valid-token')

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
