import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsError, ContentVersionConflictError } from '../../src/content/domain/content-errors.js';
import { mapGraphError } from '../../src/content/storage/onedrive/onedrive-errors.js';

test('Graph precondition failures map to provider-neutral version conflicts', () => {
  assert.ok(mapGraphError({ statusCode: 412 }) instanceof ContentVersionConflictError);
});

test('Graph authorization, throttling, and unknown failures map without leaking remote messages', () => {
  const denied = mapGraphError({ statusCode: 403, message: 'private tenant detail' });
  const throttled = mapGraphError({ statusCode: 429, message: 'private request detail' });
  const unavailable = mapGraphError(new Error('private Graph response'));

  assert.equal(denied.code, 'access-denied');
  assert.equal(throttled.code, 'rate-limited');
  assert.equal(unavailable.code, 'provider-unavailable');
  assert.ok(denied instanceof CmsError);
  assert.doesNotMatch(`${denied.message} ${throttled.message} ${unavailable.message}`, /private/);
});