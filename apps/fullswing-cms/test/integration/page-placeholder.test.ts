import assert from 'node:assert/strict';
import test from 'node:test';
import type { PageContent } from '../../src/content/domain/content-entry.js';
import { registerPageRoutes } from '../../src/server/routes/pages.js';
import { createApp } from '../../src/server/create-app.js';
import { registerRequestGuards } from '../../src/server/request-guards.js';
import { FakeAdminAllowlist, FakeContentStorageProvider, FakeSessionStore, testAdministrator } from '../support/fakes.js';

async function createPageApp() {
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'page-session', identity: testAdministrator, tokenCacheReference: 'cache', csrfToken: 'csrf-page',
    createdAt: Date.now(), expiresAt: Date.now() + 60_000,
  });
  const provider = new FakeContentStorageProvider();
  provider.seed({
    id: 'page-one', kind: 'page', version: 'page-version',
    metadata: {
      route: '/page/landing', title: 'Landing page', author: 'Alice', date: '2026-01-02',
      dateValue: new Date('2026-01-02T00:00:00.000Z'), categories: ['Pages'],
    },
  } satisfies PageContent);
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions, allowlist: new FakeAdminAllowlist() });
  registerPageRoutes(app, { resolveContentProvider: async () => provider });
  await app.ready();
  return { app, cookie: `fullswing_cms_session=${encodeURIComponent(app.signCookie('page-session'))}` };
}

test('page listing and placeholder require an administrator and expose no HTML authoring controls', async () => {
  const { app, cookie } = await createPageApp();
  const anonymous = await app.inject({ method: 'GET', url: '/pages' });
  const listing = await app.inject({ method: 'GET', url: '/pages', headers: { cookie } });
  const placeholder = await app.inject({ method: 'GET', url: '/pages/page-one', headers: { cookie } });
  await app.close();

  assert.equal(anonymous.statusCode, 302);
  assert.equal(listing.statusCode, 200);
  assert.match(listing.body, /Landing page/);
  assert.equal(placeholder.statusCode, 200);
  assert.match(placeholder.body, /HTML authoring is not available/);
  assert.doesNotMatch(placeholder.body, /<textarea|name="html"|Save page|<script/);
});