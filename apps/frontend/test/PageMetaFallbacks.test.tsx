import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import UnderConstructionPage from '../src/pages/UnderConstructionPage'
import NotFoundPage from '../src/pages/NotFoundPage'

/*
 * AUD-041: /em-construcao (and the 404 fallback) set no tags of their own, so
 * they kept the title, canonical and "index, follow" of the page seen before.
 */

vi.mock('../src/components/ui/Navbar', () => ({ Navbar: () => null }))

const robots = () => document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content
const canonical = () => document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href

describe('páginas sem conteúdo próprio têm metadados próprios (AUD-041)', () => {
  beforeEach(() => {
    // What a previously visited, indexable page leaves behind.
    document.head.innerHTML =
      '<meta name="robots" content="index, follow"><link rel="canonical" href="https://cafecombpo.cloud/precificacao">'
    document.title = 'Precificação · Café com BPO'
  })

  it('em construção: título próprio e fora do Google', () => {
    render(
      <MemoryRouter>
        <UnderConstructionPage />
      </MemoryRouter>
    )

    expect(document.title).toBe('Em construção · Café com BPO')
    expect(robots()).toBe('noindex, nofollow')
    expect(canonical()).toBe('https://cafecombpo.cloud/em-construcao')
  })

  it('página não encontrada: título próprio e fora do Google', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    )

    expect(screen.getByTestId('not-found')).toHaveTextContent('Página não encontrada')
    expect(document.title).toBe('Página não encontrada · Café com BPO')
    expect(robots()).toBe('noindex, nofollow')
  })
})
