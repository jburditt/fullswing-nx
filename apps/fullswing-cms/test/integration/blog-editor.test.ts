import assert from 'node:assert/strict';
import test from 'node:test';
import type { SaveBlogRequest } from '../../src/content/storage/content-storage-provider.js';
import { registerBlogEditorRoutes } from '../../src/server/routes/blog-editor.js';
import { FakeAdminAllowlist, FakeContentStorageProvider, FakeSessionStore, testAdministrator } from '../support/fakes.js';
import { createApp } from '../../src/server/create-app.js';
import { registerRequestGuards } from '../../src/server/request-guards.js';

async function createEditorApp(): Promise<{
  app: ReturnType<typeof createApp>;
  cookie: string;
  provider: FakeContentStorageProvider;
  saveCount: () => number;
}> {
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'editor-session',
    identity: testAdministrator,
    tokenCacheReference: 'editor-cache',
    csrfToken: 'editor-csrf',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });
  const provider = new FakeContentStorageProvider();
  let saves = 0;
  const originalSave = provider.saveBlog.bind(provider);
  provider.saveBlog = async (request: SaveBlogRequest) => {
    saves += 1;
    return originalSave(request);
  };
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions, allowlist: new FakeAdminAllowlist() });
  registerBlogEditorRoutes(app, {
    resolveContentProvider: async () => provider,
    getConfigRevision: async () => 'test-config-1',
  });
  await app.ready();
  return {
    app,
    provider,
    saveCount: () => saves,
    cookie: `fullswing_cms_session=${encodeURIComponent(app.signCookie('editor-session'))}`,
  };
}

function blogForm(overrides: Record<string, string> = {}): string {
  return new URLSearchParams({
    route: '/blog/example',
    title: 'Example',
    author: 'Test Author',
    date: '2026-02-28',
    categories: 'Testing',
    markdown: '# Example',
    configRevision: 'test-config-1',
    expectedVersion: 'old-version',
    _csrf: 'editor-csrf',
    ...overrides,
  }).toString();
}

test('invalid metadata is rejected before writing a blog pair', async () => {
  const { app, cookie, saveCount } = await createEditorApp();
  const response = await app.inject({
    method: 'POST',
    url: '/blogs/example',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: blogForm({ date: '2026-02-30' }),
  });
  await app.close();

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.toLowerCase().includes('date'), true);
  assert.equal(saveCount(), 0);
});

test('Preview validates a draft and renders status without saving it', async () => {
  const { app, cookie, saveCount } = await createEditorApp();
  const response = await app.inject({
    method: 'POST',
    url: '/blogs',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: blogForm({ expectedVersion: '', intent: 'preview' }),
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Draft is valid\. The preview has not been saved\./);
  assert.match(response.body, /<h1>Example<\/h1>/);
  assert.equal(saveCount(), 0);
});

test('a stale editor version is rejected without replacing stored content', async () => {
  const { app, cookie, provider, saveCount } = await createEditorApp();
  provider.seed({
    id: 'example',
    kind: 'blog',
    version: 'stored-version',
    markdown: '# Original',
    metadata: {
      route: '/blog/example',
      title: 'Original',
      author: 'Test Author',
      date: '2026-02-28',
      dateValue: new Date('2026-02-28T00:00:00.000Z'),
      categories: ['Testing'],
    },
  });
  const writesBeforeEdit = saveCount();
  const response = await app.inject({
    method: 'POST',
    url: '/blogs/example',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: blogForm({ expectedVersion: 'stale-version', title: 'Overwritten' }),
  });
  const stored = await provider.readBlog('example');
  await app.close();

  assert.equal(response.statusCode, 409);
  assert.equal(stored?.metadata.title, 'Original');
  assert.equal(saveCount(), writesBeforeEdit + 1);
});