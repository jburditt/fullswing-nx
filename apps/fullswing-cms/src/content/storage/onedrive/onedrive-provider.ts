import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { parseMetadata, type ParsedMetadata } from '@fullswing/content-model';
import { CmsError, ContentVersionConflictError, PartialContentWriteError } from '../../domain/content-errors.js';
import type { BlogContent, ContentEntrySummary, PageContent } from '../../domain/content-entry.js';
import type { ContentStorageProvider, ProviderConfiguration, SaveBlogRequest } from '../content-storage-provider.js';
import { validateOneDriveConfiguration } from './onedrive-configuration.js';
import { mapGraphError } from './onedrive-errors.js';
import type { GraphDriveItem, OneDriveGraphGateway } from './onedrive-client.js';

interface OneDriveLocation {
  driveId: string;
  rootFolderId: string;
}

interface LocatedItem {
  item: GraphDriveItem;
  parentId: string;
}

interface ContentPair {
  kind: 'blog' | 'page';
  basename: string;
  markdown?: LocatedItem;
  html?: LocatedItem;
  metadata: LocatedItem;
  metadataSource?: string;
}

export class OneDriveContentStorageProvider implements ContentStorageProvider {
  readonly type = 'onedrive';

  constructor(
    private readonly graph: OneDriveGraphGateway,
    private readonly location: OneDriveLocation,
    private readonly configurationRevision: string,
  ) {}

  async validateConfiguration(configuration: ProviderConfiguration): Promise<void> {
    if (configuration.type !== this.type) {
      throw new CmsError('configuration-invalid', 'OneDrive requires a drive ID and root folder ID.', 400);
    }
    const location = await validateOneDriveConfiguration(configuration.settings, this.graph);
    if (location.driveId !== this.location.driveId || location.rootFolderId !== this.location.rootFolderId) {
      throw new CmsError('configuration-invalid', 'The OneDrive provider was initialized for different settings.', 400);
    }
  }

  async listEntries(): Promise<ContentEntrySummary[]> {
    const pairs = await this.discoverPairs();
    const entries = await Promise.all(pairs.map(async pair => this.toSummary(await this.loadMetadata(pair))));
    const routes = new Set<string>();
    for (const entry of entries) {
      if (routes.has(entry.route)) {
        throw new CmsError('validation-failed', `OneDrive contains duplicate content route "${entry.route}".`, 400);
      }
      routes.add(entry.route);
    }
    return entries.sort((left, right) => right.metadata.dateValue.getTime() - left.metadata.dateValue.getTime()
      || left.metadata.title.localeCompare(right.metadata.title));
  }

  async readBlog(id: string): Promise<BlogContent | undefined> {
    const pair = await this.findPairById(id);
    if (!pair || pair.kind !== 'blog' || !pair.markdown) return undefined;
    try {
      const [markdown, hydratedPair] = await Promise.all([
        this.graph.readText(this.location.driveId, pair.markdown.item.id),
        this.loadMetadata(pair),
      ]);
      return { ...this.toSummary(hydratedPair), kind: 'blog', markdown };
    } catch (error) {
      throw mapGraphError(error);
    }
  }

  async readPage(id: string): Promise<PageContent | undefined> {
    const pair = await this.findPairById(id);
    if (!pair || pair.kind !== 'page') return undefined;
    return this.toSummary(await this.loadMetadata(pair)) as PageContent;
  }

