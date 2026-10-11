/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chave PIX exibida nos modais de doação (definida em build-time). */
  readonly VITE_PIX_KEY?: string;
  /** Nome do recebedor e cidade no QR Code PIX (BR Code). */
  readonly VITE_PIX_MERCHANT_NAME?: string;
  readonly VITE_PIX_MERCHANT_CITY?: string;
  /** Endereço oficial do site (SEO: canônico, sitemap, cartões de compartilhamento). */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
