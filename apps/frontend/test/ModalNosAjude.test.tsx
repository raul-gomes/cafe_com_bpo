import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalNosAjude } from '../src/components/panel/ModalNosAjude'

// PIX_KEY vem do env — mocka para um valor estável nos testes
vi.mock('../src/config/env', () => ({
  PIX_KEY: 'cafe@cafecombpo.com.br',
}))

describe('ModalNosAjude', () => {
  it('renders PIX key and donation options when open', () => {
    render(<ModalNosAjude isOpen={true} onClose={vi.fn()} />)

    expect(screen.getAllByText('PIX').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/cafe@cafecombpo.com.br/)).toBeInTheDocument()
    expect(screen.getByText(/Ajude o Café com BPO/)).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<ModalNosAjude isOpen={false} onClose={vi.fn()} />)

    expect(screen.queryByText('PIX')).not.toBeInTheDocument()
  })

  it('closes when clicking the backdrop/overlay', () => {
    const onClose = vi.fn()
    render(<ModalNosAjude isOpen={true} onClose={onClose} />)

    const overlay = document.querySelector('.modal-overlay')
    expect(overlay).toBeInTheDocument()
    if (overlay) fireEvent.click(overlay)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when clicking the X button', () => {
    const onClose = vi.fn()
    render(<ModalNosAjude isOpen={true} onClose={onClose} />)

    const closeBtn = screen.getByLabelText('Fechar')
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('copies PIX key to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(<ModalNosAjude isOpen={true} onClose={vi.fn()} />)

    const copyBtn = screen.getByText('Copiar')
    fireEvent.click(copyBtn)

    expect(writeText).toHaveBeenCalledWith('cafe@cafecombpo.com.br')
    expect(screen.getByText('Copiado!')).toBeInTheDocument()
  })
})
