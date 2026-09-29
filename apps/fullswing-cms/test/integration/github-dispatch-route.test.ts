import assert from 'node:assert/strict';
import test from 'node:test';
import type { CmsConfiguration, GitHubWorkflowSettings } from '../../src/config/configuration-store.js';
import { registerGitHubWorkflowRoutes } from '../../src/server/routes/github-workflow.js';
import { createApp } from '../../src/server/create-app.js';
import { registerRequestGuards } from '../../src/server/request-guards.js';
import { FakeAdminAllowlist, FakeConfigurationStore, FakeSecretStore, FakeSessionStore, testAdministrator } from '../support/fakes.js';

const saved: CmsConfiguration = {
  revision: 'saved-revision',
  contentProvider: { type: 'memory', settings: {} },
  githubWorkflow: {
    owner: 'saved-owner', repository: 'saved-repo', workflow: 'deploy.yml', ref: 'release', inputs: { mode: 'safe' },
    credentialReference: 'github-secret-reference',
  },
};

async function createDispatchApp() {
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'dispatch-session', identity: testAdministrator, tokenCacheReference: 'cache', csrfToken: 'csrf-dispatch',
    createdAt: Date.now(), expiresAt: Date.now() + 60_000,
  });
  const store = new FakeConfigurationStore(saved);
    const secrets = new FakeSecretStore();
    await secrets.set('github-secret-reference', 'test-token');
  const calls: GitHubWorkflowSettings[] = [];
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions, allowlist: new FakeAdminAllowlist() });
  registerGitHubWorkflowRoutes(app, {
    configurations: store,
    secrets,
    dispatch: async settings => {
      calls.push(settings);
      return { status: 'accepted', runId: 55, runUrl: 'https://github.com/saved-owner/saved-repo/actions/runs/55' };
    },
  });
  await app.ready();
  return { app, calls, cookie: `fullswing_cms_session=${encodeURIComponent(app.signCookie('dispatch-session'))}` };
}

test('dispatch requires an administrator session and CSRF token', async () => {
  const { app, cookie, calls } = await createDispatchApp();
  const anonymous = await app.inject({ method: 'POST', url: '/github/dispatch' });
  const noCsrf = await app.inject({
    method: 'POST', url: '/github/dispatch', headers: { cookie }, payload: {},
  });
  await app.close();

  assert.equal(anonymous.statusCode, 302);
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(calls.length, 0);
});

test('dispatch uses only saved target values and reports acceptance, not completion', async () => {
  const { app, cookie, calls } = await createDispatchApp();
  const response = await app.inject({
    method: 'POST',
    url: '/github/dispatch',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      _csrf: 'csrf-dispatch', owner: 'attacker', repository: 'attacker', workflow: 'attacker.yml', ref: 'attacker',
    }).toString(),
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Dispatch accepted/);
  assert.match(response.body, /may still be running/);
  assert.match(response.body, /Run ID: 55/);
  assert.match(response.body, /https:\/\/github\.com\/saved-owner\/saved-repo\/actions\/runs\/55/);
  assert.doesNotMatch(response.body, /workflow completed|deployment completed/i);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].owner, 'saved-owner');
  assert.equal(calls[0].repository, 'saved-repo');
  assert.equal(calls[0].workflow, 'deploy.yml');
  assert.equal(calls[0].ref, 'release');
});