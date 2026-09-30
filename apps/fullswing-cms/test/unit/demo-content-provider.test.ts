import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoContentStorageProvider, createDemoContentState } from '../../src/content/storage/demo-content-provider.js';
import { ContentVersionConflictError } from '../../src/content/domain/content-errors.js';
import { contentMetadata } from '../support/fakes.js';

test('local demo provider lists seeded content and saves new and edited blogs', async () => {
  const state = createDemoContentState();
  const provider = new DemoContentStorageProvider('demo-config', state);

  const initialEntries = await provider.listEntries();
  assert.deepEqual(initialEntries.map(entry => entry.id), [
    'welcome-to-fullswing',
    'markdown-editor-demo',
    'sample-page',
  ]);

  const created = await provider.saveBlog({
    configRevision: 'demo-config',
    basename: 'new-demo-post',
    metadata: contentMetadata({ title: 'New demo post' }),
    markdown: '# New post',
  });
  assert.equal(created.id, 'new-demo-post');
  assert.equal((await provider.readBlog(created.id))?.markdown, '# New post');

  const updated = await provider.saveBlog({
    id: created.id,
    expectedVersion: created.version,
    configRevision: 'demo-config',
    basename: 'new-demo-post',
    metadata: contentMetadata({ title: 'Updated demo post' }),
    markdown: '# Updated post',
  });
  assert.equal(updated.metadata.title, 'Updated demo post');
  assert.notEqual(updated.version, created.version);

  await assert.rejects(provider.saveBlog({
    id: created.id,
    expectedVersion: created.version,
    configRevision: 'demo-config',
    basename: 'new-demo-post',
    metadata: contentMetadata(),
    markdown: '# Stale post',
  }), ContentVersionConflictError);
});