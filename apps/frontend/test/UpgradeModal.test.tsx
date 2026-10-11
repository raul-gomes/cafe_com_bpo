import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { UpgradeProvider } from '../src/components/ui/UpgradeModal'
import { notifyPlanGate } from '../src/api/planGate'

/**
 * Regressão/RF: quando o write gate do backend recusa uma ação com
 * `"Seu plano não permite esta ação"` (403), o usuário vê um modal convidando a
 * assinar em vez de só um erro genérico. O `apiClient` dispara `notifyPlanGate`
 * e o `UpgradeProvider` (montado na raiz, dentro do Router) abre o modal.
 */

describe('UpgradeModal', () => {
  it('abre quando o gate do plano é notificado e oferece o link Assinar', async () => {
    render(
      <MemoryRouter>
        <UpgradeProvider>
          <div>app</div>
        </UpgradeProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => notifyPlanGate())

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Seu plano não permite esta ação')
    const subscribe = screen.getByRole('link', { name: 'Assinar' })
    expect(subscribe).toHaveAttribute('href', '/painel/pagamentos')
  })

  it('fecha com "Agora não"', async () => {
    render(
      <MemoryRouter>
        <UpgradeProvider>
          <div>app</div>
        </UpgradeProvider>
      </MemoryRouter>,
    )

    act(() => notifyPlanGate())
    await screen.findByRole('dialog')
    act(() => {
      screen.getByRole('button', { name: 'Agora não' }).click()
    })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('notify enquanto já aberto não duplica o modal', async () => {
    render(
      <MemoryRouter>
        <UpgradeProvider>
          <div>app</div>
        </UpgradeProvider>
      </MemoryRouter>,
    )

    act(() => {
      notifyPlanGate()
      notifyPlanGate()
    })

    const dialogs = await screen.findAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
  })
})