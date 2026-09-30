import { parseMetadata } from '@fullswing/content-model';
import type { SaveBlogRequest } from '../storage/content-storage-provider.js';
import type { ContentStorageProvider } from '../storage/content-storage-provider.js';
import { ValidationError, type ValidationIssue } from '../domain/content-errors.js';
import { renderSafeMarkdownPreview } from './preview-markdown.js';

export interface BlogDraftForm {
  basename?: unknown;
  title?: unknown;
  author?: unknown;
  date?: unknown;
  categories?: unknown;
  markdown?: unknown;
  expectedVersion?: unknown;
  configRevision?: unknown;
}

export interface ValidatedBlogDraft extends SaveBlogRequest {
  previewHtml: string;
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function parseBasename(basename: string | undefined): string | undefined {
  if (!basename || basename === '.' || basename === '..' || /[/?#\\\s]/.test(basename)) {
    return undefined;
  }
  return basename;
}

function getValidationField(error: Error): string {
  const message = error.message.toLowerCase();
  if (message.includes('title')) return 'title';
  if (message.includes('author')) return 'author';
  if (message.includes('categories')) return 'categories';
  if (message.includes('date')) return 'date';
  return 'basename';
}

export async function validateBlogDraft(
  body: BlogDraftForm,
  provider: ContentStorageProvider,
  options: { id?: string; configRevision: string },
): Promise<ValidatedBlogDraft> {
  const basename = readText(body.basename);
  const title = readText(body.title);
  const author = readText(body.author);
  const date = readText(body.date);
  const categoriesValue = readText(body.categories);
  const markdown = typeof body.markdown === 'string' ? body.markdown : '';
  const expectedVersion = readText(body.expectedVersion);
  const issues: ValidationIssue[] = [];

  if (!parseBasename(basename)) {
    issues.push({ field: 'basename', message: 'Use a unique basename without spaces or nested paths.' });
  }
  if (!markdown.trim()) {
    issues.push({ field: 'markdown', message: 'Markdown content is required.' });
  }
  if (!options.configRevision.trim()) {
    issues.push({ field: 'configuration', message: 'Reload the editor after configuration changes.' });
  }
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }

  const categories = categoriesValue?.split(',').map(category => category.trim()) ?? [];
  let metadata;
  try {
    metadata = parseMetadata(JSON.stringify({ title, author, date, categories }), 'submitted blog metadata');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Metadata is invalid.';
    throw new ValidationError([{ field: getValidationField(error instanceof Error ? error : new Error(message)), message }]);
  }

  const route = `/blog/${basename}`;
  const entries = await provider.listEntries();
  if (entries.some(entry => entry.id !== options.id && entry.route === route)) {
    throw new ValidationError([{ field: 'basename', message: 'Another entry already uses this basename.' }]);
  }

  let previewHtml: string;
  try {
    previewHtml = await renderSafeMarkdownPreview(markdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Markdown preview could not be generated.';
    throw new ValidationError([{ field: 'markdown', message }]);
  }

  return {
    id: options.id,
    basename: basename!,
    expectedVersion,
    configRevision: options.configRevision,
    markdown,
    metadata,
    previewHtml,
  };
}