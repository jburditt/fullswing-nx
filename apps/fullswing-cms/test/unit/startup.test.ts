import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsError } from '../../src/content/domain/content-errors.js';
import { runCmsFromEnvironment } from '../../src/index.js';

test('standalone startup requires an explicit deployment composition module', async () => {
  await assert.rejects(runCmsFromEnvironment({}), (error: unknown) =>
    error instanceof CmsError && error.code === 'configuration-invalid');
});