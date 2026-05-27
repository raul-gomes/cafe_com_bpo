import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalNosAjude } from '../src/components/panel/ModalNosAjude'

describe('ModalNosAjude', () => {
  it('renders PIX key and donation options when open', () => {
    render(<ModalNosAjude isOpen={true} onClose={vi.fn()} />)

    // PIX appears both in the label and the select option
    const pixElements = screen.getAllByText('PIX')
    expect(pixElements.length).toBeGreaterThanOrEqual(2)
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

    // Click the overlay (backdrop)
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
  })

  it('shows quick donation amount buttons', () => {
    render(<ModalNosAjude isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('R$ 10')).toBeInTheDocument()
    expect(screen.getByText('R$ 25')).toBeInTheDocument()
    expect(screen.getByText('R$ 50')).toBeInTheDocument()
    expect(screen.getByText('R$ 100')).toBeInTheDocument()
  })
})
