import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentMetadata } from '@fullswing/content-model';
import { CmsError, ContentVersionConflictError, PartialContentWriteError } from '../../src/content/domain/content-errors.js';
import type { GraphDriveItem, OneDriveGraphGateway } from '../../src/content/storage/onedrive/onedrive-client.js';
import { OneDriveContentStorageProvider } from '../../src/content/storage/onedrive/onedrive-provider.js';

class SaveGraphFake implements OneDriveGraphGateway {
  readonly items = new Map<string, GraphDriveItem>();
  readonly contents = new Map<string, string>();
  writeCount = 0;
  failWriteAt?: number;
  failCompensation = false;
  raceBeforeFirstWrite = false;

  async validateLocation(): Promise<void> {}

  async listChildren(_driveId: string, parentId: string): Promise<GraphDriveItem[]> {
    return [...this.items.values()].filter(item => item.parentReference?.id === parentId);
  }

  async readText(_driveId: string, itemId: string): Promise<string> {
    const value = this.contents.get(itemId);
    if (value === undefined) throw new Error('missing item');
    return value;
  }

  async writeText(
    _driveId: string,
    parentId: string,
    name: string,
    content: string,
    options: { itemId?: string; expectedETag?: string } = {},
  ): Promise<GraphDriveItem> {
    this.writeCount++;
    if (this.failWriteAt === this.writeCount || (this.failCompensation && this.writeCount === 3)) {
      throw new Error('simulated write failure');
    }
    let existing = options.itemId ? this.items.get(options.itemId) : undefined;
    if (this.raceBeforeFirstWrite && this.writeCount === 1 && existing) {
      const changed = { ...existing, eTag: 'changed-by-another-writer' };
      this.items.set(changed.id, changed);
      existing = changed;
    }
    if (options.expectedETag && existing?.eTag !== options.expectedETag) {
      throw Object.assign(new Error('stale'), { statusCode: 412 });
    }
    const id = existing?.id ?? `new-${this.writeCount}`;
    const item: GraphDriveItem = {
      id,
      name: existing?.name ?? name,
      eTag: `etag-${this.writeCount}`,
      file: {},
      parentReference: { id: existing?.parentReference?.id ?? parentId },
    };
    this.items.set(id, item);
    this.contents.set(id, content);
    return item;
  }

  async deleteItem(_driveId: string, itemId: string): Promise<void> {
    this.items.delete(itemId);
    this.contents.delete(itemId);
  }

  seedBlog(): void {
    this.items.set('markdown', { id: 'markdown', name: 'article.md', eTag: 'md-v1', file: {}, parentReference: { id: 'root' } });
    this.items.set('metadata', { id: 'metadata', name: 'article.json', eTag: 'json-v1', file: {}, parentReference: { id: 'root' } });
    this.contents.set('markdown', '# First version');
    this.contents.set('metadata', JSON.stringify(metadata));
  }
}

const metadata: ContentMetadata = {
  route: '/blog/article',
  title: 'Article',
  author: 'Alice',
  date: '2026-01-01',
  categories: ['News'],
};

function createProvider(graph: SaveGraphFake): OneDriveContentStorageProvider {
  return new OneDriveContentStorageProvider(graph, { driveId: 'drive', rootFolderId: 'root' }, 'config-1');
}

test('OneDrive save rejects stale versions before attempting a write', async () => {
  const graph = new SaveGraphFake();
  graph.seedBlog();
  const provider = createProvider(graph);
  const [entry] = await provider.listEntries();

  await assert.rejects(provider.saveBlog({
    id: entry.id,
    expectedVersion: 'stale',
    configRevision: 'config-1',
    markdown: '# Changed',
    metadata,
  }), ContentVersionConflictError);
  assert.equal(graph.writeCount, 0);
});

test('OneDrive save maps a Graph eTag race to a version conflict', async () => {
  const graph = new SaveGraphFake();
  graph.seedBlog();
  const provider = createProvider(graph);
  const [entry] = await provider.listEntries();
  graph.raceBeforeFirstWrite = true;

  await assert.rejects(provider.saveBlog({
    id: entry.id,
    expectedVersion: entry.version,
    configRevision: 'config-1',
    markdown: '# Updated',
    metadata,
  }), ContentVersionConflictError);
  assert.equal(graph.contents.get('markdown'), '# First version');
});

test('OneDrive save updates both sidecars and returns the new pair version', async () => {
  const graph = new SaveGraphFake();
  graph.seedBlog();
  const provider = createProvider(graph);
  const [entry] = await provider.listEntries();

  const saved = await provider.saveBlog({
    id: entry.id,
    expectedVersion: entry.version,
    configRevision: 'config-1',
    markdown: '# Updated',
    metadata: { ...metadata, title: 'Updated article' },
  });

  assert.equal(saved.markdown, '# Updated');
  assert.equal(saved.metadata.title, 'Updated article');
  assert.notEqual(saved.version, entry.version);
});

test('OneDrive save leaves both files untouched when the first conditional write fails', async () => {
  const graph = new SaveGraphFake();
  graph.seedBlog();
  const provider = createProvider(graph);
  const [entry] = await provider.listEntries();
  graph.failWriteAt = 1;

  await assert.rejects(provider.saveBlog({
    id: entry.id,
    expectedVersion: entry.version,
    configRevision: 'config-1',
    markdown: '# Updated',
    metadata,
  }), (error: unknown) => error instanceof CmsError && error.code === 'provider-unavailable');
  assert.equal(graph.contents.get('markdown'), '# First version');
  assert.equal(graph.contents.get('metadata'), JSON.stringify(metadata));
});

test('OneDrive save compensates the first sidecar if the second update fails', async () => {
  const graph = new SaveGraphFake();
  graph.seedBlog();
  const provider = createProvider(graph);
  const [entry] = await provider.listEntries();
  graph.failWriteAt = 2;

  await assert.rejects(provider.saveBlog({
    id: entry.id,
    expectedVersion: entry.version,
    configRevision: 'config-1',
    markdown: '# Updated',
    metadata,
  }), (error: unknown) => error instanceof CmsError && error.code === 'provider-unavailable');
  assert.equal(graph.contents.get('markdown'), '# First version');
  assert.equal(graph.contents.get('metadata'), JSON.stringify(metadata));
});

test('OneDrive save reports a partial write if compensation also fails', async () => {
  const graph = new SaveGraphFake();
  graph.seedBlog();
  const provider = createProvider(graph);
  const [entry] = await provider.listEntries();
  graph.failWriteAt = 2;
  graph.failCompensation = true;

  await assert.rejects(provider.saveBlog({
    id: entry.id,
    expectedVersion: entry.version,
    configRevision: 'config-1',
    markdown: '# Updated',
    metadata,
  }), PartialContentWriteError);
});