  async saveBlog(request: SaveBlogRequest): Promise<BlogContent> {
    if (request.configRevision !== this.configurationRevision) throw new ContentVersionConflictError();
    const basename = assertValidBasename(request.basename);
    let metadata: ParsedMetadata;
    try {
      metadata = parseMetadata(JSON.stringify(request.metadata), 'submitted blog metadata');
    } catch (error) {
      throw new CmsError('validation-failed', error instanceof Error ? error.message : 'Blog metadata is invalid.', 400);
    }

    let existing: ContentPair | undefined;
    let previousMarkdown: string | undefined;
    let previousMetadata: string | undefined;
    if (request.id) {
      existing = await this.findPairById(request.id);
      if (!existing || existing.kind !== 'blog' || !existing.markdown) {
        throw new CmsError('not-found', 'The requested blog entry no longer exists.', 404);
      }
      const current = this.toSummary(await this.loadMetadata(existing));
      if (!request.expectedVersion || request.expectedVersion !== current.version) {
        throw new ContentVersionConflictError(current.version);
      }
      try {
        [previousMarkdown, previousMetadata] = await Promise.all([
          this.graph.readText(this.location.driveId, existing.markdown.item.id),
          this.graph.readText(this.location.driveId, existing.metadata.item.id),
        ]);
      } catch (error) {
        throw mapGraphError(error);
      }
    } else if (request.expectedVersion) {
      throw new ContentVersionConflictError();
    }

    const entries = await this.listEntries();
    if (entries.some(entry => entry.id !== request.id && entry.route === `/blog/${basename}`)) {
      throw new CmsError('validation-failed', 'Another entry already uses this route.', 400);
    }

    if (!existing) {
      let markdownItem: GraphDriveItem;
      try {
        markdownItem = await this.graph.writeText(
          this.location.driveId, this.location.rootFolderId, `${basename}.md`, request.markdown,
        );
      } catch (error) {
        throw mapGraphError(error);
      }
      let metadataItem: GraphDriveItem;
      try {
        metadataItem = await this.graph.writeText(
          this.location.driveId, this.location.rootFolderId, `${basename}.json`, JSON.stringify(metadata, null, 2),
        );
      } catch (error) {
        try {
          await this.graph.deleteItem(this.location.driveId, markdownItem.id, markdownItem.eTag);
        } catch {
          throw new PartialContentWriteError(randomUUID());
        }
        throw mapGraphError(error);
      }
      const pair: ContentPair = {
        kind: 'blog',
        basename,
        markdown: { item: markdownItem, parentId: this.location.rootFolderId },
        metadata: { item: metadataItem, parentId: this.location.rootFolderId },
        metadataSource: JSON.stringify(metadata),
      };
      return { ...this.toSummary(pair), kind: 'blog', markdown: request.markdown };
    }

    const markdownLocation = existing.markdown;
    if (!markdownLocation) throw new CmsError('not-found', 'The requested blog entry no longer exists.', 404);
    const markdownItem = markdownLocation.item;
    const metadataItem = existing.metadata.item;
    if (!markdownItem.eTag || !metadataItem.eTag) throw new CmsError('provider-unavailable', 'OneDrive did not provide version tags for this content pair.', 502);
    let savedMarkdown: GraphDriveItem;
    try {
      savedMarkdown = await this.graph.writeText(
        this.location.driveId,
        markdownLocation.parentId,
        markdownItem.name,
        request.markdown,
        { itemId: markdownItem.id, expectedETag: markdownItem.eTag },
      );
    } catch (error) {
      throw mapGraphError(error);
    }
    let savedMetadata: GraphDriveItem;
    try {
      savedMetadata = await this.graph.writeText(
        this.location.driveId,
        existing.metadata.parentId,
        metadataItem.name,
        JSON.stringify(metadata, null, 2),
        { itemId: metadataItem.id, expectedETag: metadataItem.eTag },
      );
    } catch (error) {
      const mappedError = mapGraphError(error);
      let compensationFailed = false;
      let metadataMayHaveChanged = false;
      if (!(mappedError instanceof ContentVersionConflictError)) {
        try {
          const currentItems = await this.graph.listChildren(this.location.driveId, existing.metadata.parentId);
          const currentMetadata = currentItems.find(item => item.id === metadataItem.id);
          metadataMayHaveChanged = currentMetadata?.eTag !== metadataItem.eTag;
        } catch {
          metadataMayHaveChanged = true;
        }
      }
      try {
        await this.graph.writeText(
          this.location.driveId,
          markdownLocation.parentId,
          markdownItem.name,
          previousMarkdown!,
          { itemId: savedMarkdown.id, expectedETag: savedMarkdown.eTag },
        );
      } catch {
        compensationFailed = true;
      }
      if (compensationFailed || metadataMayHaveChanged) {
        throw new PartialContentWriteError(randomUUID());
      }
      throw mappedError;
    }
    const pair: ContentPair = {
      ...existing,
      markdown: { item: savedMarkdown, parentId: markdownLocation.parentId },
      metadata: { item: savedMetadata, parentId: existing.metadata.parentId },
      metadataSource: JSON.stringify(metadata),
    };
    return { ...this.toSummary(pair), kind: 'blog', markdown: request.markdown };
  }

