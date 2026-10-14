import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, render, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import LoginPage from '../src/pages/LoginPage'
import type { Plan } from '../src/schemas/plans'

// Fluxo desenhado: a tela base é o login (página dedicada /login); "Cadastre-se"
// abre um MODAL com os campos; ao cadastrar o usuário vê a oferta de assinatura
// e escolhe "Assinar" (opção pré-selecionada → /painel/pagamentos) ou "Continuar
// no plano gratuito" (→ /painel) com o botão "Continuar".
const mockRegister = vi.hoisted(() => vi.fn())
const { mockAuthValue } = vi.hoisted(() => ({
  mockAuthValue: { value: { register: mockRegister, isAuthenticated: false } as AuthState },
}))
type AuthState = { register: () => Promise<void>; isAuthenticated: boolean }

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

const { mockPlansValue } = vi.hoisted(() => ({
  mockPlansValue: { value: [] as Plan[], loading: false },
}))

vi.mock('../src/api/hooks/usePlans', () => ({
  usePlans: () => ({ data: mockPlansValue.value, isLoading: mockPlansValue.loading }),
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

const renderLogin = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/painel" element={<div data-testid="page">Painel</div>} />
          <Route path="/painel/tarefas" element={<div data-testid="page">Tarefas</div>} />
          <Route path="/painel/pagamentos" element={<div data-testid="page">Pagamentos</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const openRegisterModal = () => {
  fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }))
}

// O modal de cadastro vive por cima do login, que também tem campos de e-mail
// e senha — os queries do formulário são escopados ao dialog do cadastro.
const registerFields = () => {
  const dialog = screen.getByText('Crie sua conta').closest('[role="dialog"]') as HTMLElement
  return {
    name: within(dialog).getByPlaceholderText('Ex: João Silva'),
    email: within(dialog).getByPlaceholderText('seu@email.com'),
    password: within(dialog).getByPlaceholderText('Mínimo 8 caracteres'),
    confirm: within(dialog).getByPlaceholderText('Repita a senha'),
    terms: within(dialog).getByRole('checkbox', { name: /li e concordo com os/i }),
    submit: within(dialog).getByRole('button', { name: /^Cadastrar$/i }),
  }
}

const submitCadastro = () => {
  const fields = registerFields()
  fireEvent.change(fields.name, { target: { value: 'João' } })
  fireEvent.change(fields.email, { target: { value: 'joao@teste.com' } })
  fireEvent.change(fields.password, { target: { value: '12345678' } })
  fireEvent.change(fields.confirm, { target: { value: '12345678' } })
  fireEvent.click(fields.terms)
  fireEvent.click(fields.submit)
}

describe('Login → Cadastre-se (modal) → oferta de assinatura', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthValue.value = { register: mockRegister, isAuthenticated: false }
    mockRegister.mockImplementation(() => {
      mockAuthValue.value.isAuthenticated = true
      return Promise.resolve()
    })
    mockPlansValue.value = [PLAN]
    mockPlansValue.loading = false
  })

  it('clica em Cadastre-se e o modal de cadastro abre sobre a tela de login', async () => {
    renderLogin()

    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
    openRegisterModal()

    expect(await screen.findByText('Crie sua conta')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ex: João Silva')).toBeInTheDocument()
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('cadastro concluído → oferta no modal; continuar no gratuito vai para o painel', async () => {
    renderLogin()

    openRegisterModal()
    await submitCadastro()

    expect(await screen.findByText(/conta criada/i)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 49,90/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /continuar no plano gratuito/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }))

    expect(await screen.findByTestId('page')).toHaveTextContent('Painel')
  })

  it('na oferta, "Assinar" (pré-selecionada) vai para a tela de pagamentos', async () => {
    renderLogin()

    openRegisterModal()
    await submitCadastro()

    expect(await screen.findByText(/conta criada/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }))

    expect(await screen.findByTestId('page')).toHaveTextContent('Pagamentos')
  })

  it('sem aceitar os termos LGPD, bloqueia o cadastro e não chama register', async () => {
    renderLogin()

    openRegisterModal()
    await screen.findByPlaceholderText('Ex: João Silva')
    const fields = registerFields()
    fireEvent.change(fields.name, { target: { value: 'João' } })
    fireEvent.change(fields.email, { target: { value: 'joao@teste.com' } })
    fireEvent.change(fields.password, { target: { value: '12345678' } })
    fireEvent.change(fields.confirm, { target: { value: '12345678' } })
    fireEvent.click(fields.submit)

    expect(await screen.findByText(/aceitar os Termos de Uso e Política de Privacidade/i)).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('catálogo sem plano ativo: após cadastrar vai direto ao painel, sem oferta', async () => {
    mockPlansValue.value = []
    renderLogin()

    openRegisterModal()
    await submitCadastro()

    expect(await screen.findByTestId('page')).toHaveTextContent('Painel')
    expect(screen.queryByText(/investimento/i)).not.toBeInTheDocument()
  })
})