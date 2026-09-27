import assert from 'node:assert/strict';
import test from 'node:test';
import { createCmsApp } from '../../src/bootstrap.js';
import { FakeAdminAllowlist, FakeConfigurationStore, FakeContentStorageProvider, FakeIdentityProvider, FakeSecretStore, FakeSessionStore, testAdministrator } from '../support/fakes.js';
import { ContentProviderRegistry } from '../../src/content/storage/provider-registry.js';

test('createCmsApp mounts authenticated CMS routes using the configured provider', async () => {
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'bootstrap-session', identity: testAdministrator, tokenCacheReference: 'bootstrap-cache', csrfToken: 'bootstrap-csrf',
    createdAt: Date.now(), expiresAt: Date.now() + 60_000,
  });
  const configurations = new FakeConfigurationStore({
    revision: 'bootstrap-revision',
    contentProvider: { type: 'memory', settings: {} },
    githubWorkflow: {
      owner: 'fullswing', repository: 'blog', workflow: 'publish.yml', ref: 'main', inputs: {},
      credentialReference: 'github-token',
    },
  });
  const contentProviders = new ContentProviderRegistry();
  contentProviders.register('memory', (_settings, revision) => new FakeContentStorageProvider('memory', revision));
  const app = await createCmsApp({
    configurationStore: configurations,
    secretStore: new FakeSecretStore(),
    identityProvider: new FakeIdentityProvider(),
    sessionStore: sessions,
    allowlist: new FakeAdminAllowlist(),
    contentProviders,
    sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters',
    secureCookies: false,
  });
  const cookie = `fullswing_cms_session=${encodeURIComponent(app.signCookie('bootstrap-session'))}`;

  const anonymous = await app.inject({ method: 'GET', url: '/dashboard' });
  const dashboard = await app.inject({ method: 'GET', url: '/dashboard', headers: { cookie } });
  const pages = await app.inject({ method: 'GET', url: '/pages', headers: { cookie } });
  const editor = await app.inject({ method: 'GET', url: '/blogs/new', headers: { cookie } });
  await app.close();

  assert.equal(anonymous.statusCode, 302);
  assert.equal(dashboard.statusCode, 200);
  assert.equal(pages.statusCode, 200);
  assert.equal(editor.statusCode, 200);
});