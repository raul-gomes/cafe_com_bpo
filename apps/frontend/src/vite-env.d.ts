/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chave PIX exibida nos modais de doação (definida em build-time). */
  readonly VITE_PIX_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
