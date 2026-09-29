import type { FastifyInstance } from 'fastify';
import { CmsError } from '../../content/domain/content-errors.js';
import type { ContentStorageProvider } from '../../content/storage/content-storage-provider.js';
import type { ProviderResolutionContext } from '../../content/storage/provider-registry.js';
import { renderPageList, renderPagePlaceholder } from '../../views/page-placeholder.js';

export interface PageRouteDependencies {
  resolveContentProvider(context?: ProviderResolutionContext): Promise<ContentStorageProvider>;
}

export function registerPageRoutes(app: FastifyInstance, dependencies: PageRouteDependencies): void {
  app.get('/pages', async (request, reply) => {
    const provider = await dependencies.resolveContentProvider({
      tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '',
    });
    const entries = await provider.listEntries();
    return reply.type('text/html; charset=utf-8').send(renderPageList(entries, request.cmsSession?.csrfToken ?? ''));
  });

  app.get('/pages/new', async (request, reply) => {
    return reply.type('text/html; charset=utf-8').send(renderPagePlaceholder(undefined, request.cmsSession?.csrfToken ?? ''));
  });

  app.get<{ Params: { id: string } }>('/pages/:id', async (request, reply) => {
    const provider = await dependencies.resolveContentProvider({
      tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '',
    });
    const page = await provider.readPage(request.params.id);
    if (!page) throw new CmsError('not-found', 'The requested page was not found.', 404);
    return reply.type('text/html; charset=utf-8').send(renderPagePlaceholder(page, request.cmsSession?.csrfToken ?? ''));
  });
}