import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModalReportarErro } from '../src/components/panel/ModalReportarErro'
import { renderWithProviders } from './test-utils'

vi.mock('../src/api/client', () => ({
  apiClient: { post: vi.fn() },
}))

import { apiClient } from '../src/api/client'

const post = apiClient.post as ReturnType<typeof vi.fn>

function fillValidForm(): void {
  fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Tela travou' } })
  fireEvent.change(screen.getByLabelText(/Descrição/), {
    target: { value: 'Ao salvar o contrato a tela ficou carregando.' },
  })
}

describe('ModalReportarErro — error screenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    post.mockResolvedValue({ data: { message: 'ok' } })
    // jsdom does not implement object URLs (used by the screenshot preview).
    URL.createObjectURL = vi.fn(() => 'blob:previa')
    URL.revokeObjectURL = vi.fn()
  })

  it('sends the report as a multipart form, without screenshot when none is attached', async () => {
    const onClose = vi.fn()
    renderWithProviders(<ModalReportarErro isOpen onClose={onClose} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relato' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [url, body] = post.mock.calls[0]
    expect(url).toBe('/feedback/')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('title')).toBe('Tela travou')
    expect((body as FormData).get('screenshot')).toBeNull()
  })

  it('attaches the chosen screenshot, previews it and sends it along', async () => {
    renderWithProviders(<ModalReportarErro isOpen onClose={vi.fn()} />)
    fillValidForm()
    const print = new File([new Uint8Array([137, 80, 78, 71])], 'erro.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Escolher arquivo do print'), { target: { files: [print] } })

    expect(await screen.findByAltText('Prévia do print anexado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relato' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect((post.mock.calls[0][1] as FormData).get('screenshot')).toBe(print)
  })

  it('rejects a file that is not an image', () => {
    renderWithProviders(<ModalReportarErro isOpen onClose={vi.fn()} />)
    const pdf = new File(['%PDF'], 'relatorio.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Escolher arquivo do print'), { target: { files: [pdf] } })

    expect(screen.getByRole('alert')).toHaveTextContent('PNG, JPG ou WEBP')
    expect(screen.queryByAltText('Prévia do print anexado')).not.toBeInTheDocument()
  })

  it('accepts a screenshot pasted with Ctrl+V', async () => {
    renderWithProviders(<ModalReportarErro isOpen onClose={vi.fn()} />)
    const pasted = new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' })
    fireEvent.paste(screen.getByRole('dialog'), { clipboardData: { files: [pasted] } })

    expect(await screen.findByAltText('Prévia do print anexado')).toBeInTheDocument()
  })
})
