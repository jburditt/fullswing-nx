import { createHash, randomUUID } from 'node:crypto';
import type { ContainerClient } from '@azure/storage-blob';
import { parseMetadata, type ParsedMetadata } from '@fullswing/content-model';
import { CmsError, ContentVersionConflictError, PartialContentWriteError } from '../domain/content-errors.js';
import type { BlogContent, ContentEntrySummary, PageContent } from '../domain/content-entry.js';
import type {
  ContentStorageProvider,
  ProviderConfiguration,
  SaveBlogRequest,
  SavePageRequest,
} from './content-storage-provider.js';

interface ContentPair {
  kind: 'blog' | 'page';
  basename: string;
  year: string;
  bodyName: string;
  metadataName: string;
  body: string;
  metadata: ParsedMetadata;
  bodyETag: string;
  metadataETag: string;
}

interface PairPaths {
  bodyName: string;
  metadataName: string;
}

export class BlobContentStorageProvider implements ContentStorageProvider {
  readonly type = 'blob';
  private readonly contentPrefix: string;

  constructor(
    private readonly container: Pick<ContainerClient, 'listBlobsFlat' | 'getBlockBlobClient'>,
    private readonly configurationRevision: string,
    contentPrefix = 'content',
  ) {
    this.contentPrefix = normalizePrefix(contentPrefix);
  }

  async validateConfiguration(configuration: ProviderConfiguration): Promise<void> {
    const configuredPrefix = typeof configuration.settings.contentPrefix === 'string'
      ? configuration.settings.contentPrefix
      : 'content';
    if (configuration.type !== this.type || normalizePrefix(configuredPrefix) !== this.contentPrefix) {
      throw new CmsError('configuration-invalid', 'Blob storage requires the configured content prefix.', 400);
    }
    try {
      await this.container.getBlockBlobClient(`${this.contentPrefix}/.cms-check`).exists();
    } catch {
      throw new CmsError('configuration-invalid', 'The Azure Blob container is unavailable.', 400);
    }
  }

  async listEntries(): Promise<ContentEntrySummary[]> {
    const pairs = await this.discoverPairs();
    const entries = pairs.map(pair => this.toSummary(pair, pairs));
    const routes = new Set<string>();
    for (const entry of entries) {
      if (routes.has(entry.route)) {
        throw new CmsError('validation-failed', `Blob storage contains duplicate content route "${entry.route}".`, 400);
      }
      routes.add(entry.route);
    }
    return entries.sort((left, right) => right.metadata.dateValue.getTime() - left.metadata.dateValue.getTime()
      || left.metadata.title.localeCompare(right.metadata.title));
  }

  async readBlog(id: string): Promise<BlogContent | undefined> {
    const pairs = await this.discoverPairs();
    const pair = pairs.find(entry => entry.kind === 'blog' && this.idFor(entry) === id);
    return pair ? { ...this.toSummary(pair, pairs), kind: 'blog', markdown: pair.body } : undefined;
  }

  async readPage(id: string): Promise<PageContent | undefined> {
    const pairs = await this.discoverPairs();
    const pair = pairs.find(entry => entry.kind === 'page' && this.idFor(entry) === id);
    return pair ? { ...this.toSummary(pair, pairs), kind: 'page', html: pair.body } : undefined;
  }

  async saveBlog(request: SaveBlogRequest): Promise<BlogContent> {
    if (request.configRevision !== this.configurationRevision) throw new ContentVersionConflictError();
    const saved = await this.savePair('blog', request, request.markdown);
    return { ...saved, kind: 'blog', markdown: request.markdown };
  }

  async savePage(request: SavePageRequest): Promise<PageContent> {
    if (request.configRevision !== this.configurationRevision) throw new ContentVersionConflictError();
    const saved = await this.savePair('page', request, request.html);
    return { ...saved, kind: 'page', html: request.html };
  }

