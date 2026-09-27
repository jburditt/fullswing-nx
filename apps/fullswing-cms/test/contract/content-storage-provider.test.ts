import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsError, ContentVersionConflictError } from '../../src/content/domain/content-errors.js';
import type { ContentStorageProvider } from '../../src/content/storage/content-storage-provider.js';
import { FakeContentStorageProvider, contentMetadata } from '../support/fakes.js';

function createProvider(): FakeContentStorageProvider {
  return new FakeContentStorageProvider('memory', 'config-1');
}

test('provider contract creates, lists, reads, and updates one logical blog pair', async () => {
  const provider = createProvider();
  await provider.validateConfiguration({ type: 'memory', revision: 'config-1', settings: {} });
  const created = await provider.saveBlog({
    configRevision: 'config-1',
    markdown: '# First version',
    metadata: contentMetadata(),
  });

  const summaries = await provider.listEntries();
  const read = await provider.readBlog(created.id);
  const updated = await provider.saveBlog({
    id: created.id,
    expectedVersion: created.version,
    configRevision: 'config-1',
    markdown: '# Updated version',
    metadata: contentMetadata({ title: 'Updated title' }),
  });

  assert.deepEqual(summaries.map(entry => entry.id), [created.id]);
  assert.equal(read?.markdown, '# First version');
  assert.equal(updated.metadata.title, 'Updated title');
  assert.notEqual(updated.version, created.version);
});

test('provider contract rejects stale content and stale configuration revisions', async () => {
  const provider = createProvider();
  const created = await provider.saveBlog({
    configRevision: 'config-1',
    markdown: '# First version',
    metadata: contentMetadata(),
  });

  await assert.rejects(
    provider.saveBlog({
      id: created.id,
      expectedVersion: 'stale-version',
      configRevision: 'config-1',
      markdown: '# Stale update',
      metadata: contentMetadata(),
    }),
    ContentVersionConflictError,
  );
  await assert.rejects(
    provider.saveBlog({
      id: created.id,
      expectedVersion: created.version,
      configRevision: 'old-config',
      markdown: '# Old configuration',
      metadata: contentMetadata(),
    }),
    ContentVersionConflictError,
  );
});

test('provider contract rejects unsupported configuration and reports provider errors', async () => {
  const provider = createProvider();
  await assert.rejects(
    provider.validateConfiguration({ type: 'onedrive', revision: 'config-1', settings: {} }),
    (error: unknown) => error instanceof CmsError && error.code === 'configuration-invalid',
  );

  const failingProvider: ContentStorageProvider = {
    ...provider,
    type: 'failing',
    async validateConfiguration() {},
    async listEntries() {
      throw new CmsError('provider-unavailable', 'Storage is unavailable.', 502);
    },
    async readBlog() { return undefined; },
    async readPage() { return undefined; },
    async saveBlog() { throw new CmsError('provider-unavailable', 'Storage is unavailable.', 502); },
  };
  await assert.rejects(
    failingProvider.listEntries(),
    (error: unknown) => error instanceof CmsError && error.code === 'provider-unavailable',
  );
});