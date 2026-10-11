import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = join(__dirname, '..', 'src', 'pages', 'panel', 'DesignSystemPage.tsx');

/**
 * Why this test exists
 *
 * The design system page renders the real components, and the ones that fetch on
 * mount use the fixture id in the request path. The API types those path params as
 * UUID, so a fixture like `demo-apps-1` answered 422 twice per mount:
 *
 *   GET  /api/network/projects/demo-apps-1/applications  -> 422
 *   POST /api/notifications/mark-read                     -> 422
 *
 * The page looked fine (the panel shows its own error state) while the console
 * filled with validation errors that had nothing to do with the component being
 * showcased — which is exactly how a real bug hides there.
 *
 * The rule encoded here: `demo-*` and `user-*` are reserved for fake entities on
 * that page, and a fake entity id still has to be a UUID, because the backend
 * validates it before any business rule runs.
 */
describe('DesignSystemPage fixtures', () => {
  const source = readFileSync(PAGE_PATH, 'utf-8');

  it('has no fake entity id left that the API would reject', () => {
    const fakeIds = [...source.matchAll(/'(demo-[a-z-]*|user-\d+)'/g)].map((m) => m[1]);

    expect(fakeIds).toEqual([]);
  });

  it('uses valid UUIDs on the fixtures that reach the API', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const projectIds = [...source.matchAll(/id: '(0000[0-9a-f-]+)'/g)].map((m) => m[1]);

    expect(projectIds.length).toBeGreaterThan(0);
    expect(projectIds.every((id) => uuid.test(id))).toBe(true);
  });
});