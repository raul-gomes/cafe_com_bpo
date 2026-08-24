import '@testing-library/jest-dom'

// jsdom não implementa IntersectionObserver, ResizeObserver nem EventSource.
// Mocks globais: FadeIn (IO), Carousel (RO) e hooks de SSE (ES).
const globalAny = globalThis as any

globalAny.IntersectionObserver = class {
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

globalAny.ResizeObserver = class {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalAny.EventSource = class {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  readyState = 0
  onopen: ((ev: unknown) => void) | null = null
  onmessage: ((ev: unknown) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  constructor(public url: string | URL) {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false
  }
  close() {
    this.readyState = 2
  }
}
