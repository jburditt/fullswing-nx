import { parseMetadata } from '@fullswing/content-model';
import { CmsError, ContentVersionConflictError } from '../domain/content-errors.js';
import type { BlogContent, CmsContentEntry, ContentEntrySummary, PageContent } from '../domain/content-entry.js';
import type { ContentStorageProvider, ProviderConfiguration, SaveBlogRequest } from './content-storage-provider.js';

export interface DemoContentState {
  entries: Map<string, CmsContentEntry>;
  nextVersion: number;
}

export function createDemoContentState(): DemoContentState {
  const entries = new Map<string, CmsContentEntry>();
  const seeds: Array<{ id: string; kind: 'blog' | 'page'; title: string; date: string; categories: string[]; markdown?: string }> = [
    {
      id: 'welcome-to-fullswing',
      kind: 'blog',
      title: 'Welcome to Fullswing',
      date: '2026-09-20',
      categories: ['Announcements'],
      markdown: '# Welcome to Fullswing\n\nThis sample draft is ready to edit in the CMS.\n',
    },
    {
      id: 'markdown-editor-demo',
      kind: 'blog',
      title: 'Markdown editor demo',
      date: '2026-09-12',
      categories: ['Guides', 'Markdown'],
      markdown: '# Markdown editor demo\n\nTry editing this post, previewing it, then saving your changes.\n\n- Headings\n- Lists\n- **Emphasis**\n',
    },
    {
      id: 'sample-page',
      kind: 'page',
      title: 'Sample page',
      date: '2026-09-01',
      categories: ['Pages'],
    },
  ];

  for (const [index, seed] of seeds.entries()) {
    const metadata = parseMetadata(JSON.stringify({
      title: seed.title,
      author: 'Fullswing Team',
      date: seed.date,
      categories: seed.categories,
    }), 'local demo content');
    const version = `demo-v${index + 1}`;
    const route = `/${seed.kind}/${seed.id}`;
    if (seed.kind === 'blog') {
      entries.set(seed.id, { id: seed.id, kind: 'blog', route, metadata, markdown: seed.markdown!, version });
    } else {
      entries.set(seed.id, { id: seed.id, kind: 'page', route, metadata, version });
    }
  }

  return { entries, nextVersion: seeds.length };
}

export class DemoContentStorageProvider implements ContentStorageProvider {
  readonly type = 'demo';

  constructor(
    private readonly configurationRevision: string,
    private readonly state: DemoContentState,
  ) {}

  async validateConfiguration(configuration: ProviderConfiguration): Promise<void> {
    if (configuration.type !== this.type) {
      throw new CmsError('configuration-invalid', 'The local demo provider is not selected.', 400);
    }
  }

  async listEntries(): Promise<ContentEntrySummary[]> {
    return [...this.state.entries.values()]
      .map(entry => ({ id: entry.id, kind: entry.kind, route: entry.route, metadata: structuredClone(entry.metadata), version: entry.version }))
      .sort((left, right) => right.metadata.dateValue.getTime() - left.metadata.dateValue.getTime()
        || left.metadata.title.localeCompare(right.metadata.title));
  }

  async readBlog(id: string): Promise<BlogContent | undefined> {
    const entry = this.state.entries.get(id);
    return entry?.kind === 'blog' ? structuredClone(entry) : undefined;
  }

  async readPage(id: string): Promise<PageContent | undefined> {
    const entry = this.state.entries.get(id);
    return entry?.kind === 'page' ? structuredClone(entry) : undefined;
  }

  async saveBlog(request: SaveBlogRequest): Promise<BlogContent> {
    if (request.configRevision !== this.configurationRevision) throw new ContentVersionConflictError();

    const basenameMatch = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.exec(request.basename);
    if (!basenameMatch) {
      throw new CmsError('validation-failed', 'Blog basenames must use lowercase letters, digits, and hyphens.', 400);
    }

    let metadata;
    try {
      metadata = parseMetadata(JSON.stringify(request.metadata), 'submitted blog metadata');
    } catch (error) {
      throw new CmsError('validation-failed', error instanceof Error ? error.message : 'Blog metadata is invalid.', 400);
    }

    const existing = request.id ? this.state.entries.get(request.id) : undefined;
    if (request.id && (!existing || existing.kind !== 'blog')) {
      throw new CmsError('not-found', 'The requested blog entry no longer exists.', 404);
    }
    if (existing && (!request.expectedVersion || request.expectedVersion !== existing.version)) {
      throw new ContentVersionConflictError(existing.version);
    }
    if (!existing && request.expectedVersion) throw new ContentVersionConflictError();

    const id = existing?.id ?? request.basename;
    const route = `/blog/${id}`;
    if ([...this.state.entries.values()].some(entry => entry.id !== id && entry.route === route)) {
      throw new CmsError('validation-failed', 'Another entry already uses this route.', 400);
    }

    const saved: BlogContent = {
      id,
      kind: 'blog',
      route,
      metadata,
      markdown: request.markdown,
      version: `demo-v${++this.state.nextVersion}`,
    };
    this.state.entries.set(id, structuredClone(saved));
    return structuredClone(saved);
  }
}