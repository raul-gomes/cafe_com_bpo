import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BillingProfileForm } from '../src/components/payments/BillingProfileForm'

// AUD-014: the field starts as CPF; typing a CNPJ digit by digit must not stop
// at the CPF length (the browser enforces maxLength while the person types).
describe('billing CPF/CNPJ field', () => {
  const renderForm = () =>
    render(<BillingProfileForm profile={null} isLoading={false} isSaving={false} onSave={vi.fn()} />)

  it('accepts a full CNPJ typed one digit at a time', async () => {
    renderForm()
    const user = userEvent.setup()
    const field = screen.getByLabelText('CPF/CNPJ *')

    await user.type(field, '12345678000195')

    expect(field).toHaveValue('12.345.678/0001-95')
  })

  it('still formats a CPF', async () => {
    renderForm()
    const user = userEvent.setup()
    const field = screen.getByLabelText('CPF/CNPJ *')

    await user.type(field, '12345678909')

    expect(field).toHaveValue('123.456.789-09')
  })
})
