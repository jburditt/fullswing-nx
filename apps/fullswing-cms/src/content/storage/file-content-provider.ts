import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseMetadata, type ParsedMetadata } from '@fullswing/content-model';
import { CmsError, ContentVersionConflictError, PartialContentWriteError } from '../domain/content-errors.js';
import type { BlogContent, ContentEntrySummary, PageContent } from '../domain/content-entry.js';
import type { ContentStorageProvider, ProviderConfiguration, SaveBlogRequest, SavePageRequest } from './content-storage-provider.js';

interface FilePair {
  kind: 'blog' | 'page';
  basename: string;
  year: string;
  bodyPath: string;
  metadataPath: string;
  body: string;
  metadata: ParsedMetadata;
  version: string;
}

export class FileContentStorageProvider implements ContentStorageProvider {
  readonly type = 'file';
  private readonly publicDirectory: string;

  constructor(publicDirectory: string, private readonly configurationRevision: string) {
    this.publicDirectory = resolve(publicDirectory);
  }

  async validateConfiguration(configuration: ProviderConfiguration): Promise<void> {
    if (configuration.type !== this.type) {
      throw new CmsError('configuration-invalid', 'Local file storage requires a public directory.', 400);
    }
    const directory = configuration.settings.publicDirectory;
    if (typeof directory !== 'string' || !directory.trim() || resolve(directory) !== this.publicDirectory) {
      throw new CmsError('configuration-invalid', 'Enter a valid website public directory.', 400);
    }
    try {
      if (!(await stat(this.publicDirectory)).isDirectory()) throw new Error('not a directory');
      await access(this.publicDirectory, 2);
    } catch {
      throw new CmsError('configuration-invalid', 'The website public directory must exist and be writable.', 400);
    }
  }

