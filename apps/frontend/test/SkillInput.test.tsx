import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SkillInput } from '../src/components/ui/SkillInput'
import type { Skill } from '../src/api/network'

const mockSearchSkills = vi.hoisted(() => vi.fn())

vi.mock('../src/api/network', () => ({
  searchSkills: mockSearchSkills,
}))

const CATALOG: Skill[] = [
  { id: '1', name: 'Análise de Dados', slug: 'analise-de-dados', is_active: true },
  { id: '2', name: 'Excel Avançado', slug: 'excel-avancado', is_active: true },
  { id: '3', name: 'Conciliação Bancária', slug: 'conciliacao-bancaria', is_active: true },
]

const PYTHON: Skill = { id: '4', name: 'Python', slug: 'python', is_active: true }

describe('SkillInput - autocomplete do catálogo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchSkills.mockReset()
    mockSearchSkills.mockResolvedValue([])
  })

  it('mostra sugestões do catálogo enquanto digita', async () => {
    mockSearchSkills.mockResolvedValue([CATALOG[0]])
    render(<SkillInput value={[]} onChange={() => {}} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'aná' } })

    await waitFor(() => {
      expect(screen.getByText('Análise de Dados')).toBeInTheDocument()
    })
    expect(mockSearchSkills).toHaveBeenCalledWith('aná')
  })

  it('adiciona habilidade ao clicar na sugestão', async () => {
    mockSearchSkills.mockResolvedValue(CATALOG)
    const onChange = vi.fn()
    render(<SkillInput value={[]} onChange={onChange} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ex' } })

    await waitFor(() => {
      expect(screen.getByText('Excel Avançado')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Excel Avançado'))
    expect(onChange).toHaveBeenCalledWith(['Excel Avançado'])
  })

  it('Enter seleciona a sugestão completa (py → Python), não o texto digitado', async () => {
    mockSearchSkills.mockResolvedValue([PYTHON])
    const onChange = vi.fn()
    render(<SkillInput value={[]} onChange={onChange} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'py' } })

    await waitFor(() => {
      expect(screen.getByText('Python')).toBeInTheDocument()
    })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['Python'])
  })

  it('setas navegam e Enter confirma a sugestão destacada', async () => {
    mockSearchSkills.mockResolvedValue(CATALOG)
    const onChange = vi.fn()
    render(<SkillInput value={[]} onChange={onChange} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a' } })

    await waitFor(() => {
      expect(screen.getByText('Excel Avançado')).toBeInTheDocument()
    })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['Excel Avançado'])
  })

  it('mostra habilidade já adicionada como inativa e impede re-adicionar', async () => {
    mockSearchSkills.mockResolvedValue(CATALOG)
    const onChange = vi.fn()
    render(<SkillInput value={['Excel Avançado']} onChange={onChange} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'e' } })

    await waitFor(() => {
      expect(screen.getByText('Análise de Dados')).toBeInTheDocument()
    })

    const excelButton = screen.getByRole('button', { name: 'Excel Avançado' })
    expect(excelButton).toBeDisabled()
    fireEvent.click(excelButton)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('bloqueia adicionar via Enter habilidade que já existe e exibe aviso', async () => {
    mockSearchSkills.mockResolvedValue([PYTHON])
    const onChange = vi.fn()
    render(<SkillInput value={['Python']} onChange={onChange} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'py' } })

    await waitFor(() => {
      expect(screen.getByText(/adicionada/)).toBeInTheDocument()
    })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Esta habilidade já foi adicionada.')).toBeInTheDocument()
  })

  it('adiciona habilidade ao pressionar Enter sem sugestões correspondentes', async () => {
    const onChange = vi.fn()
    render(<SkillInput value={[]} onChange={onChange} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Nova Skill' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['Nova Skill'])
  })

  it('limpa o catálogo de sugestões quando o input esvazia', async () => {
    mockSearchSkills.mockResolvedValue(CATALOG)
    render(<SkillInput value={[]} onChange={() => {}} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'con' } })

    await waitFor(() => {
      expect(screen.getByText('Conciliação Bancária')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: '' } })
    await waitFor(() => {
      expect(screen.queryByText('Conciliação Bancária')).not.toBeInTheDocument()
    })
  })
})