import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { BetaSignupForm } from '../src/components/home/BetaSignupForm'

vi.mock('../src/api/beta', () => ({
  createBetaSignup: vi.fn(),
}))

import { createBetaSignup } from '../src/api/beta'

const create = createBetaSignup as ReturnType<typeof vi.fn>

function fillForm(): void {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Operadora' } })
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@cafe.com' } })
  fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: '(11) 98765-4321' } })
  fireEvent.change(screen.getByLabelText('Como você atua hoje'), { target: { value: 'growing' } })
  fireEvent.click(screen.getByRole('radio', { name: '6 a 15' }))
}

const submitButton = () => screen.getByRole('button', { name: /Quero ser Beta/ })

describe('BetaSignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    create.mockResolvedValue({ message: 'ok' })
  })

  it('only enables sending after LGPD consent', () => {
    render(<BetaSignupForm />)
    fillForm()
    expect(submitButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(submitButton()).toBeEnabled()
  })

  it('sends the data with source "home" and says thanks', async () => {
    render(<BetaSignupForm />)
    fillForm()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(submitButton())

    expect(await screen.findByText('Inscrição recebida.')).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ana Operadora',
        email: 'ana@cafe.com',
        profile: 'growing',
        client_range: '6-15',
        source: 'home',
        lgpd_consent: true,
        website: undefined,
      })
    )
  })

  it('warns when there are too many attempts (server rate limit)', async () => {
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
    fillForm()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(submitButton())

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Muitas tentativas'))
  })
})
