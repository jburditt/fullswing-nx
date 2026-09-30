import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ContentVersionConflictError, CmsError, ValidationError } from '../../content/domain/content-errors.js';
import type { ContentStorageProvider } from '../../content/storage/content-storage-provider.js';
import type { ProviderResolutionContext } from '../../content/storage/provider-registry.js';
import { validateBlogDraft, type BlogDraftForm } from '../../content/application/validate-blog-draft.js';
import { renderSafeMarkdownPreview } from '../../content/application/preview-markdown.js';
import { renderBlogEditor, type BlogEditorValues } from '../../views/blog-editor.js';

export interface BlogEditorRouteDependencies {
  resolveContentProvider(context?: ProviderResolutionContext): Promise<ContentStorageProvider>;
  getConfigRevision(): Promise<string>;
}

interface BlogRouteParams {
  id: string;
}

interface FormBody extends BlogDraftForm {
  intent?: unknown;
}

function formText(body: unknown, field: keyof BlogEditorValues): string {
  if (!body || typeof body !== 'object' || !(field in body)) {
    return '';
  }
  const value = (body as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : '';
}

function readValues(body: unknown, id?: string): BlogEditorValues {
  return {
    id,
    basename: formText(body, 'basename'),
    title: formText(body, 'title'),
    author: formText(body, 'author'),
    date: formText(body, 'date'),
    categories: formText(body, 'categories'),
    markdown: formText(body, 'markdown'),
    expectedVersion: formText(body, 'expectedVersion'),
    configRevision: formText(body, 'configRevision'),
  };
}

function initialValues(configRevision: string, id?: string, entry?: Awaited<ReturnType<ContentStorageProvider['readBlog']>>): BlogEditorValues {
  const date = new Date().toISOString().slice(0, 10);
  return {
    id,
    basename: entry ? entry.route.slice('/blog/'.length) : (id ?? 'new-post'),
    title: entry?.metadata.title ?? '',
    author: entry?.metadata.author ?? '',
    date: entry?.metadata.date ?? date,
    categories: entry?.metadata.categories.join(', ') ?? '',
    markdown: entry?.markdown ?? '',
    expectedVersion: entry?.version ?? '',
    configRevision,
  };
}

function renderIssuePage(
  reply: FastifyReply,
  values: BlogEditorValues,
  csrfToken: string,
  issues: ValidationError['issues'],
): unknown {
  return reply.code(400).type('text/html; charset=utf-8').send(renderBlogEditor({
    values,
    csrfToken,
    mode: 'edit',
    issues,
  }));
}

export function registerBlogEditorRoutes(
  app: FastifyInstance,
  dependencies: BlogEditorRouteDependencies,
): void {
  app.get('/blogs/new', async (request, reply) => {
    const configRevision = await dependencies.getConfigRevision();
    const values = initialValues(configRevision);
    return reply.type('text/html; charset=utf-8').send(renderBlogEditor({
      values,
      csrfToken: request.cmsSession?.csrfToken ?? '',
      mode: 'edit',
      statusMessage: 'Enter a draft and choose Preview to validate it.',
    }));
  });

  app.get<{ Params: BlogRouteParams }>('/blogs/:id/edit', async (request, reply) => {
    const provider = await dependencies.resolveContentProvider({
      tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '',
    });
    const entry = await provider.readBlog(request.params.id);
    if (!entry) {
      throw new CmsError('not-found', 'The requested blog was not found.', 404);
    }
    const values = initialValues(await dependencies.getConfigRevision(), entry.id, entry);
    return reply.type('text/html; charset=utf-8').send(renderBlogEditor({
      values,
      csrfToken: request.cmsSession?.csrfToken ?? '',
      mode: 'edit',
      previewHtml: values.markdown.trim() ? await renderSafeMarkdownPreview(values.markdown) : undefined,
      statusMessage: new URL(request.url, 'http://localhost').searchParams.has('saved')
        ? 'Blog saved.'
        : 'Edit the draft and choose Preview to validate it.',
    }));
  });

  const handleSave = async (
    request: FastifyRequest,
    reply: FastifyReply,
    id?: string,
  ): Promise<unknown> => {
    const values = readValues(request.body, id);
    const csrfToken = request.cmsSession?.csrfToken ?? '';
    const intent = request.body && typeof request.body === 'object'
      ? (request.body as FormBody).intent
      : undefined;

    if (intent === 'edit') {
      return reply.type('text/html; charset=utf-8').send(renderBlogEditor({
        values,
        csrfToken,
        mode: 'edit',
        previewHtml: values.markdown.trim() ? await renderSafeMarkdownPreview(values.markdown) : undefined,
        statusMessage: 'Draft changes are not saved yet.',
      }));
    }

    const provider = await dependencies.resolveContentProvider({
      tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '',
    });
    let draft;
    try {
      draft = await validateBlogDraft(values, provider, { id, configRevision: values.configRevision });
    } catch (error) {
      if (error instanceof ValidationError) {
        return renderIssuePage(reply, values, csrfToken, error.issues);
      }
      throw error;
    }

    if (intent === 'preview') {
      return reply.type('text/html; charset=utf-8').send(renderBlogEditor({
        values,
        csrfToken,
        mode: 'preview',
        previewHtml: draft.previewHtml,
        statusMessage: 'Draft is valid. The preview has not been saved.',
      }));
    }

    const currentRevision = await dependencies.getConfigRevision();
    if (values.configRevision !== currentRevision) {
      throw new CmsError('configuration-conflict', 'Configuration changed while this editor was open. Reload the blog before saving.', 409);
    }

    const saved = await provider.saveBlog(draft);
    return reply.redirect(`/blogs/${encodeURIComponent(saved.id)}/edit?saved=1`, 303);
  };

  app.post('/blogs/preview', async (request, reply) => {
    const markdown = formText(request.body, 'markdown');
    return reply.send({ html: await renderSafeMarkdownPreview(markdown) });
  });

  app.post('/blogs', async (request, reply) => handleSave(request, reply));
  app.post<{ Params: BlogRouteParams }>('/blogs/:id', async (request, reply) => handleSave(request, reply, request.params.id));
}