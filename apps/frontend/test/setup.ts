import '@testing-library/jest-dom'

// jsdom não implementa IntersectionObserver, ResizeObserver, EventSource nem
// PointerEvent. Mocks globais: FadeIn (IO), Carousel (RO), hooks de SSE (ES) e
// PointerEvent (o Checkbox base-ui constrói `new PointerEvent('click', …)` ao
// confirmar a marcação; sem o construtor o clique em um checkbox estoura).
const globalAny = globalThis as any

globalAny.PointerEvent = class PointerEvent extends globalThis.MouseEvent {}

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
