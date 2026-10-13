/**
 * SEO of the public pages: title, description, canonical address and share
 * cards (Open Graph / Twitter) per route.
 *
 * The site is an SPA: Google runs the JavaScript and reads these tags; bots
 * that do not run JS (WhatsApp/LinkedIn link previews) only read index.html,
 * which carries the landing page defaults.
 */
import { useEffect } from 'react';

/** Official site address (no trailing slash). Set VITE_SITE_URL at build time to change it. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://cafecombpo.cloud').replace(/\/$/, '');
export const SITE_NAME = 'Café com BPO';
const DEFAULT_IMAGE = `${SITE_URL}/brand/og-cafe-com-bpo.png`;

interface PageMeta {
  /** Tab and Google result title (the site name is appended). */
  title: string;
  /** 140 to 160 character summary shown on Google. */
  description: string;
  /** Page path (e.g. "/precificacao"), for the canonical address. */
  path: string;
  /** Pages that must stay out of Google (login, private proposals). */
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

/**
 * Applies the page tags while it is open.
 *
 * @param meta Page metadata.
 */
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
