import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ContractSectionsEditor } from '../src/components/contracts/ContractSectionsEditor'

const BASE = [
  { title: 'Das Partes', content: 'Contratante: Fulano.' },
  { title: 'Do Objeto', content: 'Serviços de BPO financeiro.' },
]

describe('ContractSectionsEditor', () => {
  it('renderiza títulos e conteúdos das seções', () => {
    render(<ContractSectionsEditor sections={BASE} onChange={() => {}} />)
    expect(screen.getByText('Das Partes')).toBeInTheDocument()
    expect(screen.getByText('Contratante: Fulano.')).toBeInTheDocument()
    expect(screen.getByText('Do Objeto')).toBeInTheDocument()
  })

  it('trunca conteúdos longos com reticências', () => {
    const longContent = 'x'.repeat(200)
    render(<ContractSectionsEditor sections={[{ title: 'Longa', content: longContent }]} onChange={() => {}} />)
    expect(screen.getByText(`${'x'.repeat(140)}...`)).toBeInTheDocument()
  })

  it('adiciona uma seção pelo editor inline e notifica onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContractSectionsEditor sections={BASE} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /adicionar seção/i }))
    await user.type(screen.getByTestId('contract-section-title'), 'Da Vigência')
    await user.type(screen.getByTestId('contract-section-content'), '12 meses de vigência.')
    await user.click(screen.getByRole('button', { name: /salvar seção/i }))

    expect(onChange).toHaveBeenCalledWith([
      ...BASE,
      { title: 'Da Vigência', content: '12 meses de vigência.' },
    ])
  })

  it('expande uma seção ao clicar na seta para editar inline', async () => {
    const user = userEvent.setup()
    render(<ContractSectionsEditor sections={BASE} onChange={() => {}} />)

    expect(screen.queryByTestId('section-editor-0')).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /editar seção/i })[0])
    expect(screen.getByTestId('section-editor-0')).toBeInTheDocument()
  })

  it('cancelar a edição inline não altera as seções', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContractSectionsEditor sections={BASE} onChange={onChange} />)

    await user.click(screen.getAllByRole('button', { name: /editar seção/i })[0])
    await user.clear(screen.getByTestId('contract-section-title'))
    await user.type(screen.getByTestId('contract-section-title'), 'Alteração descartada')
    await user.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Das Partes')).toBeInTheDocument()
  })

  it('salva sem criar seção com título vazio', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContractSectionsEditor sections={BASE} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /adicionar seção/i }))
    await user.type(screen.getByTestId('contract-section-content'), 'Sem título.')
    const saveBtn = screen.getByRole('button', { name: /salvar seção/i })
    expect(saveBtn).toBeDisabled()
  })

  it('edita uma seção existente', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContractSectionsEditor sections={BASE} onChange={onChange} />)

    await user.click(screen.getAllByRole('button', { name: /editar seção/i })[0])
    const titleInput = screen.getByTestId('contract-section-title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Das Partes Ajustado')
    await user.click(screen.getByRole('button', { name: /salvar seção/i }))

    expect(onChange).toHaveBeenCalledWith([
      { title: 'Das Partes Ajustado', content: 'Contratante: Fulano.' },
      BASE[1],
    ])
  })

  it('remove uma seção', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContractSectionsEditor sections={BASE} onChange={onChange} />)

    await user.click(screen.getAllByRole('button', { name: /remover seção/i })[1])
    expect(onChange).toHaveBeenCalledWith([BASE[0]])
  })

  it('em readOnly não exibe botões de gerenciamento', () => {
    render(<ContractSectionsEditor sections={BASE} readOnly />)
    expect(screen.queryByRole('button', { name: /adicionar seção/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar seção/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remover seção/i })).not.toBeInTheDocument()
  })
})