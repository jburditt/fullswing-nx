import assert from 'node:assert/strict';
import test from 'node:test';
import type { CmsConfiguration } from '../../src/config/configuration-store.js';
import { ConfigurationService } from '../../src/config/configuration-service.js';
import { ContentProviderSelection } from '../../src/content/application/select-content-provider.js';
import { ContentProviderRegistry } from '../../src/content/storage/provider-registry.js';
import { registerConfigurationRoutes } from '../../src/server/routes/configuration.js';
import { createApp } from '../../src/server/create-app.js';
import { registerRequestGuards } from '../../src/server/request-guards.js';
import { FakeAdminAllowlist, FakeConfigurationStore, FakeContentStorageProvider, FakeSecretStore, FakeSessionStore, testAdministrator } from '../support/fakes.js';

function savedConfiguration(): CmsConfiguration {
  return {
    revision: 'test-config-0',
    contentProvider: { type: 'memory', settings: {} },
    githubWorkflow: {
      owner: 'fullswing', repository: 'blog', workflow: 'publish.yml', ref: 'main', inputs: {},
      credentialReference: 'private-github-token-reference',
    },
  };
}

async function createConfigurationApp(): Promise<{ app: ReturnType<typeof createApp>; cookie: string; store: FakeConfigurationStore }> {
  const store = new FakeConfigurationStore(savedConfiguration());
  const secrets = new FakeSecretStore();
  await secrets.set('private-github-token-reference', 'private-github-token-value');
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'configuration-session', identity: testAdministrator, tokenCacheReference: 'cache', csrfToken: 'csrf-config',
    createdAt: Date.now(), expiresAt: Date.now() + 60_000,
  });
  const registry = new ContentProviderRegistry();
  registry.register('memory', (_settings, revision) => new FakeContentStorageProvider('memory', revision));
  const selection = new ContentProviderSelection(registry);
  await selection.activate({ type: 'memory', revision: 'test-config-0', settings: {} });
  const service = new ConfigurationService(store, secrets, registry, selection);
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions, allowlist: new FakeAdminAllowlist() });
  registerConfigurationRoutes(app, service);
  await app.ready();
  return { app, cookie: `fullswing_cms_session=${encodeURIComponent(app.signCookie('configuration-session'))}`, store };
}

test('configuration page masks credentials and denies anonymous visitors', async () => {
  const { app, cookie } = await createConfigurationApp();
  const anonymous = await app.inject({ method: 'GET', url: '/configuration' });
  const authenticated = await app.inject({ method: 'GET', url: '/configuration', headers: { cookie } });
  await app.close();

  assert.equal(anonymous.statusCode, 302);
  assert.equal(authenticated.statusCode, 200);
  assert.match(authenticated.body, /type="password"/);
  assert.equal(authenticated.body.includes('private-github-token-value'), false);
  assert.equal(authenticated.body.includes('private-github-token-reference'), false);
});

test('configuration route renders accessible validation errors and preserves the saved revision', async () => {
  const { app, cookie, store } = await createConfigurationApp();
  const response = await app.inject({
    method: 'POST',
    url: '/configuration',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      _csrf: 'csrf-config', expectedRevision: 'test-config-0', providerType: 'memory',
      owner: '', repository: 'blog', workflow: 'publish.yml', ref: 'main', inputs: '{}', githubToken: '',
    }).toString(),
  });
  await app.close();

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /role="alert"/);
  assert.equal((await store.read())?.revision, 'test-config-0');
});

test('configuration POST requires CSRF verification', async () => {
  const { app, cookie } = await createConfigurationApp();
  const response = await app.inject({
    method: 'POST', url: '/configuration', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'providerType=memory',
  });
  await app.close();
  assert.equal(response.statusCode, 403);
});