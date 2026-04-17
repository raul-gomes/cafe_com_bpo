import '@testing-library/jest-dom'

// Mock IntersectionObserver for testing components that use it (like FadeIn)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() { return [] }
  unobserve() {}
} as any
