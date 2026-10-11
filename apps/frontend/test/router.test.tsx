import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RouterProvider } from 'react-router-dom'
import { buildRouter } from '../src/router'
import { AppProviders } from '../src/providers/AppProviders'

// O CadastroPage consulta o catálogo de planos via usePlans — aqui a rota é
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

  it('renders_cadastro_route', async () => {
    await renderRouter('/cadastro')

    await waitFor(() => {
      expect(screen.getByText('Crie sua conta')).toBeInTheDocument()
    })
  })

  it('link "Cadastre-se" da tela de login chega ao cadastro', async () => {
    await renderRouter('/login')

    const link = await screen.findByRole('link', { name: /cadastre-se/i })
    expect(link).toHaveAttribute('href', '/cadastro')
    fireEvent.click(link)

    expect(await screen.findByText('Crie sua conta')).toBeInTheDocument()
  })

  it('renders_not_found_for_unknown_route', async () => {
    await renderRouter('/unknown-random-route')

    await waitFor(() => {
      expect(screen.getByTestId('not-found')).toBeInTheDocument()
    })
  })
})
