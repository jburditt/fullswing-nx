import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FakeAdminAllowlist,
  FakeIdentityProvider,
  FakeSessionStore,
  testAdministrator,
} from '../support/fakes.js';
import { createApp } from '../../src/server/create-app.js';
import { registerRequestGuards } from '../../src/server/request-guards.js';
import { SessionService } from '../../src/auth/session-service.js';
import { registerAuthRoutes } from '../../src/server/routes/auth.js';

test('Login and the Entra callback are public while protected pages redirect anonymous visitors', async () => {
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions: new FakeSessionStore(), allowlist: new FakeAdminAllowlist() });
  app.get('/login', async () => ({ page: 'login' }));
  app.get('/auth/callback', async () => ({ page: 'callback' }));
  app.get('/dashboard', async () => ({ page: 'dashboard' }));
  await app.ready();

  const login = await app.inject({ method: 'GET', url: '/login' });
  const callback = await app.inject({ method: 'GET', url: '/auth/callback' });
  const dashboard = await app.inject({ method: 'GET', url: '/dashboard' });
  await app.close();

  assert.equal(login.statusCode, 200);
  assert.equal(callback.statusCode, 200);
  assert.equal(dashboard.statusCode, 302);
  assert.equal(dashboard.headers.location, '/login?returnTo=%2Fdashboard');
  assert.equal(dashboard.body.includes('dashboard'), false);
});

test('an authenticated allowlisted administrator reaches a protected page', async () => {
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'session-1',
    identity: testAdministrator,
    tokenCacheReference: 'cache-reference-1',
    csrfToken: 'csrf-token-1',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions, allowlist: new FakeAdminAllowlist() });
  app.get('/dashboard', async request => ({ identity: request.cmsSession?.identity.objectId }));
  await app.ready();
  const cookie = app.signCookie('session-1');
  const response = await app.inject({
    method: 'GET',
    url: '/dashboard',
    headers: { cookie: `fullswing_cms_session=${encodeURIComponent(cookie)}` },
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().identity, testAdministrator.objectId);
});

test('a development session skips login but retains allowlist and CSRF checks', async () => {
  const developmentSession = {
    id: 'local-session',
    identity: testAdministrator,
    tokenCacheReference: 'local-cache',
    csrfToken: 'local-csrf',
    createdAt: Date.now(),
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, {
    sessions: new FakeSessionStore(),
    allowlist: new FakeAdminAllowlist(),
    developmentSession,
  });
  app.get('/dashboard', async request => ({ identity: request.cmsSession?.identity.objectId }));
  app.post('/save', async request => ({ csrfVerified: request.csrfVerified }));
  await app.ready();

  const login = await app.inject({ method: 'GET', url: '/login' });
  const dashboard = await app.inject({ method: 'GET', url: '/dashboard' });
  const rejectedWrite = await app.inject({ method: 'POST', url: '/save', payload: { value: 'x' } });
  const acceptedWrite = await app.inject({
    method: 'POST', url: '/save', headers: { 'x-csrf-token': 'local-csrf' }, payload: { value: 'x' },
  });
  await app.close();

  assert.equal(login.statusCode, 303);
  assert.equal(login.headers.location, '/dashboard');
  assert.equal(dashboard.json().identity, testAdministrator.objectId);
  assert.equal(rejectedWrite.statusCode, 403);
  assert.equal(acceptedWrite.json().csrfVerified, true);
});

test('unsafe requests require the session CSRF token from a header or form body', async () => {
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'session-1',
    identity: testAdministrator,
    tokenCacheReference: 'cache-reference-1',
    csrfToken: 'csrf-token-1',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions, allowlist: new FakeAdminAllowlist() });
  app.post('/save', async request => ({ csrfVerified: request.csrfVerified }));
  await app.ready();
  const cookie = app.signCookie('session-1');
  const headers = { cookie: `fullswing_cms_session=${encodeURIComponent(cookie)}` };
  const rejected = await app.inject({ method: 'POST', url: '/save', headers, payload: { value: 'x' } });
  const accepted = await app.inject({
    method: 'POST',
    url: '/save',
    headers: { ...headers, 'x-csrf-token': 'csrf-token-1' },
    payload: { value: 'x' },
  });
  await app.close();

  assert.equal(rejected.statusCode, 403);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.json().csrfVerified, true);
});

