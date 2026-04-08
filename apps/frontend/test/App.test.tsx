import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../src/App'

describe('App Root', () => {
  it('renders_app_root_without_crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeInTheDocument()
  })
})
