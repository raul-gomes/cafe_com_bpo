import '@testing-library/jest-dom'

// Mock IntersectionObserver for testing components that use it (like FadeIn)
if (typeof globalThis !== 'undefined') {
  (globalThis as any).IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() { return [] }
    unobserve() {}
  }
}