  private async savePair(
    kind: 'blog' | 'page',
    request: SaveBlogRequest | SavePageRequest,
    body: string,
  ): Promise<ContentEntrySummary> {
    const basename = assertValidBasename(request.basename);
    const metadata = parseSubmittedMetadata(request.metadata);
    const pairs = await this.discoverPairs();
    const existing = request.id ? pairs.find(pair => this.idFor(pair) === request.id && pair.kind === kind) : undefined;
    assertExpectedVersion(request.id, request.expectedVersion, existing);

    if (pairs.some(pair => pair.kind === kind && pair.basename === basename
      && pair.year === metadata.date.slice(0, 4) && pair !== existing)) {
      throw new CmsError('validation-failed', 'Another entry already uses this route.', 400);
    }

    const target = this.pathsFor(kind, metadata.date.slice(0, 4), basename);
    const moving = existing && (existing.bodyName !== target.bodyName || existing.metadataName !== target.metadataName);
    if (moving || !existing) {
      await this.writeNewPair(target, body, JSON.stringify(request.metadata, null, 2));
      if (existing) await this.deletePair(existing);
    } else {
      await this.replacePair(existing, body, JSON.stringify(request.metadata, null, 2));
    }

    const savedPairs = await this.discoverPairs();
    const saved = savedPairs.find(pair => pair.bodyName === target.bodyName && pair.kind === kind);
    if (!saved) throw new CmsError('provider-unavailable', 'The saved content could not be read back.', 502);
    return this.toSummary(saved, savedPairs);
  }

  private async discoverPairs(): Promise<ContentPair[]> {
    const groups = new Map<string, Map<string, { name: string; etag: string }>>();
    try {
      for await (const blob of this.container.listBlobsFlat({ prefix: `${this.contentPrefix}/` })) {
        const relativeName = blob.name.slice(this.contentPrefix.length + 1);
        const match = /^(blog|pages)\/(\d{4})\/([^/]+)\.(md|html|json)$/.exec(relativeName);
        if (!match) continue;
        const [, kindFolder, year, basename, rawExtension] = match;
        if (!kindFolder || !year || !basename || !rawExtension) continue;
        const extension = rawExtension.toLowerCase();
        const kind = kindFolder === 'blog' ? 'blog' : 'page';
        if ((kind === 'blog' && extension === 'html') || (kind === 'page' && extension === 'md')) continue;
        if (!blob.properties.etag) {
          throw new CmsError('provider-unavailable', 'Blob storage did not return a version for content.', 502);
        }
        const key = `${kind}\0${year}\0${basename}`;
        let files = groups.get(key);
        if (!files) groups.set(key, files = new Map());
        if (files.has(extension)) {
          throw new CmsError('validation-failed', `Blob storage contains duplicate ${basename}.${extension} content.`, 400);
        }
        files.set(extension, { name: blob.name, etag: blob.properties.etag });
      }
    } catch (error) {
      if (error instanceof CmsError) throw error;
      throw mapBlobError(error);
    }

    const pairs: ContentPair[] = [];
    for (const [key, files] of groups) {
      const [kindValue, year, basename] = key.split('\0');
      const kind = kindValue as 'blog' | 'page';
      const bodyExtension = kind === 'blog' ? 'md' : 'html';
      const bodyRef = files.get(bodyExtension);
      const metadataRef = files.get('json');
      if (!bodyRef || !metadataRef) {
        throw new CmsError('validation-failed', `Blob content "${basename}" is missing its matching body or JSON metadata.`, 400);
      }
      try {
        const [body, metadataSource] = await Promise.all([
          this.container.getBlockBlobClient(bodyRef.name).downloadToBuffer(),
          this.container.getBlockBlobClient(metadataRef.name).downloadToBuffer(),
        ]);
        let metadata: ParsedMetadata;
        try {
          metadata = parseMetadata(metadataSource.toString('utf8'), `Blob metadata ${basename}.json`);
        } catch (error) {
          throw new CmsError('validation-failed', error instanceof Error ? error.message : 'Blob metadata is invalid.', 400);
        }
        pairs.push({
          kind,
          basename,
          year,
          bodyName: bodyRef.name,
          metadataName: metadataRef.name,
          body: body.toString('utf8'),
          metadata,
          bodyETag: bodyRef.etag,
          metadataETag: metadataRef.etag,
        });
      } catch (error) {
        if (error instanceof CmsError) throw error;
        throw mapBlobError(error);
      }
    }
    return pairs;
  }

  private async writeNewPair(paths: PairPaths, body: string, metadata: string): Promise<void> {
    const bodyBlob = this.container.getBlockBlobClient(paths.bodyName);
    let bodyResult: { etag?: string };
    try {
      bodyResult = await bodyBlob.uploadData(Buffer.from(body), { conditions: { ifNoneMatch: '*' } });
    } catch (error) {
      throw mapBlobError(error);
    }

    try {
      await this.container.getBlockBlobClient(paths.metadataName).uploadData(Buffer.from(metadata), {
        conditions: { ifNoneMatch: '*' },
      });
    } catch (error) {
      try {
        await bodyBlob.deleteIfExists({ conditions: { ifMatch: bodyResult.etag } });
      } catch {
        throw new PartialContentWriteError(randomUUID());
      }
      throw mapBlobError(error);
    }
  }

