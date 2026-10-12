/**
 * Where to go back after signing in (AUD-039).
 *
 * The destination travels in `?return_to=` and is only honoured when it is a
 * path of this app: an absolute URL, a protocol-relative `//host`, a `/\host`
 * (browsers read it as `//host`) or a `javascript:` value would turn the login
 * into an open redirect. The login and auth callback pages are refused too, so
 * signing in never loops back to the login.
 */

const PLACEHOLDER_ORIGIN = 'https://app.invalid';

/**
 * Validates a `return_to` value.
 *
 * @param raw The decoded query value.
 * @returns The internal path with its query and hash, or null when unsafe.
 */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  if (url.pathname === '/login' || url.pathname.startsWith('/auth/')) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Login path that brings the person back to where they are.
 *
 * @param location Current pathname, search and hash.
 * @param extra Extra query flags (e.g. `session_expired=true`).
 * @returns The login path.
 */
export function loginPathFor(
  location: { pathname: string; search: string; hash: string },
  extra?: Record<string, string>
): string {
  const params = new URLSearchParams(extra);
  params.set('return_to', `${location.pathname}${location.search}${location.hash}`);
  return `/login?${params.toString()}`;
}
