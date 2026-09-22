import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PricingCalculatorLayout } from '../src/components/pricing/PricingCalculatorLayout'

vi.mock('../src/api/clients', () => ({
  getClients: vi.fn().mockResolvedValue([]),
  createClient: vi.fn().mockResolvedValue({ id: 'c1', name: 'Novo' }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('../src/lib/useGeneratePDF', () => ({
  useGeneratePDF: () => ({ generate: vi.fn(), isGenerating: false, error: null }),
}))

import { getClients } from '../src/api/clients'

describe('PricingCalculatorLayout — vínculo com Prospecto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getClients as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  // Espelha o OrcamentoNovoPage: o prospectId escolhido volta como prop
  const RenderWithProspectState = ({
    onSave,
    onProspectChange,
  }: {
    onSave: (data: unknown, clientName: string) => void
    onProspectChange: (prospectId: string | null) => void
  }) => {
    const [prospectId, setProspectId] = useState<string | null>(null)
    return (
      <MemoryRouter>
        <PricingCalculatorLayout
          saveButtonLabel="Criar Orçamento"
          onSave={(data, name) => onSave(data, name)}
          prospectId={prospectId}
          onProspectChange={id => {
            setProspectId(id)
            onProspectChange(id)
          }}
          prospects={[{ id: 'p1', name: 'Prospecto XPTO', email: 'xpto@empresa.com' }]}
        />
      </MemoryRouter>
    )
  }

  const renderCalculator = () => {
    const onSave = vi.fn()
    const onProspectChange = vi.fn()
    render(<RenderWithProspectState onSave={onSave} onProspectChange={onProspectChange} />)
    return { onSave, onProspectChange }
  }

  it('mostra "Empresa não encontrada" para nome que não é cliente nem prospecto', async () => {
    renderCalculator()
    const user = userEvent.setup()

    const nameInput = screen.getByPlaceholderText('Busque ou digite o nome do cliente...')
    await user.type(nameInput, 'Empresa Inexistente')

    expect(await screen.findByText(/Empresa não encontrada/)).toBeInTheDocument()
  })

  it('vincular um prospecto não mostra erro, habilita salvar e envia pela nova lógica', async () => {
    const { onSave, onProspectChange } = renderCalculator()
    const user = userEvent.setup()

    const serviceCheckbox = screen.getAllByRole('checkbox')[0]
    await user.click(serviceCheckbox)

    const prospectSelect = screen
      .getAllByRole('combobox')
      .find(el => Array.from((el as HTMLSelectElement).options).some(o => o.textContent === 'Prospecto XPTO'))! as HTMLSelectElement
    await user.selectOptions(prospectSelect, 'p1')

    await waitFor(() => expect(onProspectChange).toHaveBeenCalledWith('p1'))
    expect(screen.queryByText(/Empresa não encontrada/)).not.toBeInTheDocument()

    const saveBtn = screen.getByRole('button', { name: 'Criar Orçamento' })
    expect(saveBtn).toBeEnabled()

    await user.click(saveBtn)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][1]).toBe('Prospecto XPTO')
  })
})