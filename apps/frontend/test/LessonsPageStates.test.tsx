import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { LessonsPage } from '../src/pages/panel/LessonsPage'

/*
 * AUD-043: the page only read `data`, so a failed /lessons fell back to the
 * planned "Em breve" list as if it were the content, with no error or retry.
 */

const platformApi = vi.hoisted(() => ({ listLessons: vi.fn() }))

vi.mock('../src/api/platform', () => platformApi)

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'user' } }),
}))

const LESSON = {
  id: 'l1',
  section: 'primeiros-passos',
  title: 'Aula publicada no Admin',
  summary: 'Resumo.',
  youtube_id: null,
  position: 0,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LessonsPage section="primeiros-passos" />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LessonsPage — carregando, erro e conteúdo (AUD-043)', () => {
  beforeEach(() => {
    platformApi.listLessons.mockReset()
  })

  it('enquanto carrega, avisa em vez de mostrar a lista planejada', () => {
    platformApi.listLessons.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent(/Carregando aulas/i)
    expect(screen.queryByText('Conhecendo o painel e os módulos')).not.toBeInTheDocument()
  })

  it('se falhar, mostra o erro e tenta de novo', async () => {
    platformApi.listLessons.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([LESSON])
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível carregar as aulas/i)
    expect(screen.queryByText('Conhecendo o painel e os módulos')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/i }))

    expect(await screen.findByText('Aula publicada no Admin')).toBeInTheDocument()
  })

  it('sem aulas publicadas na seção, mostra a lista planejada', async () => {
    platformApi.listLessons.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Conhecendo o painel e os módulos')).toBeInTheDocument()
  })
})
