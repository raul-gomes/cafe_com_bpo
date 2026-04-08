import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouterProvider } from 'react-router-dom'
import { buildRouter } from '../src/router'

describe('Router', () => {
  it('renders_home_route', () => {
    // Setting memory router or using initial entries
    // Since buildRouter creates a browser router, we mock the history or create an in-memory one.
    // For simplicity in Phase 0 testing, we can use window.history.pushState.
    window.history.pushState({}, 'Test page', '/')
    const router = buildRouter()
    render(<RouterProvider router={router} />)
    
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })

  it('renders_login_route', () => {
    window.history.pushState({}, 'Test page', '/login')
    const router = buildRouter()
    render(<RouterProvider router={router} />)
    
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('renders_not_found_for_unknown_route', () => {
    window.history.pushState({}, 'Test page', '/unknown-random-route')
    const router = buildRouter()
    render(<RouterProvider router={router} />)
    
    expect(screen.getByTestId('not-found')).toBeInTheDocument()
  })
})
