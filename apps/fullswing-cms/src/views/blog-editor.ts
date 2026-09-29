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
  const markdownEditor = `<label class="cms-field cms-field--wide">Markdown<textarea name="markdown" id="blog-markdown" rows="20" required>${escapeHtml(values.markdown)}</textarea></label>`;
  const editTab = mode === 'edit'
    ? '<span class="cms-tab is-active" role="tab" aria-selected="true">Edit</span>'
    : '<button class="cms-tab" role="tab" aria-selected="false" type="submit" name="intent" value="edit" formnovalidate>Edit</button>';
  const previewTab = mode === 'preview'
    ? '<span class="cms-tab is-active" role="tab" aria-selected="true">Preview</span>'
    : '<button class="cms-tab" role="tab" aria-selected="false" type="submit" name="intent" value="preview" formnovalidate>Preview</button>';
  const version = values.expectedVersion
    ? `<input type="hidden" name="expectedVersion" value="${escapeHtml(values.expectedVersion)}" />`
    : '';
  const csrfToken = escapeHtml(options.csrfToken);
  const previewTitle = escapeHtml(values.title.trim() || 'Untitled story');
  const previewAuthor = escapeHtml(values.author.trim() || 'Author');
  const previewDate = escapeHtml(values.date);
  const previewCategories = escapeHtml(values.categories.trim() || 'Draft');
  const previewContent = options.previewHtml || '<p class="cms-preview-empty">Your article preview will appear here as you write.</p>';

  const content = `${errors}${status}<form class="cms-editor-form" action="${action}" method="post" id="blog-editor-form">
    <input type="hidden" name="_csrf" value="${csrfToken}" />
    <input type="hidden" name="configRevision" value="${escapeHtml(values.configRevision)}" />
    ${version}
    <div class="cms-editor-toolbar">
      <div class="cms-editor-tabs" role="tablist" aria-label="Blog editor view">${editTab}${previewTab}</div>
      <div class="cms-editor-actions"><button class="cms-button cms-button--quiet" type="submit" name="intent" value="preview" formnovalidate>Validate</button><button class="cms-button" type="submit" name="intent" value="save">Save blog</button></div>
    </div>
    <div class="cms-editor-split">
      <section class="cms-writing-pane" aria-label="Blog draft fields">
        <div class="cms-editor-fields">
          <label class="cms-field cms-field--wide">Title<input name="title" value="${escapeHtml(values.title)}" data-preview-title-input required /></label>
          <label class="cms-field">Route<input name="route" value="${escapeHtml(values.route)}" required /></label>
          <label class="cms-field">Author<input name="author" value="${escapeHtml(values.author)}" data-preview-author-input required /></label>
          <label class="cms-field">Date<input type="date" name="date" value="${escapeHtml(values.date)}" data-preview-date-input required /></label>
          <label class="cms-field cms-field--wide">Categories<input name="categories" value="${escapeHtml(values.categories)}" aria-describedby="categories-hint" data-preview-categories-input required /><span id="categories-hint">Separate categories with commas.</span></label>
        </div>
        <div class="cms-markdown-heading"><span>Markdown</span><span>Source</span></div>
        <div class="cms-markdown-toolbar" aria-label="Markdown formatting tools"><button type="button" data-markdown-action="bold" title="Bold">B</button><button type="button" data-markdown-action="italic" title="Italic"><i>I</i></button><button type="button" data-markdown-action="heading" title="Heading">H</button><span></span><button type="button" data-markdown-action="list" title="Bulleted list">•</button><button type="button" data-markdown-action="link" title="Insert link">↗</button></div>
        ${markdownEditor}
      </section>
      <aside class="cms-reading-pane" aria-label="Reader preview">
        <div class="cms-preview-heading"><span>READER PREVIEW</span><span>DESKTOP &nbsp; · &nbsp; 100%</span></div>
        <article class="cms-reader-article"><div class="cms-preview-categories" data-preview-categories>${previewCategories}</div><h2 data-preview-title>${previewTitle}</h2><p class="cms-preview-byline"><span data-preview-author>${previewAuthor}</span><span aria-hidden="true">·</span><time data-preview-date>${previewDate}</time></p><section class="cms-preview" data-markdown-preview aria-label="Markdown preview">${previewContent}</section></article>
      </aside>
    </div>
  </form>`;

  return renderCmsLayout({ title, content, csrfToken: options.csrfToken, activeItem: 'blog', includeEditorScript: true });
}