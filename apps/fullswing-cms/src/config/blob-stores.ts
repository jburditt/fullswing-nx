import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { BlockBlobClient, ContainerClient } from '@azure/storage-blob';
import type { CmsConfiguration, ConfigurationStore } from './configuration-store.js';
import type { SecretStore } from './secret-store.js';
import { CmsError } from '../content/domain/content-errors.js';

interface StoredBlob {
  body: Buffer;
  etag: string;
}

function collectStream(stream: NodeJS.ReadableStream | undefined): Promise<Buffer> {
  if (!stream) return Promise.resolve(Buffer.alloc(0));

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function downloadBlob(blob: BlockBlobClient): Promise<StoredBlob | undefined> {
  if (!await blob.exists()) return undefined;

  const response = await blob.download();
  if (!response.etag) {
    throw new CmsError('provider-unavailable', 'Blob storage did not return a configuration version.', 502);
  }
  return { body: await collectStream(response.readableStreamBody), etag: response.etag };
}

function isConditionNotMet(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    && (error.statusCode === 409 || error.statusCode === 412);
}

export class BlobConfigurationStore implements ConfigurationStore {
  constructor(
    private readonly container: Pick<ContainerClient, 'getBlockBlobClient'>,
    private readonly blobName = 'configuration.json',
  ) {}

  async read(): Promise<CmsConfiguration | undefined> {
    const stored = await downloadBlob(this.container.getBlockBlobClient(this.blobName));
    return stored ? JSON.parse(stored.body.toString('utf8')) as CmsConfiguration : undefined;
  }

  async save(configuration: CmsConfiguration, expectedRevision?: string): Promise<CmsConfiguration> {
    const blob = this.container.getBlockBlobClient(this.blobName);
    const current = await downloadBlob(blob);
    const currentConfiguration = current
      ? JSON.parse(current.body.toString('utf8')) as CmsConfiguration
      : undefined;

    if (currentConfiguration && expectedRevision !== undefined
      && currentConfiguration.revision !== expectedRevision) {
      throw new CmsError('configuration-conflict', 'Configuration changed. Reload it before saving.', 409);
    }

    const next = { ...structuredClone(configuration), revision: randomBytes(16).toString('hex') };
    try {
      await blob.uploadData(Buffer.from(JSON.stringify(next)), {
        conditions: current ? { ifMatch: current.etag } : { ifNoneMatch: '*' },
      });
    } catch (error) {
      if (isConditionNotMet(error)) {
        throw new CmsError('configuration-conflict', 'Configuration changed. Reload it before saving.', 409);
      }
      throw error;
    }
    return next;
  }
}

interface EncryptedSecret {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

export class EncryptedBlobSecretStore implements SecretStore {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly container: Pick<ContainerClient, 'getBlockBlobClient'>,
    encryptionKey: Uint8Array,
    private readonly blobPrefix = 'secrets/',
  ) {
    if (encryptionKey.byteLength !== 32) {
      throw new Error('CMS_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    }
    this.encryptionKey = Buffer.from(encryptionKey);
  }

  async get(reference: string): Promise<string | undefined> {
    const blob = this.container.getBlockBlobClient(this.blobName(reference));
    let stored: StoredBlob | undefined;
    try {
      stored = await downloadBlob(blob);
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
    if (!stored) return undefined;

    try {
      const encrypted = JSON.parse(stored.body.toString('utf8')) as EncryptedSecret;
      if (encrypted.version !== 1) throw new Error('Unsupported encrypted secret version.');
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(encrypted.iv, 'base64'));
      decipher.setAAD(Buffer.from(reference, 'utf8'));
      decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new CmsError('provider-unavailable', 'A stored secret could not be decrypted.', 502);
    }
  }

  async set(reference: string, value: string): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(reference, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const encrypted: EncryptedSecret = {
      version: 1,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
    await this.container.getBlockBlobClient(this.blobName(reference)).uploadData(
      Buffer.from(JSON.stringify(encrypted)),
    );
  }

  async delete(reference: string): Promise<void> {
    await this.container.getBlockBlobClient(this.blobName(reference)).deleteIfExists();
  }

  private blobName(reference: string): string {
    return `${this.blobPrefix}${Buffer.from(reference, 'utf8').toString('base64url')}`;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404;
}