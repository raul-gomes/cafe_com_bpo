import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, render, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import LoginPage from '../src/pages/LoginPage'
import type { Plan } from '../src/schemas/plans'

// Regressão 2026-10-09: "Cadastre-se vai pra tela de cadastro e volta pra tela
// de login". O `GET /plans` (autenticado) era disparado já no mount da página
// de cadastro; o visitante anônimo levava 401, o refresh falhava e o
// interceptor do client redirecionava a /login. Agora o cadastro é um modal
// no login e o catálogo só é buscado quando a oferta é exibida (pós-registro,
// sessão garantida): abrir o modal como anônimo não pode chamar /plans.
const apiGet = vi.hoisted(() => vi.fn())
vi.mock('../src/api/client', () => ({
  apiClient: { get: apiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const mockRegister = vi.hoisted(() => vi.fn())
type AuthState = { register: () => Promise<void>; isAuthenticated: boolean }
const { mockAuthValue } = vi.hoisted(() => ({
  mockAuthValue: { value: { register: mockRegister, isAuthenticated: false } as AuthState },
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => {
    const value = mockAuthValue.value as AuthState
    return {
      isAuthenticated: value.isAuthenticated,
      isLoading: false,
      register: value.register,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      user: null,
      sessionExpired: false,
    }
  },
}))

vi.mock('../src/components/ui/Navbar', () => ({
  Navbar: () => <header data-testid="navbar" />,
}))

const PLAN: Plan = {
  id: 'plan_pro',
  code: 'pro',
  name: 'Pro',
  price: '49.90',
  cycle: 'MONTHLY',
  is_active: true,
  description: 'Acesso total com escrita em todos os módulos.',
  subscriber_count: 0,
}

const callsToPlans = () => apiGet.mock.calls.filter(([url]) => url === '/plans')

const renderLogin = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/painel/tarefas" element={<div data-testid="page">Tarefas</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// O modal de cadastro vive por cima do login, que também tem campo de e-mail —
// os queries do formulário são escopados ao `dialog`.
const submitCadastro = () => {
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByPlaceholderText('Ex: João Silva'), { target: { value: 'João' } })
  fireEvent.change(within(dialog).getByPlaceholderText('seu@email.com'), { target: { value: 'joao@teste.com' } })
  fireEvent.change(within(dialog).getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: '12345678' } })
  fireEvent.change(within(dialog).getByPlaceholderText('Repita a senha'), { target: { value: '12345678' } })
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /li e concordo com os/i }))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Cadastrar$/i }))
}

describe('Login com modal de cadastro — catálogo de planos só é buscado com sessão', () => {
  beforeEach(() => {
    mockAuthValue.value = { register: mockRegister, isAuthenticated: false }
    mockRegister.mockImplementation(() => {
      mockAuthValue.value.isAuthenticated = true
      return Promise.resolve()
    })
    apiGet.mockReset()
    apiGet.mockResolvedValue({ data: [PLAN] })
  })

  it('abrir o modal de cadastro como visitante anônimo não dispara GET /plans', async () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }))
    expect(await screen.findByText('Crie sua conta')).toBeInTheDocument()

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(callsToPlans()).toHaveLength(0)
  })

  it('após cadastrar (autenticado), a oferta busca o catálogo via GET /plans exatamente 1 vez', async () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }))
    await screen.findByText('Crie sua conta')
    await submitCadastro()

    expect(await screen.findByText(/conta criada/i)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 49,90/i)).toBeInTheDocument()
    expect(callsToPlans()).toHaveLength(1)
  })
})