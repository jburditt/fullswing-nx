import assert from 'node:assert/strict';
import test from 'node:test';
import type { ParsedMetadata } from '@fullswing/content-model';
import { FakeAdminAllowlist, FakeContentStorageProvider, FakeSessionStore, testAdministrator } from '../support/fakes.js';
import { registerDashboardRoutes } from '../../src/server/routes/dashboard.js';
import { createApp } from '../../src/server/create-app.js';
import { registerRequestGuards } from '../../src/server/request-guards.js';

function blogEntry(id: string, title: string, author: string, date: string, categories: string[]) {
  const metadata: ParsedMetadata = {
    title,
    author,
    date,
    dateValue: new Date(`${date}T00:00:00.000Z`),
    categories,
  };
  return { id, kind: 'blog' as const, route: `/blog/${id}`, metadata, version: `version-${id}`, markdown: `# ${title}` };
}

async function createDashboardApp(): Promise<{
  app: ReturnType<typeof createApp>;
  cookie: string;
}> {
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'dashboard-session',
    identity: testAdministrator,
    tokenCacheReference: 'dashboard-cache',
    csrfToken: 'dashboard-csrf',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });
  const provider = new FakeContentStorageProvider();
  provider.seed(blogEntry('cms-design', 'CMS design', 'Alice Example', '2026-01-10', ['Engineering']));
  provider.seed(blogEntry('nx-migration', 'Nx migration', 'Bob Example', '2026-02-12', ['Architecture']));
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions, allowlist: new FakeAdminAllowlist() });
  registerDashboardRoutes(app, { resolveContentProvider: async () => provider });
  await app.ready();
  return { app, cookie: `fullswing_cms_session=${encodeURIComponent(app.signCookie('dashboard-session'))}` };
}

test('dashboard redirects anonymous visitors without exposing entries', async () => {
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions: new FakeSessionStore(), allowlist: new FakeAdminAllowlist() });
  registerDashboardRoutes(app, { resolveContentProvider: async () => new FakeContentStorageProvider() });
  await app.ready();

  const response = await app.inject({ method: 'GET', url: '/dashboard' });
  await app.close();

  assert.equal(response.statusCode, 302);
  assert.equal(response.body.includes('CMS design'), false);
});

test('dashboard applies and preserves active filters and offers a clear-filters action', async () => {
  const { app, cookie } = await createDashboardApp();
  const response = await app.inject({
    method: 'GET',
    url: '/dashboard?kind=blog&title=CMS&author=Alice%20Example&category=Engineering',
    headers: { cookie },
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /CMS design/);
  assert.equal(response.body.includes('Nx migration'), false);
  assert.match(response.body, /name="title" value="CMS"/);
  assert.match(response.body, /href="\/dashboard"[^>]*>Clear filters/);
});

test('dashboard renders an accessible empty-result state and pagination links', async () => {
  const { app, cookie } = await createDashboardApp();
  const empty = await app.inject({
    method: 'GET',
    url: '/dashboard?title=not-found',
    headers: { cookie },
  });
  const page = await app.inject({
    method: 'GET',
    url: '/dashboard?page=2&pageSize=1',
    headers: { cookie },
  });
  await app.close();

  assert.equal(empty.statusCode, 200);
  assert.match(empty.body, /role="status"/);
  assert.match(empty.body, /No content matches these filters/);
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /page=1/);
  assert.match(page.body, /Page 2 of 2/);
});