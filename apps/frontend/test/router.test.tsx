import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { RouterProvider } from 'react-router-dom'
import { buildRouter } from '../src/router'
import { AppProviders } from '../src/providers/AppProviders'

// O modal de cadastro consulta o catálogo de planos via usePlans — aqui a rota é
// testada sem rede, o catálogo vazio é suficiente (a oferta só aparece após
// o registro). Usa o provider de produção (QueryClient + Auth).
vi.mock('../src/api/hooks/usePlans', () => ({
  usePlans: () => ({ data: [], isLoading: false }),
}))

const renderRouter = async (entry: string) => {
  window.history.pushState({}, 'Test page', entry)
  const router = await buildRouter()
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

describe('Router', () => {
  // Pages load on demand (React.lazy). Loading the modules these tests render
  // up front keeps them about routing, not about how fast a chunk compiles on
  // a busy machine (the full suite pushed the home chunk past waitFor's 1 s).
  beforeAll(async () => {
    await Promise.all([
      import('../src/pages/HomePage'),
      import('../src/pages/LoginPage'),
    ])
  })

  it('renders_home_route', async () => {
    await renderRouter('/')

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })

  it('renders_login_route', async () => {
    await renderRouter('/login')

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  it('botão "Cadastre-se" da tela de login abre o modal de cadastro', async () => {
    await renderRouter('/login')

    const button = await screen.findByRole('button', { name: /cadastre-se/i })
    fireEvent.click(button)

    expect(await screen.findByText('Crie sua conta')).toBeInTheDocument()
  })

  it('renders_not_found_for_unknown_route', async () => {
    await renderRouter('/unknown-random-route')

    await waitFor(() => {
      expect(screen.getByTestId('not-found')).toBeInTheDocument()
    })
  })
})