  async listEntries(): Promise<ContentEntrySummary[]> {
    const pairs = await this.discoverPairs();
    const entries = pairs.map(pair => this.toSummary(pair, pairs));
    const routes = new Set<string>();
    for (const entry of entries) {
      if (routes.has(entry.route)) {
        throw new CmsError('validation-failed', `Local files contain duplicate content route "${entry.route}".`, 400);
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
    const basename = assertValidBasename(request.basename);
    const metadata = parseSubmittedMetadata(request.metadata);
    const existing = request.id
      ? (await this.discoverPairs()).find(pair => pair.kind === 'blog' && this.idFor(pair) === request.id)
      : undefined;
    this.assertExpectedVersion(request.id, request.expectedVersion, existing);

    const targetDirectory = join(this.publicDirectory, 'blog', metadata.date.slice(0, 4));
    const target = pairPaths(targetDirectory, basename, '.md');
    await this.assertTargetAvailable('blog', basename, metadata.date.slice(0, 4), request.id);
    await this.persistPair(target.bodyPath, request.markdown, target.metadataPath, JSON.stringify(request.metadata, null, 2),
      existing ? target.bodyPath === existing.bodyPath : false);
    await this.removePreviousPair(existing, target.bodyPath, target.metadataPath);

    const pairs = await this.discoverPairs();
    const saved = pairs.find(pair => pair.bodyPath === target.bodyPath);
    if (!saved) throw new CmsError('provider-unavailable', 'The saved blog could not be read back.', 502);
    return { ...this.toSummary(saved, pairs), kind: 'blog', markdown: request.markdown };
  }

  async savePage(request: SavePageRequest): Promise<PageContent> {
    if (request.configRevision !== this.configurationRevision) throw new ContentVersionConflictError();
    const basename = assertValidBasename(request.basename);
    const metadata = parseSubmittedMetadata(request.metadata);
    const existing = request.id
      ? (await this.discoverPairs()).find(pair => pair.kind === 'page' && this.idFor(pair) === request.id)
      : undefined;
    this.assertExpectedVersion(request.id, request.expectedVersion, existing);

    const targetDirectory = join(this.publicDirectory, 'pages', metadata.date.slice(0, 4));
    const target = pairPaths(targetDirectory, basename, '.html');
    await this.assertTargetAvailable('page', basename, metadata.date.slice(0, 4), request.id);
    await this.persistPair(target.bodyPath, request.html, target.metadataPath, JSON.stringify(request.metadata, null, 2),
      existing ? target.bodyPath === existing.bodyPath : false);
    await this.removePreviousPair(existing, target.bodyPath, target.metadataPath);

    const pairs = await this.discoverPairs();
    const saved = pairs.find(pair => pair.bodyPath === target.bodyPath);
    if (!saved) throw new CmsError('provider-unavailable', 'The saved page could not be read back.', 502);
    return { ...this.toSummary(saved, pairs), kind: 'page', html: request.html };
  }

  private async discoverPairs(): Promise<FilePair[]> {
    const pairs = [
      ...await this.discoverKind('blog', '.md'),
      ...await this.discoverKind('page', '.html'),
    ];
    return pairs;
  }

  private async discoverKind(kind: FilePair['kind'], bodyExtension: '.md' | '.html'): Promise<FilePair[]> {
    const kindDirectory = join(this.publicDirectory, kind === 'blog' ? 'blog' : 'pages');
    let years;
    try {
      years = await readdir(kindDirectory, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return [];
      throw mapFileError(error);
    }

    const pairs: FilePair[] = [];
    for (const yearEntry of years) {
      if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;
      const yearDirectory = join(kindDirectory, yearEntry.name);
      let files;
      try {
        files = await readdir(yearDirectory, { withFileTypes: true });
      } catch (error) {
        throw mapFileError(error);
      }
      const names = new Set(files.filter(file => file.isFile()).map(file => file.name));
      const basenames = new Set<string>();
      for (const name of names) {
        if (name.endsWith(bodyExtension)) basenames.add(name.slice(0, -bodyExtension.length));
        if (name.endsWith('.json')) basenames.add(name.slice(0, -'.json'.length));
      }
      for (const basename of basenames) {
        const bodyPath = join(yearDirectory, `${basename}${bodyExtension}`);
        const metadataPath = join(yearDirectory, `${basename}.json`);
        if (!names.has(`${basename}${bodyExtension}`) || !names.has(`${basename}.json`)) {
          throw new CmsError('validation-failed', `Local ${kind} content "${basename}" is missing its matching ${bodyExtension} or JSON file.`, 400);
        }
        try {
          const [body, metadataSource] = await Promise.all([readFile(bodyPath, 'utf8'), readFile(metadataPath, 'utf8')]);
          const metadata = parseMetadata(metadataSource, `local ${kind} metadata ${basename}.json`);
          pairs.push(this.createPair(kind, basename, yearEntry.name, bodyPath, metadataPath, body, metadata));
        } catch (error) {
          if (error instanceof CmsError) throw error;
          throw new CmsError('validation-failed', error instanceof Error ? error.message : 'Local content is invalid.', 400);
        }
      }
    }
    return pairs;
  }

  private createPair(
    kind: FilePair['kind'], basename: string, year: string, bodyPath: string, metadataPath: string,
    body: string, metadata: ParsedMetadata,
  ): FilePair {
    return {
      kind, basename, year, bodyPath, metadataPath, body, metadata,
      version: hash(`${body}\0${JSON.stringify(metadata)}`),
    };
  }

  private toSummary(pair: FilePair, pairs: FilePair[]): ContentEntrySummary {
    return {
      id: this.idFor(pair),
      kind: pair.kind,
      route: this.routeFor(pair, pairs),
      metadata: structuredClone(pair.metadata),
      version: pair.version,
    };
  }

  private idFor(pair: FilePair): string {
    return hash(JSON.stringify([pair.kind, pair.year, pair.basename]));
  }

  private routeFor(pair: FilePair, pairs: FilePair[]): string {
    if (pair.kind !== 'blog') return `/page/${pair.basename}`;
    const sameName = pairs.filter(candidate => candidate.kind === 'blog' && candidate.basename === pair.basename)
      .sort((left, right) => right.year.localeCompare(left.year));
    if (sameName.length <= 1 || sameName[0].year === pair.year) return `/blog/${pair.basename}`;
    return `/blog/${pair.year}/${pair.basename}`;
  }

  private assertExpectedVersion(id: string | undefined, expectedVersion: string | undefined, existing: FilePair | undefined): void {
    if (id && !existing) throw new CmsError('not-found', 'The requested content entry no longer exists.', 404);
    if (existing && (!expectedVersion || expectedVersion !== existing.version)) {
      throw new ContentVersionConflictError(existing.version);
    }
    if (!existing && expectedVersion) throw new ContentVersionConflictError();
  }

  private async assertTargetAvailable(kind: FilePair['kind'], basename: string, year: string, id: string | undefined): Promise<void> {
    const pairs = await this.discoverPairs();
    if (pairs.some(pair => pair.kind === kind && pair.basename === basename && this.idFor(pair) !== id
      && (kind === 'page' || pair.year === year))) {
      throw new CmsError('validation-failed', 'Another entry already uses this route.', 400);
    }
  }

  private async persistPair(
    bodyPath: string, body: string, metadataPath: string, metadata: string, replace: boolean,
  ): Promise<void> {
    await mkdir(dirname(bodyPath), { recursive: true });
    const files = [{ path: bodyPath, content: body }, { path: metadataPath, content: metadata }];
    const temporaryPaths = files.map(file => `${file.path}.${randomUUID()}.tmp`);
    const previousContents: Array<string | undefined> = [];
    let replacedCount = 0;
    try {
      for (const file of files) {
        try {
          previousContents.push(replace ? await readFile(file.path, 'utf8') : undefined);
        } catch (error) {
          if (!replace || !isMissing(error)) throw error;
          previousContents.push(undefined);
        }
      }
      await Promise.all(files.map((file, index) => writeFile(temporaryPaths[index], file.content, 'utf8')));
      for (const [index, file] of files.entries()) {
        await rename(temporaryPaths[index], file.path);
        replacedCount += 1;
      }
    } catch (error) {
      let rollbackFailed = false;
      for (let index = 0; index < replacedCount; index += 1) {
        try {
          if (previousContents[index] === undefined) await rm(files[index].path, { force: true });
          else await writeFile(files[index].path, previousContents[index]!, 'utf8');
        } catch {
          rollbackFailed = true;
        }
      }
      await Promise.all(temporaryPaths.map(path => rm(path, { force: true }).catch(() => undefined)));
      if (rollbackFailed) throw new PartialContentWriteError(randomUUID());
      throw mapFileError(error);
    }
  }

  private async removePreviousPair(existing: FilePair | undefined, bodyPath: string, metadataPath: string): Promise<void> {
    if (!existing || (existing.bodyPath === bodyPath && existing.metadataPath === metadataPath)) return;
    try {
      await rm(existing.bodyPath);
      await rm(existing.metadataPath);
    } catch {
      throw new PartialContentWriteError(randomUUID());
    }
  }
}

function pairPaths(directory: string, basename: string, bodyExtension: '.md' | '.html') {
  return {
    bodyPath: join(directory, `${basename}${bodyExtension}`),
    metadataPath: join(directory, `${basename}.json`),
  };
}

function parseSubmittedMetadata(metadata: SaveBlogRequest['metadata']): ParsedMetadata {
  try {
    return parseMetadata(JSON.stringify(metadata), 'submitted content metadata');
  } catch (error) {
    throw new CmsError('validation-failed', error instanceof Error ? error.message : 'Content metadata is invalid.', 400);
  }
}

function assertValidBasename(basename: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(basename)) {
    throw new CmsError('validation-failed', 'Content basenames must use lowercase letters, digits, and hyphens.', 400);
  }
  return basename;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function isMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}

function mapFileError(error: unknown): CmsError {
  if (error instanceof CmsError) return error;
  return new CmsError('provider-unavailable', 'Local content storage is unavailable.', 502);
}