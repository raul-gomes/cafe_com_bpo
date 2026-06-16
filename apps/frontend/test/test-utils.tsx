import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../src/components/ui/Toast'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

interface WrapperOptions {
  initialEntries?: string[]
}

function createWrapper(options: WrapperOptions = {}) {
  const { initialEntries = ['/'] } = options

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <ToastProvider>
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & WrapperOptions,
) {
  const { initialEntries, ...renderOptions } = options || {}
  return render(ui, { wrapper: createWrapper({ initialEntries }), ...renderOptions })
}

export { renderWithProviders, createWrapper }
