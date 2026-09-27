import { PageEntry, RepositoryView } from '@fullswing/content-model';

export interface PageRenderContext {
  metadata: PageEntry;
  repository: RepositoryView;
  escapeHtml: (value: string) => string;
}

export type PageRenderFunction = (context: PageRenderContext) => string;
