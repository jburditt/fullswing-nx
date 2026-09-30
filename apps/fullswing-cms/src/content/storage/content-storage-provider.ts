import type { ContentMetadata } from '@fullswing/content-model';
import type { BlogContent, ContentEntrySummary, PageContent } from '../domain/content-entry.js';

export interface ProviderConfiguration {
  type: string;
  revision: string;
  settings: Readonly<Record<string, unknown>>;
}

export interface SaveBlogRequest {
  id?: string;
  basename: string;
  expectedVersion?: string;
  configRevision: string;
  markdown: string;
  metadata: ContentMetadata;
}

export interface SavePageRequest {
  id?: string;
  basename: string;
  expectedVersion?: string;
  configRevision: string;
  html: string;
  metadata: ContentMetadata;
}

export interface ContentStorageProvider {
  readonly type: string;
  validateConfiguration(configuration: ProviderConfiguration): Promise<void>;
  listEntries(): Promise<ContentEntrySummary[]>;
  readBlog(id: string): Promise<BlogContent | undefined>;
  readPage(id: string): Promise<PageContent | undefined>;
  saveBlog(request: SaveBlogRequest): Promise<BlogContent>;
  savePage?(request: SavePageRequest): Promise<PageContent>;
}