import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { MemberLink } from '../src/components/network/MemberLink'

function renderInRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/painel/forum']}>
      <Routes>
        <Route path="/painel/forum" element={ui} />
        <Route path="/painel/membros/:userId" element={<div>perfil do membro</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('MemberLink', () => {
  it('vira um link para o perfil do membro usando o nome', () => {
    renderInRouter(<MemberLink memberId="user-2" name="Marina Souza" />)

    expect(screen.getByRole('link', { name: 'Marina Souza' })).toHaveAttribute(
      'href',
      '/painel/membros/user-2'
    )
  })

  it('usa o email como fallback quando nao ha nome', () => {
    renderInRouter(<MemberLink memberId="user-3" name={null} email="bruno@cafe.com" />)

    expect(screen.getByRole('link', { name: 'bruno@cafe.com' })).toBeInTheDocument()
  })

  it('renderiza apenas texto quando nao ha membro para onde navegar', () => {
    renderInRouter(<MemberLink memberId={null} name="Sem perfil" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Sem perfil')).toBeInTheDocument()
  })

  it('o clique navega para o perfil', () => {
    renderInRouter(<MemberLink memberId="user-2" name="Marina Souza" />)

    fireEvent.click(screen.getByRole('link', { name: 'Marina Souza' }))

    expect(screen.getByText('perfil do membro')).toBeInTheDocument()
  })

  it('nao propaga o clique do link para o card quando stopPropagation e true', () => {
    const onCardClick = vi.fn()
    renderInRouter(
      <div onClick={onCardClick}>
        <MemberLink memberId="user-2" name="Marina Souza" />
      </div>
    )

    fireEvent.click(screen.getByRole('link', { name: 'Marina Souza' }))

    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('propaga o clique quando stopPropagation e false', () => {
    const onCardClick = vi.fn()
    renderInRouter(
      <div onClick={onCardClick}>
        <MemberLink memberId="user-2" name="Marina Souza" stopPropagation={false} />
      </div>
    )

    fireEvent.click(screen.getByRole('link', { name: 'Marina Souza' }))

    expect(onCardClick).toHaveBeenCalledTimes(1)
  })

  it('aceita className para manter o estilo do contexto', () => {
    renderInRouter(
      <MemberLink memberId="user-2" name="Marina Souza" className="text-[14px] font-bold" />
    )

    expect(screen.getByRole('link', { name: 'Marina Souza' })).toHaveClass(
      'text-[14px]',
      'font-bold'
    )
  })
})
