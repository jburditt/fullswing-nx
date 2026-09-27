import assert from 'node:assert/strict';
import test from 'node:test';
import { SessionService } from '../../src/auth/session-service.js';
import { FakeSessionStore, testAdministrator } from '../support/fakes.js';

test('sessions receive expiry and CSRF values from the session service', async () => {
  const store = new FakeSessionStore();
  const service = new SessionService(store, {
    ttlMilliseconds: 1_000,
    now: () => 10_000,
    createId: () => 'session-id',
    createCsrfToken: () => 'csrf-token',
  });

  const session = await service.create({ identity: testAdministrator, tokenCacheReference: 'cache-reference-1' });

  assert.equal(session.id, 'session-id');
  assert.equal(session.csrfToken, 'csrf-token');
  assert.equal(session.tokenCacheReference, 'cache-reference-1');
  assert.equal(session.expiresAt, 11_000);
});

test('expired sessions are deleted and cannot restore protected access', async () => {
  const store = new FakeSessionStore();
  await store.set({
    id: 'expired-session',
    identity: testAdministrator,
    tokenCacheReference: 'cache-reference-1',
    csrfToken: 'csrf-token',
    createdAt: 1,
    expiresAt: 2,
  });
  const service = new SessionService(store, { now: () => 3 });

  assert.equal(await service.get('expired-session'), undefined);
  assert.equal(await store.get('expired-session'), undefined);
});

test('logout removes the server-side session', async () => {
  const store = new FakeSessionStore();
  const service = new SessionService(store, {
    createId: () => 'session-id',
    createCsrfToken: () => 'csrf-token',
  });
  await service.create({ identity: testAdministrator, tokenCacheReference: 'cache-reference-1' });

  await service.destroy('session-id');

  assert.equal(await store.get('session-id'), undefined);
});