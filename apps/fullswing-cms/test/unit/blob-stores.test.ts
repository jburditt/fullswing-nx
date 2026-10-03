import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { BlobConfigurationStore, EncryptedBlobSecretStore } from '../../src/config/blob-stores.js';
import type { CmsConfiguration } from '../../src/config/configuration-store.js';
import { CmsError } from '../../src/content/domain/content-errors.js';

class FakeBlob {
  body?: Buffer;
  version = 0;

  async exists(): Promise<boolean> {
    return this.body !== undefined;
  }

  async download(): Promise<{ etag: string; readableStreamBody: Readable }> {
    if (!this.body) throw Object.assign(new Error('Missing blob.'), { statusCode: 404 });
    return { etag: String(this.version), readableStreamBody: Readable.from([this.body]) };
  }

  async uploadData(body: Buffer, options?: { conditions?: { ifMatch?: string; ifNoneMatch?: string } }): Promise<void> {
    const conditions = options?.conditions;
    if (conditions?.ifNoneMatch === '*' && this.body) {
      throw Object.assign(new Error('Blob already exists.'), { statusCode: 412 });
    }
    if (conditions?.ifMatch && conditions.ifMatch !== String(this.version)) {
      throw Object.assign(new Error('Blob changed.'), { statusCode: 412 });
    }
    this.body = Buffer.from(body);
    this.version += 1;
  }

  async deleteIfExists(): Promise<void> {
    this.body = undefined;
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
}

function configuration(): CmsConfiguration {
  return {
    revision: 'input-revision',
    contentProvider: { type: 'onedrive', settings: { driveId: 'drive-1' } },
    githubWorkflow: {
      owner: 'fullswing',
      repository: 'blog',
      workflow: 'publish.yml',
      ref: 'main',
      inputs: {},
      credentialReference: 'github-token',
    },
  };
}

test('Blob configuration store persists revisions and rejects stale saves', async () => {
  const container = new FakeBlobContainer();
  const store = new BlobConfigurationStore(container as never);
  assert.equal(await store.read(), undefined);

  const first = await store.save(configuration());
  assert.notEqual(first.revision, 'input-revision');
  assert.deepEqual(await store.read(), first);

  await assert.rejects(
    store.save(configuration(), 'stale-revision'),
    (error: unknown) => error instanceof CmsError && error.code === 'configuration-conflict',
  );
});

test('encrypted Blob secret store encrypts values and round-trips them', async () => {
  const container = new FakeBlobContainer();
  const store = new EncryptedBlobSecretStore(container as never, Buffer.alloc(32, 7));
  const secret = 'github-token-sensitive-value';

  await store.set('github-token', secret);
  const stored = container.getBlockBlobClient('secrets/Z2l0aHViLXRva2Vu').body?.toString('utf8') ?? '';
  assert.equal(stored.includes(secret), false);
  assert.equal(await store.get('github-token'), secret);
  assert.equal(await store.get('missing'), undefined);

  await store.delete('github-token');
  assert.equal(await store.get('github-token'), undefined);
});

test('encrypted Blob secret store rejects tampering and a different key', async () => {
  const container = new FakeBlobContainer();
  const store = new EncryptedBlobSecretStore(container as never, Buffer.alloc(32, 7));
  await store.set('github-token', 'sensitive-value');

  const blob = container.getBlockBlobClient('secrets/Z2l0aHViLXRva2Vu');
  const envelope = JSON.parse(blob.body!.toString('utf8')) as { ciphertext: string };
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  ciphertext[0] ^= 1;
  envelope.ciphertext = ciphertext.toString('base64');
  blob.body = Buffer.from(JSON.stringify(envelope));

  await assert.rejects(
    store.get('github-token'),
    (error: unknown) => error instanceof CmsError && error.code === 'provider-unavailable',
  );

  await store.set('github-token', 'sensitive-value');
  const wrongKeyStore = new EncryptedBlobSecretStore(container as never, Buffer.alloc(32, 8));
  await assert.rejects(
    wrongKeyStore.get('github-token'),
    (error: unknown) => error instanceof CmsError && error.code === 'provider-unavailable',
  );
});