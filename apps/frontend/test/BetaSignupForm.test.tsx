import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { BetaSignupForm } from '../src/components/home/BetaSignupForm'

vi.mock('../src/api/beta', () => ({
  createBetaSignup: vi.fn(),
}))

import { createBetaSignup } from '../src/api/beta'

const create = createBetaSignup as ReturnType<typeof vi.fn>

function preencher() {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Operadora' } })
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@cafe.com' } })
  fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: '(11) 98765-4321' } })
  fireEvent.change(screen.getByLabelText('Como você atua hoje'), { target: { value: 'crescendo' } })
  fireEvent.click(screen.getByRole('radio', { name: '6 a 15' }))
}

const enviar = () => screen.getByRole('button', { name: /Quero ser Beta/ })

describe('BetaSignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    create.mockResolvedValue({ message: 'ok' })
  })

  it('só libera o envio com o aceite da LGPD', () => {
    render(<BetaSignupForm />)
    preencher()
    expect(enviar()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(enviar()).toBeEnabled()
  })

  it('envia os dados com origem "home" e agradece', async () => {
    render(<BetaSignupForm />)
    preencher()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(enviar())

    expect(await screen.findByText('Inscrição recebida.')).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Ana Operadora',
        email: 'ana@cafe.com',
        perfil: 'crescendo',
        faixa_clientes: '6-15',
        origem: 'home',
        consentimento_lgpd: true,
        website: undefined,
      })
    )
  })

  it('avisa quando há tentativas demais (limite do servidor)', async () => {
    create.mockRejectedValue(
      new AxiosError('limite', 'ERR', undefined, undefined, {
        status: 429,
        statusText: 'Too Many Requests',
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      })
    )
    render(<BetaSignupForm />)
    preencher()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(enviar())

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Muitas tentativas'))
  })
})
