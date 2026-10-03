import assert from 'node:assert/strict';
import test from 'node:test';
import { BlobContentStorageProvider } from '../../src/content/storage/blob-content-provider.js';
import { ContentVersionConflictError, CmsError } from '../../src/content/domain/content-errors.js';

class FakeBlob {
  body?: Buffer;
  etagNumber = 0;

  get etag(): string {
    return `etag-${this.etagNumber}`;
  }

  async exists(): Promise<boolean> {
    return this.body !== undefined;
  }

  async downloadToBuffer(): Promise<Buffer> {
    if (!this.body) throw Object.assign(new Error('Blob is missing.'), { statusCode: 404 });
    return Buffer.from(this.body);
  }

  async uploadData(body: Buffer, options?: { conditions?: { ifMatch?: string; ifNoneMatch?: string } }): Promise<{ etag: string }> {
    const conditions = options?.conditions;
    if (conditions?.ifNoneMatch === '*' && this.body) {
      throw Object.assign(new Error('Blob already exists.'), { statusCode: 412 });
    }
    if (conditions?.ifMatch && conditions.ifMatch !== this.etag) {
      throw Object.assign(new Error('Blob changed.'), { statusCode: 412 });
    }
    this.body = Buffer.from(body);
    this.etagNumber += 1;
    return { etag: this.etag };
  }

  async deleteIfExists(options?: { conditions?: { ifMatch?: string } }): Promise<void> {
    if (options?.conditions?.ifMatch && options.conditions.ifMatch !== this.etag) {
      throw Object.assign(new Error('Blob changed.'), { statusCode: 412 });
    }
    this.body = undefined;
    this.etagNumber += 1;
  }

  async delete(options?: { conditions?: { ifMatch?: string } }): Promise<void> {
    await this.deleteIfExists(options);
  }
}

class FakeBlobContainer {
  private readonly blobs = new Map<string, FakeBlob>();

  getBlockBlobClient(name: string): FakeBlob {
    let blob = this.blobs.get(name);
    if (!blob) {
      blob = new FakeBlob();
      this.blobs.set(name, blob);
    }
    return blob;
  }

  async *listBlobsFlat(options?: { prefix?: string }): AsyncGenerator<{ name: string; properties: { etag: string } }> {
    for (const [name, blob] of this.blobs) {
      if (blob.body && (!options?.prefix || name.startsWith(options.prefix))) {
        yield { name, properties: { etag: blob.etag } };
      }
    }
  }
}

const metadata = (date: string, title = 'Blob content') => ({
  title,
  author: 'Fullswing Team',
  date,
  categories: ['Blob'],
});

function createProvider(container = new FakeBlobContainer()): BlobContentStorageProvider {
  return new BlobContentStorageProvider(container as never, 'config-1');
}

test('Blob provider saves, lists, reads, and conditionally updates blog pairs', async () => {
  const container = new FakeBlobContainer();
  const provider = createProvider(container);
  await provider.validateConfiguration({ type: 'blob', revision: 'config-1', settings: {} });

  const created = await provider.saveBlog({
    configRevision: 'config-1',
    basename: 'new-post',
    markdown: '# First draft',
    metadata: metadata('2026-09-29'),
  });
  assert.equal(container.getBlockBlobClient('content/blog/2026/new-post.md').body?.toString(), '# First draft');
  assert.equal((await provider.listEntries())[0]?.id, created.id);
  assert.equal((await provider.readBlog(created.id))?.markdown, '# First draft');

  const updated = await provider.saveBlog({
    id: created.id,
    expectedVersion: created.version,
    configRevision: 'config-1',
    basename: 'new-post',
    markdown: '# Updated draft',
    metadata: metadata('2026-09-29', 'Updated post'),
  });
  assert.equal(updated.metadata.title, 'Updated post');
  assert.notEqual(updated.version, created.version);

  await assert.rejects(provider.saveBlog({
    id: created.id,
    expectedVersion: created.version,
    configRevision: 'config-1',
    basename: 'new-post',
    markdown: '# Stale draft',
    metadata: metadata('2026-09-29'),
  }), ContentVersionConflictError);
});

test('Blob provider supports HTML pages and duplicate blog basenames across years', async () => {
  const container = new FakeBlobContainer();
  const provider = createProvider(container);
  const page = await provider.savePage({
    configRevision: 'config-1',
    basename: 'about',
    html: '<main>About</main>',
    metadata: metadata('2026-04-01', 'About'),
  });
  assert.equal((await provider.readPage(page.id))?.html, '<main>About</main>');

  for (const [year, title] of [['2025', 'Older post'], ['2026', 'Newer post']]) {
    await provider.saveBlog({
      configRevision: 'config-1',
      basename: 'same-name',
      markdown: `# ${title}`,
      metadata: metadata(`${year}-01-01`, title),
    });
  }
  assert.deepEqual((await provider.listEntries()).map(entry => entry.route).sort(), [
    '/blog/2025/same-name', '/blog/same-name', '/page/about',
  ]);
});

test('Blob provider rejects orphaned pairs, malformed metadata, and invalid basenames', async () => {
  const container = new FakeBlobContainer();
  const provider = createProvider(container);
  await container.getBlockBlobClient('content/blog/2026/orphan.md').uploadData(Buffer.from('# Orphan'));
  await assert.rejects(provider.listEntries(), (error: unknown) =>
    error instanceof CmsError && error.code === 'validation-failed');

  const malformedContainer = new FakeBlobContainer();
  await malformedContainer.getBlockBlobClient('content/blog/2026/bad.md').uploadData(Buffer.from('# Bad'));
  await malformedContainer.getBlockBlobClient('content/blog/2026/bad.json').uploadData(Buffer.from('{'));
  await assert.rejects(createProvider(malformedContainer).listEntries(), (error: unknown) =>
    error instanceof CmsError && error.code === 'validation-failed');

  await assert.rejects(provider.saveBlog({
    configRevision: 'config-1',
    basename: '../bad',
    markdown: '# Invalid',
    metadata: metadata('2026-01-01'),
  }), /lowercase letters, digits, and hyphens/);
});