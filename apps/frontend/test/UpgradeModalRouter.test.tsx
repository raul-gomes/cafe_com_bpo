import { useEffect } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { buildRoutes } from '../src/router'
import { notifyPlanGate } from '../src/api/planGate'

/**
 * Regressão (bug da "tela preta"): ao clicar em "Novo Prospecto" — e demais
 * botões de criação — o usuário free via o erro
 * `Cannot destructure property 'basename' of React.useContext(...)` porque o
 * `UpgradeProvider` renderizava o `<Link>` "Assinar" FORA do Router (wrapper
 * no `App.tsx`, irmão do `RouterProvider`).
 *
 * O provider vive agora na raiz das rotas (layout sem path em `router.tsx`,
 * envolvendo o `Outlet`). Este teste monta a estrutura real de produção —
 * `RouterProvider` → rota raiz com o provider —, abre o modal via
 * `notifyPlanGate` e garante que o link renderiza dentro de um contexto de
 * Router verdadeiro, sem crash.
 */
describe('UpgradeModal no router real', () => {
  it('abre o modal na raiz das rotas sem crash (regressão da tela preta)', async () => {
    const routes = await buildRoutes()

    let notify = () => {}
    function Trigger() {
      useEffect(() => {
        notify = () => notifyPlanGate()
      }, [])
      return <div data-testid="trigger">trigger</div>
    }

    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: routes[0].element,
          children: [{ path: '/x', element: <Trigger /> }],
        },
      ],
      { initialEntries: ['/x'] }
    )

    render(<RouterProvider router={router} />)
    await screen.findByTestId('trigger')

    notify()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('link', { name: /assinar/i })).toHaveAttribute(
      'href',
      '/painel/pagamentos'
    )
  })
})