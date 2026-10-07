import type { FastifyInstance } from 'fastify';
import { filterContentEntries, paginateEntries } from '../../content/application/list-content.js';
import { parseDashboardQuery } from '../../content/application/content-filters.js';
import type { ContentStorageProvider } from '../../content/storage/content-storage-provider.js';
import type { ProviderResolutionContext } from '../../content/storage/provider-registry.js';
import { renderDashboardPage } from '../../views/dashboard.js';

export interface DashboardRouteDependencies {
  isConfigured(): Promise<boolean>;
  resolveContentProvider(context?: ProviderResolutionContext): Promise<ContentStorageProvider>;
}

export function registerDashboardRoutes(
  app: FastifyInstance,
  dependencies: DashboardRouteDependencies,
): void {
  app.get('/dashboard', async (request, reply) => {
    if (!await dependencies.isConfigured()) {
      return reply.redirect('/configuration?setup=required', 303);
    }

    const parsed = parseDashboardQuery(request.query as Record<string, unknown>);
    const provider = await dependencies.resolveContentProvider({
      tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '',
    });
    const allEntries = await provider.listEntries();
    const filteredEntries = filterContentEntries(allEntries, parsed.filters);
    const page = paginateEntries(filteredEntries, parsed.pagination);

    return reply.type('text/html; charset=utf-8').send(renderDashboardPage({
      page,
      filters: parsed.filters,
      csrfToken: request.cmsSession?.csrfToken ?? '',
    }));
  });
}