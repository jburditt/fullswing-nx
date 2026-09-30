import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CmsError } from '../../content/domain/content-errors.js';
import type { ContentStorageProvider } from '../../content/storage/content-storage-provider.js';
import type { ProviderResolutionContext } from '../../content/storage/provider-registry.js';
import { renderPageEditor, renderPageList, renderPagePlaceholder, type PageEditorValues } from '../../views/page-placeholder.js';

export interface PageRouteDependencies {
  resolveContentProvider(context?: ProviderResolutionContext): Promise<ContentStorageProvider>;
  getConfigRevision(): Promise<string>;
}

function field(body: unknown, name: string): string {
  if (!body || typeof body !== 'object') return '';
  const value = (body as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : '';
}

function pageValues(body: unknown, configRevision: string, id?: string, page?: Awaited<ReturnType<ContentStorageProvider['readPage']>>): PageEditorValues {
  const submitted = !!body && typeof body === 'object';
  return {
    id,
    basename: submitted ? field(body, 'basename') : page?.route.split('/').at(-1) ?? 'new-page',
    title: submitted ? field(body, 'title') : page?.metadata.title ?? '',
    author: submitted ? field(body, 'author') : page?.metadata.author ?? '',
    date: submitted ? field(body, 'date') : page?.metadata.date ?? new Date().toISOString().slice(0, 10),
    categories: submitted ? field(body, 'categories') : page?.metadata.categories.join(', ') ?? '',
    html: submitted ? field(body, 'html') : page?.html ?? '',
    expectedVersion: submitted ? field(body, 'expectedVersion') : page?.version ?? '',
    configRevision: submitted ? field(body, 'configRevision') : configRevision,
  };
}

function parsePageMetadata(values: PageEditorValues) {
  return {
    title: values.title.trim(),
    author: values.author.trim(),
    date: values.date,
    categories: values.categories.split(',').map(category => category.trim()).filter(Boolean),
  };
}

export function registerPageRoutes(app: FastifyInstance, dependencies: PageRouteDependencies): void {
  app.get('/pages', async (request, reply) => {
    const provider = await dependencies.resolveContentProvider({
      tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '',
    });
    const entries = await provider.listEntries();
    return reply.type('text/html; charset=utf-8').send(renderPageList(entries, request.cmsSession?.csrfToken ?? '', !!provider.savePage));
  });

  app.get('/pages/new', async (request, reply) => {
    const provider = await dependencies.resolveContentProvider({ tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '' });
    if (!provider.savePage) {
      return reply.type('text/html; charset=utf-8').send(renderPagePlaceholder(undefined, request.cmsSession?.csrfToken ?? ''));
    }
    return reply.type('text/html; charset=utf-8').send(renderPageEditor(
      pageValues(undefined, await dependencies.getConfigRevision()), request.cmsSession?.csrfToken ?? '',
    ));
  });

  app.get<{ Params: { id: string } }>('/pages/:id', async (request, reply) => {
    const provider = await dependencies.resolveContentProvider({
      tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '',
    });
    const page = await provider.readPage(request.params.id);
    if (!page) throw new CmsError('not-found', 'The requested page was not found.', 404);
    if (provider.savePage && typeof page.html === 'string') {
      return reply.type('text/html; charset=utf-8').send(renderPageEditor(
        pageValues(undefined, await dependencies.getConfigRevision(), page.id, page), request.cmsSession?.csrfToken ?? '',
      ));
    }
    return reply.type('text/html; charset=utf-8').send(renderPagePlaceholder(page, request.cmsSession?.csrfToken ?? ''));
  });

  const handleSave = async (request: FastifyRequest, reply: FastifyReply, id?: string) => {
    const provider = await dependencies.resolveContentProvider({ tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '' });
    if (!provider.savePage) throw new CmsError('provider-unavailable', 'HTML pages cannot be saved with the selected provider.', 501);
    const currentRevision = await dependencies.getConfigRevision();
    const values = pageValues(request.body, currentRevision, id);
    if (values.configRevision !== currentRevision) {
      throw new CmsError('configuration-conflict', 'Configuration changed while this page was open. Reload it before saving.', 409);
    }
    const saved = await provider.savePage({
      id,
      basename: values.basename,
      expectedVersion: values.expectedVersion || undefined,
      configRevision: values.configRevision,
      html: values.html,
      metadata: parsePageMetadata(values),
    });
    return reply.redirect(`/pages/${encodeURIComponent(saved.id)}`, 303);
  };

  app.post('/pages', async (request, reply) => handleSave(request, reply));
  app.post<{ Params: { id: string } }>('/pages/:id', async (request, reply) => handleSave(request, reply, request.params.id));
}