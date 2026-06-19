import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouterProvider } from 'react-router-dom'
import { buildRouter } from '../src/router'
import { AuthProvider } from '../src/context/AuthContext'

describe('Router', () => {
  it('renders_home_route', async () => {
    window.history.pushState({}, 'Test page', '/')
    const router = await buildRouter()
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })

  it('renders_login_route', async () => {
    window.history.pushState({}, 'Test page', '/login')
    const router = await buildRouter()
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  it('renders_not_found_for_unknown_route', async () => {
    window.history.pushState({}, 'Test page', '/unknown-random-route')
    const router = await buildRouter()
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('not-found')).toBeInTheDocument()
    })
  })
})
