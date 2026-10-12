import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { UnderConstructionPanelPage } from '../src/pages/panel/UnderConstructionPanelPage'

// AUD-040 (owner decision 2026-10-12): each unfinished module says what it will
// be and how to do the job today, instead of one generic message.
describe('UnderConstructionPanelPage', () => {
  it.each([
    ['notas-fiscais', 'Notas Fiscais', '/painel/templates-atividades'],
    ['certificados', 'Certificados Digitais', '/painel/templates-atividades'],
    ['equipes', 'Gestão de equipes', '/painel/empresas'],
  ] as const)('%s has its own title and a path that works today', (area, title, path) => {
    render(
      <MemoryRouter>
        <UnderConstructionPanelPage area={area} />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByText('Em construção')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /.+/ })).toHaveAttribute('href', path)
  })
})
