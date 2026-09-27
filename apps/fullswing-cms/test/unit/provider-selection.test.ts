import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsError } from '../../src/content/domain/content-errors.js';
import { ContentProviderRegistry } from '../../src/content/storage/provider-registry.js';
import { ContentProviderSelection } from '../../src/content/application/select-content-provider.js';
import { FakeContentStorageProvider, contentMetadata } from '../support/fakes.js';

test('invalid provider settings leave the current source active', async () => {
  const registry = new ContentProviderRegistry();
  const current = new FakeContentStorageProvider('current', 'revision-1');
  registry.register('current', () => current);
  registry.register('candidate', () => ({
    type: 'candidate',
    async validateConfiguration() { throw new CmsError('configuration-invalid', 'Invalid settings.', 400); },
    async listEntries() { return current.listEntries(); },
    async readBlog(id) { return current.readBlog(id); },
    async readPage(id) { return current.readPage(id); },
    async saveBlog(request) { return current.saveBlog(request); },
  }));
  const selection = new ContentProviderSelection(registry);
  await selection.activate({ type: 'current', revision: 'revision-1', settings: {} });

  await assert.rejects(selection.activate({ type: 'candidate', revision: 'revision-2', settings: {} }));
  assert.equal(selection.active, current);
});

test('a valid provider switch does not copy or mutate the previous provider data', async () => {
  const registry = new ContentProviderRegistry();
  const previous = new FakeContentStorageProvider('previous', 'revision-1');
  const next = new FakeContentStorageProvider('next', 'revision-2');
  registry.register('previous', () => previous);
  registry.register('next', () => next);
  const selection = new ContentProviderSelection(registry);
  await previous.saveBlog({ configRevision: 'revision-1', markdown: '# Existing', metadata: contentMetadata() });
  await selection.activate({ type: 'previous', revision: 'revision-1', settings: {} });
  const previousEntriesBeforeSwitch = await previous.listEntries();

  const activated = await selection.activate({ type: 'next', revision: 'revision-2', settings: {} });

  assert.equal(activated, next);
  assert.equal(selection.active, next);
  assert.deepEqual(await previous.listEntries(), previousEntriesBeforeSwitch);
  assert.deepEqual(await next.listEntries(), []);
});

