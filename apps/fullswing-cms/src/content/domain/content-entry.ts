import type { ParsedMetadata } from '@fullswing/content-model';

export type ContentKind = 'blog' | 'page';

export interface ContentEntrySummary {
  id: string;
  kind: ContentKind;
  route: string;
  metadata: ParsedMetadata;
  version: string;
}

export interface BlogContent extends ContentEntrySummary {
  kind: 'blog';
  markdown: string;
}

export interface PageContent extends ContentEntrySummary {
  kind: 'page';
  html?: string;
}

export type CmsContentEntry = BlogContent | PageContent;

export interface SaveBlogInput {
  id?: string;
  expectedVersion?: string;
  configRevision: string;
  markdown: string;
  metadata: ParsedMetadata;
}