import React from 'react';

/**
 * Renders rich text (forum posts, comments, legal documents) **without** an
 * `innerHTML` sink.
 *
 * Why this exists: the forum posts come from the API, and AGENTS.md §1 forbids
 * `dangerouslySetInnerHTML` for API data — render text nodes. The server already
 * sanitizes with bleach (`BLEACH_ALLOWED_TAGS` in
 * `src/modules/network/repository.py`), but the browser must not be the last
 * line of defence: if the allowlist ever drifts, or content arrives from a path
 * that skipped sanitizing, this component still cannot execute anything.
 *
 * How it stays safe:
 * - the HTML is parsed with `DOMParser`, which produces an inert document (no
 *   script runs, no resource is fetched, nothing is attached to the live DOM);
 * - only the tags in `ALLOWED_TAGS` are recreated as React elements — any other
 *   tag is *unwrapped*, so its text survives but the element does not;
 * - attributes are dropped entirely (no `style`, no `on*` handlers, no `src`);
 * - `<a>` keeps `href` only for `http`, `https` and `mailto`, always with
 *   `rel="noopener noreferrer nofollow"` and `target="_blank"`.
 */

// Mirrors BLEACH_ALLOWED_TAGS from the backend, plus `h1` (used by the legal
// documents) and `div` (a common wrapper in stored content).
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'mark', 'small', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'ul', 'ol',
  'li', 'a', 'span', 'hr', 'div',
]);

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Decides whether a URL may be used as a link target.
 *
 * @param href Raw href coming from the parsed document.
 * @returns True when the protocol is explicitly allowed.
 */
function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value === '') return false;
  // Relative links have no protocol; they cannot execute script.
  if (!value.includes(':')) return true;
  try {
    const url = new URL(value, 'https://placeholder.invalid');
    return SAFE_PROTOCOLS.includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Converts the children of a parsed node into React nodes.
 *
 * @param nodes Child nodes of the parsed document.
 * @param keyPrefix Unique prefix so React keys stay stable across the tree.
 * @returns The React representation of those children.
 */
function renderNodes(nodes: NodeListOf<ChildNode>, keyPrefix: string): React.ReactNode[] {
  return Array.from(nodes).map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    const children = renderNodes(element.childNodes, key);

    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap: the text stays, the element (and its attributes) go away.
      return <React.Fragment key={key}>{children}</React.Fragment>;
    }

    if (tag === 'br' || tag === 'hr') {
      return React.createElement(tag, { key });
    }

    if (tag === 'a') {
      const href = element.getAttribute('href') ?? '';
      if (!isSafeHref(href)) {
        return <React.Fragment key={key}>{children}</React.Fragment>;
      }
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {children}
        </a>
      );
    }

    return React.createElement(tag, { key }, children);
  });
}

interface RichTextProps {
  /** Sanitized HTML coming from the API or from a bundled document. */
  html: string;
  /** Extra classes for the wrapper element. */
  className?: string;
}

/**
 * Renders sanitized rich text as React elements.
 *
 * @param props Component props.
 * @returns The rendered content.
 */
export const RichText: React.FC<RichTextProps> = ({ html, className }) => {
  if (!html) return null;

  let parsed: HTMLDocument;
  try {
    parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  } catch {
    // A parser failure must not blank the page: fall back to the raw text.
    return <div className={className}>{html}</div>;
  }

  return <div className={className}>{renderNodes(parsed.body.childNodes, 'rt')}</div>;
};