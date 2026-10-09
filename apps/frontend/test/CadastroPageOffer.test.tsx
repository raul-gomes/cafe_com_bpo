import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

import CadastroPage from '../src/pages/CadastroPage'
import type { Plan } from '../src/schemas/plans'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'

// useAuth mock — holder permite cada teste dirigir auth register e sessão.
const mockRegister = vi.hoisted(() => vi.fn())
const { mockAuthValue } = vi.hoisted(() => ({
  mockAuthValue: { value: { register: mockRegister } as unknown },
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => {
    const value = mockAuthValue.value as {
      isAuthenticated: boolean
      isLoading: boolean
      register: () => Promise<void>
    }
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

// usePlans — holder devolve o catálogo que a oferta exibe.
const { mockPlansValue } = vi.hoisted(() => ({
  mockPlansValue: { value: [] as Plan[], loading: true },
}))

vi.mock('../src/api/hooks/usePlans', () => ({
  usePlans: () => ({ data: mockPlansValue.value, isLoading: mockPlansValue.loading }),
}))

// Navbar toca em notificações/usuário reais — fora do escopo deste teste.
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

const renderCadastro = (initialEntry = '/cadastro') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/painel" element={<div data-testid="page">Painel</div>} />
          <Route path="/painel/tarefas" element={<div data-testid="page">Tarefas</div>} />
          <Route path="/painel/pagamentos" element={<div data-testid="page">Pagamentos</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const submitCadastro = async () => {
  fireEvent.change(screen.getByPlaceholderText('Ex: João Silva'), { target: { value: 'João' } })
  fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'joao@teste.com' } })
  fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: '12345678' } })
  fireEvent.change(screen.getByPlaceholderText('Repita a senha'), { target: { value: '12345678' } })
  fireEvent.click(screen.getByRole('button', { name: /^Cadastrar$/i }))
}

describe('CadastroPage — oferta de assinatura para novos usuários', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthValue.value = { register: mockRegister, isAuthenticated: false, isLoading: false }
    mockPlansValue.value = [PLAN]
    mockPlansValue.loading = false
    mockRegister.mockResolvedValue(undefined)
  })

  it('após cadastrar, mostra o investimento e "Continuar sem assinar" chega ao painel', async () => {
    renderCadastro()

    await submitCadastro()

    expect(await screen.findByText(/investimento/i)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 49,90/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /continuar sem assinar/i }))

    expect(await screen.findByTestId('page')).toHaveTextContent('Painel')
  })

  it('sem plano ativo no catálogo, o cadastro segue direto para o painel (sem oferta)', async () => {
    mockPlansValue.value = []
    renderCadastro()

    await submitCadastro()

    expect(await screen.findByTestId('page')).toHaveTextContent('Painel')
    expect(screen.queryByText(/investimento/i)).not.toBeInTheDocument()
  })
})