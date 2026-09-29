import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfiguredAdminAllowlist } from '../../src/auth/admin-allowlist.js';
import { testAdministrator } from '../support/fakes.js';

test('allowlist matches immutable tenant and object IDs rather than mutable profile fields', async () => {
  const allowlist = new ConfiguredAdminAllowlist([
    { tenantId: testAdministrator.tenantId, objectId: testAdministrator.objectId },
  ]);

  assert.equal(await allowlist.isAllowed({ ...testAdministrator, email: 'renamed@example.test' }), true);
  assert.equal(await allowlist.isAllowed({ ...testAdministrator, tenantId: 'other-tenant' }), false);
  assert.equal(await allowlist.isAllowed({ ...testAdministrator, objectId: 'other-user' }), false);
});

test('an empty allowlist denies every identity', async () => {
  const allowlist = new ConfiguredAdminAllowlist([]);
  assert.equal(await allowlist.isAllowed(testAdministrator), false);
});