  private async discoverPairs(): Promise<ContentPair[]> {
    const allFiles: LocatedItem[] = [];
    const pendingFolders = [this.location.rootFolderId];
    const visitedFolders = new Set<string>();
    try {
      while (pendingFolders.length > 0) {
        const parentId = pendingFolders.pop()!;
        if (visitedFolders.has(parentId)) continue;
        visitedFolders.add(parentId);
        const children = await this.graph.listChildren(this.location.driveId, parentId);
        for (const item of children) {
          if (item.folder) pendingFolders.push(item.id);
          else if (item.file) allFiles.push({ item, parentId });
        }
      }
    } catch (error) {
      throw mapGraphError(error);
    }

    const groups = new Map<string, Map<string, LocatedItem>>();
    for (const located of allFiles) {
      const match = /^(.*)\.(md|html|json)$/i.exec(located.item.name);
      if (!match || !match[1]) continue;
      const groupKey = `${located.parentId}\0${match[1]}`;
      let group = groups.get(groupKey);
      if (!group) groups.set(groupKey, group = new Map());
      const extension = match[2].toLowerCase();
      if (group.has(extension)) {
        throw new CmsError('validation-failed', `OneDrive contains duplicate ${match[1]}.${extension} files in one folder.`, 400);
      }
      group.set(extension, located);
    }

    const pairs: ContentPair[] = [];
    for (const [groupKey, files] of groups) {
      const [parentId, basename] = groupKey.split('\0');
      const markdown = files.get('md');
      const html = files.get('html');
      const metadata = files.get('json');
      if (!metadata && (markdown || html)) {
        throw new CmsError('validation-failed', `OneDrive content "${basename}" is missing same-basename JSON metadata.`, 400);
      }
      if (metadata && (markdown || html)) {
        if (markdown && html) {
          throw new CmsError('validation-failed', `OneDrive content "${basename}" has both Markdown and HTML bodies.`, 400);
        }
        pairs.push({ kind: markdown ? 'blog' : 'page', basename, markdown, html, metadata });
      } else if (metadata) {
        throw new CmsError('validation-failed', `OneDrive metadata "${basename}.json" is missing its same-basename content file.`, 400);
      }
      void parentId;
    }
    return pairs;
  }

  private async findPairById(id: string): Promise<ContentPair | undefined> {
    const pairs = await this.discoverPairs();
    return pairs.find(pair => this.encodeId(pair) === id);
  }

  private async loadMetadata(pair: ContentPair): Promise<ContentPair> {
    try {
      return { ...pair, metadataSource: await this.graph.readText(this.location.driveId, pair.metadata.item.id) };
    } catch (error) {
      throw mapGraphError(error);
    }
  }

  private toSummary(pair: ContentPair): ContentEntrySummary {
    const bodyItem = pair.markdown?.item ?? pair.html?.item;
    if (!bodyItem?.eTag || !pair.metadata.item.eTag) {
      throw new CmsError('provider-unavailable', 'OneDrive did not provide version tags for this content pair.', 502);
    }
    let metadata: ParsedMetadata;
    try {
      metadata = parseMetadata(
        this.readMetadataSource(pair),
        `OneDrive item ${pair.metadata.item.name}`,
      );
    } catch (error) {
      if (error instanceof CmsError) throw error;
      throw new CmsError('validation-failed', error instanceof Error ? error.message : 'OneDrive metadata is invalid.', 400);
    }
    return {
      id: this.encodeId(pair),
      kind: pair.kind,
      route: `/${pair.kind}/${pair.basename}`,
      metadata,
      version: encodeVersion(pair),
    };
  }

  private readMetadataSource(pair: ContentPair): string {
    const source = pair.metadataSource;
    if (typeof source !== 'string') {
      throw new CmsError('provider-unavailable', `Metadata for ${pair.metadata.item.name} was not loaded.`, 502);
    }
    return source;
  }

  private encodeId(pair: ContentPair): string {
    return fingerprint(JSON.stringify([
      this.location.driveId,
      pair.markdown?.item.id,
      pair.html?.item.id,
      pair.metadata.item.id,
      pair.markdown?.parentId ?? pair.html?.parentId ?? pair.metadata.parentId,
      pair.basename,
      pair.kind,
    ]));
  }
}

function encodeVersion(pair: ContentPair): string {
  return fingerprint(JSON.stringify([
    pair.markdown?.item.eTag ?? pair.html?.item.eTag ?? '',
    pair.metadata.item.eTag ?? '',
  ]));
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function assertValidBasename(basename: string): string {
  if (!basename || basename === '.' || basename === '..' || /[/?#\\\s]/.test(basename)) {
    throw new CmsError('validation-failed', 'Use a basename without spaces or nested paths.', 400);
  }
  return basename;
}