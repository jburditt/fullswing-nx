import type { ValidationIssue } from '../content/domain/content-errors.js';
import { renderCmsLayout, escapeHtml } from './layout.js';

export interface BlogEditorValues {
  id?: string;
  route: string;
  title: string;
  author: string;
  date: string;
  categories: string;
  markdown: string;
  expectedVersion: string;
  configRevision: string;
}

export interface BlogEditorViewOptions {
  values: BlogEditorValues;
  csrfToken: string;
  mode: 'edit' | 'preview';
  previewHtml?: string;
  issues?: readonly ValidationIssue[];
  statusMessage?: string;
}

export function renderBlogEditor(options: BlogEditorViewOptions): string {
  const { values, mode } = options;
  const action = values.id ? `/blogs/${encodeURIComponent(values.id)}` : '/blogs';
  const title = values.id ? 'Edit blog' : 'Add blog';
  const errors = options.issues?.length
    ? `<section class="cms-errors" role="alert"><h2>Review these fields</h2><ul>${options.issues.map(issue => `<li><strong>${escapeHtml(issue.field)}:</strong> ${escapeHtml(issue.message)}</li>`).join('')}</ul></section>`
    : '';
  const statusMessage = options.statusMessage ?? (options.issues?.length
    ? 'Draft has validation errors.'
    : mode === 'preview'
      ? 'Draft is valid. The preview has not been saved.'
      : 'Draft changes are not saved yet.');
  const status = `<p class="cms-validation-status" role="status" aria-live="polite">${escapeHtml(statusMessage)}</p>`;
  const markdownEditor = mode === 'edit'
    ? `<label class="cms-field cms-field--wide">Markdown<textarea name="markdown" rows="20" required>${escapeHtml(values.markdown)}</textarea></label>`
    : `<input type="hidden" name="markdown" value="${escapeHtml(values.markdown)}" /><section class="cms-preview" aria-label="Markdown preview">${options.previewHtml ?? ''}</section>`;
  const previewButton = mode === 'preview'
    ? '<button type="submit" name="intent" value="edit">Edit Markdown</button>'
    : '<button type="submit" name="intent" value="preview" formnovalidate>Preview</button>';
  const version = values.expectedVersion
    ? `<input type="hidden" name="expectedVersion" value="${escapeHtml(values.expectedVersion)}" />`
    : '';
  const csrfToken = escapeHtml(options.csrfToken);

  const content = `${errors}${status}<form class="cms-editor-form" action="${action}" method="post" id="blog-editor-form">
    <input type="hidden" name="_csrf" value="${csrfToken}" />
    <input type="hidden" name="configRevision" value="${escapeHtml(values.configRevision)}" />
    ${version}
    <div class="cms-editor-fields">
      <label class="cms-field">Route<input name="route" value="${escapeHtml(values.route)}" required /></label>
      <label class="cms-field">Title<input name="title" value="${escapeHtml(values.title)}" required /></label>
      <label class="cms-field">Author<input name="author" value="${escapeHtml(values.author)}" required /></label>
      <label class="cms-field">Date<input type="date" name="date" value="${escapeHtml(values.date)}" required /></label>
      <label class="cms-field cms-field--wide">Categories<input name="categories" value="${escapeHtml(values.categories)}" aria-describedby="categories-hint" required /><span id="categories-hint">Separate categories with commas.</span></label>
      ${markdownEditor}
    </div>
    <div class="cms-editor-actions">${previewButton}<button type="submit" name="intent" value="save">Save blog</button></div>
  </form>`;

  return renderCmsLayout({ title, content, csrfToken: options.csrfToken, activeItem: 'blog' });
}