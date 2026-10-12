/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chave PIX exibida nos modais de doação (definida em build-time). */
  readonly VITE_PIX_KEY?: string;
  /** Receiver name and city in the PIX QR Code (BR Code). */
  readonly VITE_PIX_MERCHANT_NAME?: string;
  readonly VITE_PIX_MERCHANT_CITY?: string;
  /** Official site address (SEO: canonical, sitemap, share cards). */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
