import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RichText } from '../src/components/ui/RichText'

/**
 * The forum renders rich text that comes from the API. `dangerouslySetInnerHTML`
 * was the sink, which AGENTS.md §1 forbids for API data; the server sanitizes
 * with bleach, but the browser must not be the last line of defence.
 *
 * These tests pin the client-side contract: allowed tags survive as React
 * elements, everything else degrades to text, and nothing executable reaches the
 * DOM.
 */

describe('RichText', () => {
  it('renders plain text as a text node', () => {
    const { container } = render(<RichText html="Dúvida sobre custos." />)

    expect(container.textContent).toContain('Dúvida sobre custos.')
  })

  it('keeps the formatting the forum relies on', () => {
    const { container } = render(
      <RichText html="<p>Forte <strong>negrito</strong> e <em>itálico</em></p><ul><li>item</li></ul>" />
    )

    expect(container.querySelector('strong')?.textContent).toBe('negrito')
    expect(container.querySelector('em')?.textContent).toBe('itálico')
    expect(container.querySelector('li')?.textContent).toBe('item')
  })

  it('renders a safe link with noopener and a blank target', () => {
    render(<RichText html='<a href="https://example.com">site</a>' />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('drops a javascript: link but keeps its text', () => {
    const { container } = render(
      <RichText html='<a href="javascript:alert(1)">clique</a>' />
    )

    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('clique')
  })

  it('drops a data: link', () => {
    const { container } = render(
      <RichText html='<a href="data:text/html,<script>alert(1)</script>">clique</a>' />
    )

    expect(container.querySelector('a')).toBeNull()
  })

  it('never emits a script element', () => {
    const { container } = render(
      <RichText html="<script>alert(1)</script><p>texto</p>" />
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('texto')
  })

  it('never emits inline event handlers', () => {
    const { container } = render(
      <RichText html='<span onmouseover="alert(1)">passa o mouse</span>' />
    )

    const span = container.querySelector('span')
    expect(span?.getAttribute('onmouseover')).toBeNull()
    expect(container.innerHTML).not.toContain('alert(1)')
  })

  it('drops style attributes (CSS injection vector)', () => {
    const { container } = render(
      <RichText html='<p style="position:fixed;inset:0">soube</p>' />
    )

    expect(container.querySelector('p')?.getAttribute('style')).toBeNull()
    expect(container.textContent).toContain('soube')
  })

  it('unwraps tags outside the allowlist instead of dropping their text', () => {
    const { container } = render(
      <RichText html="<iframe src='https://evil.example'>texto interno</iframe>" />
    )

    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toContain('texto interno')
  })

  it('renders the headings used by the legal documents', () => {
    const { container } = render(<RichText html="<h1>Termos</h1><h2>Seção</h2>" />)

    expect(container.querySelector('h1')?.textContent).toBe('Termos')
    expect(container.querySelector('h2')?.textContent).toBe('Seção')
  })

  it('survives malformed markup without throwing', () => {
    expect(() =>
      render(<RichText html="<p>aberto <strong>sem fechar" />)
    ).not.toThrow()
  })

  it('handles an empty string', () => {
    const { container } = render(<RichText html="" />)

    expect(container.textContent).toBe('')
  })
})