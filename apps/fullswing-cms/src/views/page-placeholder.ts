import type { ContentEntrySummary, PageContent } from '../content/domain/content-entry.js';
import { escapeHtml, renderCmsLayout } from './layout.js';

export function renderPageList(entries: readonly ContentEntrySummary[], csrfToken: string): string {
  const pages = entries.filter((entry): entry is ContentEntrySummary & { kind: 'page' } => entry.kind === 'page');
  const rows = pages.map(page => `<tr>
    <td><a href="/pages/${encodeURIComponent(page.id)}">${escapeHtml(page.metadata.title)}</a></td>
    <td>${escapeHtml(page.metadata.route)}</td>
    <td>${escapeHtml(page.metadata.author)}</td>
    <td><time datetime="${escapeHtml(page.metadata.date)}">${escapeHtml(page.metadata.date)}</time></td>
  </tr>`).join('');
  const content = pages.length
    ? `<table><thead><tr><th scope="col">Title</th><th scope="col">Route</th><th scope="col">Author</th><th scope="col">Date</th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p role="status">No HTML pages are available.</p>';
  return renderCmsLayout({ title: 'Pages', content, csrfToken, activeItem: 'page' });
}

export function renderPagePlaceholder(page: PageContent | undefined, csrfToken: string): string {
  const title = page ? page.metadata.title : 'HTML authoring';
  const details = page
    ? `<dl><dt>Route</dt><dd>${escapeHtml(page.metadata.route)}</dd><dt>Author</dt><dd>${escapeHtml(page.metadata.author)}</dd><dt>Date</dt><dd>${escapeHtml(page.metadata.date)}</dd></dl>`
    : '';
  const content = `${details}<p role="status">HTML authoring is not available.</p><p><a href="/pages">Back to pages</a></p>`;
  return renderCmsLayout({ title, content, csrfToken, activeItem: 'page' });
}