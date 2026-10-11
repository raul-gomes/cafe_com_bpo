/**
 * SEO das páginas públicas: título, descrição, endereço canônico e cartões de
 * compartilhamento (Open Graph / Twitter) por rota.
 *
 * O site é uma SPA: o Google executa o JavaScript e lê estas tags; já robôs que
 * não executam JS (prévia de link do WhatsApp/LinkedIn) leem só o index.html,
 * que traz as tags padrão da página inicial.
 */
import { useEffect } from 'react';

/** Endereço oficial do site (sem barra no fim). Ajustável por VITE_SITE_URL no build. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://cafecombpo.cloud').replace(/\/$/, '');
export const SITE_NAME = 'Café com BPO';
const DEFAULT_IMAGE = `${SITE_URL}/brand/og-cafe-com-bpo.png`;

interface PageMeta {
  /** Título da aba e do resultado no Google (o nome do site é acrescentado). */
  title: string;
  /** Resumo de 140 a 160 caracteres mostrado no Google. */
  description: string;
  /** Caminho da página (ex.: "/precificacao"), para o endereço canônico. */
  path: string;
  /** Páginas que não devem aparecer no Google (login, propostas privadas). */
  noindex?: boolean;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

/** Aplica as tags da página enquanto ela estiver aberta. */
export function usePageMeta({ title, description, path, noindex = false }: PageMeta): void {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? title : `${title} · ${SITE_NAME}`;
    const url = `${SITE_URL}${path === '/' ? '/' : path}`;
    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setCanonical(url);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', DEFAULT_IMAGE);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
  }, [title, description, path, noindex]);
}