  private async replacePair(existing: ContentPair, body: string, metadata: string): Promise<void> {
    const bodyBlob = this.container.getBlockBlobClient(existing.bodyName);
    const metadataBlob = this.container.getBlockBlobClient(existing.metadataName);
    let savedBody: { etag?: string };
    try {
      savedBody = await bodyBlob.uploadData(Buffer.from(body), { conditions: { ifMatch: existing.bodyETag } });
    } catch (error) {
      throw mapBlobError(error);
    }

    try {
      await metadataBlob.uploadData(Buffer.from(metadata), { conditions: { ifMatch: existing.metadataETag } });
    } catch (error) {
      try {
        await bodyBlob.uploadData(Buffer.from(existing.body), { conditions: { ifMatch: savedBody.etag } });
      } catch {
        throw new PartialContentWriteError(randomUUID());
      }
      throw mapBlobError(error);
    }
  }

  private async deletePair(pair: ContentPair): Promise<void> {
    try {
      await Promise.all([
        this.container.getBlockBlobClient(pair.bodyName).delete({ conditions: { ifMatch: pair.bodyETag } }),
        this.container.getBlockBlobClient(pair.metadataName).delete({ conditions: { ifMatch: pair.metadataETag } }),
      ]);
    } catch {
      throw new PartialContentWriteError(randomUUID());
    }
  }

  private pathsFor(kind: 'blog' | 'page', year: string, basename: string): PairPaths {
    const directory = `${this.contentPrefix}/${kind === 'blog' ? 'blog' : 'pages'}/${year}/${basename}`;
    return {
      bodyName: `${directory}.${kind === 'blog' ? 'md' : 'html'}`,
      metadataName: `${directory}.json`,
    };
  }

  private toSummary(pair: ContentPair, pairs: ContentPair[]): ContentEntrySummary {
    return {
      id: this.idFor(pair),
      kind: pair.kind,
      route: routeFor(pair, pairs),
      metadata: structuredClone(pair.metadata),
      version: hash(`${pair.bodyETag}\0${pair.metadataETag}`),
    };
  }

  private idFor(pair: ContentPair): string {
    return hash(JSON.stringify([this.contentPrefix, pair.kind, pair.year, pair.basename]));
  }
}

function normalizePrefix(prefix: string): string {
  const normalized = prefix.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.split('/').some(segment => !/^[a-zA-Z0-9_-]+$/.test(segment))) {
    throw new CmsError('configuration-invalid', 'The Blob content prefix is invalid.', 400);
  }
  return normalized;
}

function assertValidBasename(basename: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(basename)) {
    throw new CmsError('validation-failed', 'Content basenames must use lowercase letters, digits, and hyphens.', 400);
  }
  return basename;
}

function parseSubmittedMetadata(metadata: SaveBlogRequest['metadata']): ParsedMetadata {
  try {
    return parseMetadata(JSON.stringify(metadata), 'submitted content metadata');
  } catch (error) {
    throw new CmsError('validation-failed', error instanceof Error ? error.message : 'Content metadata is invalid.', 400);
  }
}

function assertExpectedVersion(id: string | undefined, expectedVersion: string | undefined, existing: ContentPair | undefined): void {
  if (id && !existing) throw new CmsError('not-found', 'The requested content entry no longer exists.', 404);
  if (existing && (!expectedVersion || expectedVersion !== hash(`${existing.bodyETag}\0${existing.metadataETag}`))) {
    throw new ContentVersionConflictError(hash(`${existing.bodyETag}\0${existing.metadataETag}`));
  }
  if (!existing && expectedVersion) throw new ContentVersionConflictError();
}

function routeFor(pair: ContentPair, pairs: ContentPair[]): string {
  if (pair.kind !== 'blog') return `/page/${pair.basename}`;
  const sameName = pairs.filter(candidate => candidate.kind === 'blog' && candidate.basename === pair.basename)
    .sort((left, right) => right.year.localeCompare(left.year));
  if (sameName.length <= 1 || sameName[0]?.year === pair.year) return `/blog/${pair.basename}`;
  return `/blog/${pair.year}/${pair.basename}`;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function mapBlobError(error: unknown): CmsError {
  if (error instanceof CmsError) return error;
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    if (error.statusCode === 404) return new CmsError('not-found', 'Blob content was not found.', 404);
    if (error.statusCode === 409 || error.statusCode === 412) return new ContentVersionConflictError();
  }
  return new CmsError('provider-unavailable', 'Azure Blob content storage is unavailable.', 502);
}