test('an authenticated identity outside the allowlist is denied protected content', async () => {
  const sessions = new FakeSessionStore();
  await sessions.set({
    id: 'session-2',
    identity: { ...testAdministrator, objectId: 'unlisted-user' },
    tokenCacheReference: 'cache-reference-2',
    csrfToken: 'csrf-token-2',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions, allowlist: new FakeAdminAllowlist() });
  app.get('/configuration', async () => ({ page: 'configuration', secret: 'not-rendered' }));
  await app.ready();
  const cookie = app.signCookie('session-2');
  const response = await app.inject({
    method: 'GET',
    url: '/configuration',
    headers: { cookie: `fullswing_cms_session=${encodeURIComponent(cookie)}` },
  });
  await app.close();

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.includes('not-rendered'), false);
});

test('login sets a signed state cookie and a successful callback creates an administrator session', async () => {
  const sessionStore = new FakeSessionStore();
  const sessions = new SessionService(sessionStore, {
    createId: () => 'session-from-login',
    createCsrfToken: () => 'csrf-from-login',
  });
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions: sessionStore, allowlist: new FakeAdminAllowlist() });
  registerAuthRoutes(app, {
    identityProvider: new FakeIdentityProvider(),
    allowlist: new FakeAdminAllowlist(),
    sessions,
    secureCookies: false,
  });
  await app.ready();

  const login = await app.inject({ method: 'GET', url: '/login?returnTo=%2Fdashboard' });
  const stylesheet = await app.inject({ method: 'GET', url: '/assets/cms.css' });
  const state = login.body.match(/state=([^&"]+)/)?.[1];
  const loginCookie = login.headers['set-cookie'];
  const cookiePair = (Array.isArray(loginCookie) ? loginCookie[0] : loginCookie)?.split(';')[0];
  assert.ok(state);
  assert.ok(cookiePair?.startsWith('fullswing_cms_oauth_state='));
  assert.match(login.body, /src="\/assets\/logo\.jpg"/);
  assert.equal(stylesheet.statusCode, 200);
  assert.match(stylesheet.body, /\.cms-header/);

  const callback = await app.inject({
    method: 'GET',
    url: `/auth/callback?code=authorization-code&state=${encodeURIComponent(state)}`,
    headers: { cookie: cookiePair },
  });
  await app.close();

  assert.equal(callback.statusCode, 303);
  assert.equal(callback.headers.location, '/dashboard');
  assert.equal((await sessionStore.get('session-from-login'))?.tokenCacheReference, 'fake-cache-tenant-test-admin-test');
});

test('callback denies an authenticated identity that is not allowlisted', async () => {
  const sessionStore = new FakeSessionStore();
  const sessions = new SessionService(sessionStore, {
    createId: () => 'unlisted-session',
    createCsrfToken: () => 'csrf-token',
  });
  const app = createApp({ sessionCookieSecret: 'test-cookie-secret-that-is-at-least-32-characters', secureCookies: false });
  registerRequestGuards(app, { sessions: sessionStore, allowlist: new FakeAdminAllowlist([]) });
  registerAuthRoutes(app, {
    identityProvider: new FakeIdentityProvider(),
    allowlist: new FakeAdminAllowlist([]),
    sessions,
    secureCookies: false,
  });
  await app.ready();

  const login = await app.inject({ method: 'GET', url: '/login' });
  const state = login.body.match(/state=([^&"]+)/)?.[1];
  const loginCookie = login.headers['set-cookie'];
  const cookiePair = (Array.isArray(loginCookie) ? loginCookie[0] : loginCookie)?.split(';')[0];
  assert.ok(state);

  const callback = await app.inject({
    method: 'GET',
    url: `/auth/callback?code=authorization-code&state=${encodeURIComponent(state)}`,
    headers: { cookie: cookiePair },
  });
  await app.close();

  assert.equal(callback.statusCode, 403);
  assert.equal(await sessionStore.get('unlisted-session'), undefined);
});