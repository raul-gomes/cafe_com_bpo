import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouterProvider } from 'react-router-dom'
import { buildRouter } from '../src/router'
import { AuthProvider } from '../src/context/AuthContext'

describe('Router', () => {
  it('renders_home_route', () => {
    window.history.pushState({}, 'Test page', '/')
    const router = buildRouter()
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    )
    
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })

  it('renders_login_route', () => {
    window.history.pushState({}, 'Test page', '/login')
    const router = buildRouter()
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    )
    
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('renders_not_found_for_unknown_route', () => {
    window.history.pushState({}, 'Test page', '/unknown-random-route')
    const router = buildRouter()
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    )
    
    expect(screen.getByTestId('not-found')).toBeInTheDocument()
  })
})
