import type { ContentEntrySummary, PageContent } from '../content/domain/content-entry.js';
import { escapeHtml, renderCmsLayout } from './layout.js';

export function renderPageList(entries: readonly ContentEntrySummary[], csrfToken: string, canEdit = false): string {
  const pages = entries.filter((entry): entry is ContentEntrySummary & { kind: 'page' } => entry.kind === 'page');
  const rows = pages.map(page => `<tr>
    <td><a href="/pages/${encodeURIComponent(page.id)}">${escapeHtml(page.metadata.title)}</a></td>
    <td>${escapeHtml(page.route)}</td>
    <td>${escapeHtml(page.metadata.author)}</td>
    <td><time datetime="${escapeHtml(page.metadata.date)}">${escapeHtml(page.metadata.date)}</time></td>
  </tr>`).join('');
  const createAction = canEdit ? '<p><a class="cms-button" href="/pages/new">Add HTML page</a></p>' : '';
  const content = `${createAction}${pages.length
    ? `<div class="cms-table-wrap"><table class="cms-data-table"><thead><tr><th scope="col">Title</th><th scope="col">Route</th><th scope="col">Author</th><th scope="col">Date</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<p class="cms-empty-state" role="status">No HTML pages are available.</p>'}`;
  return renderCmsLayout({ title: 'Pages', content, csrfToken, activeItem: 'page' });
}

export interface PageEditorValues {
  id?: string;
  basename: string;
  title: string;
  author: string;
  date: string;
  categories: string;
  html: string;
  expectedVersion: string;
  configRevision: string;
}

export function renderPageEditor(values: PageEditorValues, csrfToken: string): string {
  const action = values.id ? `/pages/${encodeURIComponent(values.id)}` : '/pages';
  const content = `<form class="cms-editor-form" action="${action}" method="post">
    <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
    <input type="hidden" name="expectedVersion" value="${escapeHtml(values.expectedVersion)}" />
    <input type="hidden" name="configRevision" value="${escapeHtml(values.configRevision)}" />
    <div class="cms-settings-grid">
      <label class="cms-field">File name<input name="basename" value="${escapeHtml(values.basename)}" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
      <label class="cms-field">Title<input name="title" value="${escapeHtml(values.title)}" required /></label>
      <label class="cms-field">Author<input name="author" value="${escapeHtml(values.author)}" required /></label>
      <label class="cms-field">Date<input name="date" type="date" value="${escapeHtml(values.date)}" required /></label>
      <label class="cms-field">Categories<input name="categories" value="${escapeHtml(values.categories)}" required /></label>
      <label class="cms-field cms-field--wide">HTML<textarea name="html" rows="20" spellcheck="false" required>${escapeHtml(values.html)}</textarea></label>
    </div>
    <div class="cms-settings-actions"><button class="cms-button" type="submit">Save page</button><a href="/pages">Cancel</a></div>
  </form>`;
  return renderCmsLayout({ title: values.id ? values.title : 'New HTML page', content, csrfToken, activeItem: 'page' });
}

export function renderPagePlaceholder(page: PageContent | undefined, csrfToken: string): string {
  const title = page ? page.metadata.title : 'HTML authoring';
  const details = page
    ? `<dl class="cms-page-details"><div><dt>Route</dt><dd>${escapeHtml(page.route)}</dd></div><div><dt>Author</dt><dd>${escapeHtml(page.metadata.author)}</dd></div><div><dt>Date</dt><dd>${escapeHtml(page.metadata.date)}</dd></div></dl>`
    : '';
  const content = `<section class="cms-placeholder-panel">${details}<p class="cms-empty-state" role="status">HTML authoring is not available.</p><p><a href="/pages">Back to pages</a></p></section>`;
  return renderCmsLayout({ title, content, csrfToken, activeItem: 'page' });
}