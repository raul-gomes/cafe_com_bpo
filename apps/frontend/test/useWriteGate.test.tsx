import { useCallback, useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { UpgradeProvider } from '../src/components/ui/UpgradeModal'
import { useWriteGate, type WriteGateModule } from '../src/api/hooks/useWriteGate'

const mockUseAccess = vi.hoisted(() => vi.fn())
vi.mock('../src/api/hooks/useAccess', () => ({ useAccess: mockUseAccess }))

/**
 * Guard client-side do write gate nos botões de criação (§4/`entitlements.py`).
 * O usuário free não deve preencher um formulário inteiro para só então ser
 * bloqueado: ao clicar em "Novo X" o modal de upgrade abre na hora. O guard
 * espelha o backend usando `read_only_modules` do payload de `GET /access` —
 * quando o módulo do botão é read-only para o usuário, bloqueia; senão deixa
 * passar (ex.: `operacional` é gravável por free).
 */

type AccessShape = { access: string; read_only_modules: string[] }

const FREE_READ_ONLY = ['captar', 'gestao']

const Probe: React.FC<{ module: WriteGateModule }> = ({ module }) => {
  const canWrite = useWriteGate(module)
  const [result, setResult] = useState<'allowed' | 'blocked' | null>(null)
  const run = useCallback(() => setResult(canWrite() ? 'allowed' : 'blocked'), [canWrite])
  return (
    <>
      <button onClick={run}>guard</button>
      <span data-testid="result">{result ?? 'idle'}</span>
    </>
  )
}

const renderProbe = (module: WriteGateModule) =>
  render(
    <MemoryRouter>
      <UpgradeProvider>
        <Probe module={module} />
        <div>app</div>
      </UpgradeProvider>
    </MemoryRouter>,
  )

const setAccess = (data: AccessShape | undefined) =>
  mockUseAccess.mockReturnValue({ data })

describe('useWriteGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAccess(undefined)
  })

  it('bloqueia e abre o modal quando o módulo é read-only para o usuário', async () => {
    setAccess({ access: 'free', read_only_modules: FREE_READ_ONLY })
    renderProbe('captar')

    act(() => screen.getByRole('button', { name: 'guard' }).click())

    expect(screen.getByTestId('result')).toHaveTextContent('blocked')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('não bloqueia usuário com acesso pleno (sem módulo read-only)', () => {
    setAccess({ access: 'active', read_only_modules: [] })
    renderProbe('captar')

    act(() => screen.getByRole('button', { name: 'guard' }).click())

    expect(screen.getByTestId('result')).toHaveTextContent('allowed')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('não bloqueia um módulo gravável por free (ex.: operacional)', () => {
    setAccess({ access: 'free', read_only_modules: FREE_READ_ONLY })
    renderProbe('operacional')

    act(() => screen.getByRole('button', { name: 'guard' }).click())

    expect(screen.getByTestId('result')).toHaveTextContent('allowed')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('acesso indefinido (carga/falha) não bloqueia — o backend/interceptor reassume', () => {
    renderProbe('captar')

    act(() => screen.getByRole('button', { name: 'guard' }).click())

    expect(screen.getByTestId('result')).toHaveTextContent('allowed')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})