import type { ContentFilters, PaginatedEntries } from '../content/application/list-content.js';
import { renderCmsLayout, escapeHtml } from './layout.js';

export interface DashboardViewOptions {
  page: PaginatedEntries;
  filters: ContentFilters;
  csrfToken: string;
}

function renderPagination(page: PaginatedEntries, filters: ContentFilters): string {
  const pageCount = Math.ceil(page.total / page.pageSize);
  if (pageCount <= 1) {
    return '';
  }

  const parameters = new URLSearchParams();
  if (filters.kind) parameters.set('kind', filters.kind);
  if (filters.title) parameters.set('title', filters.title);
  if (filters.author) parameters.set('author', filters.author);
  if (filters.category) parameters.set('category', filters.category);
  if (filters.dateFrom) parameters.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) parameters.set('dateTo', filters.dateTo);
  parameters.set('pageSize', String(page.pageSize));
  const linkFor = (number: number) => {
    const query = new URLSearchParams(parameters);
    query.set('page', String(number));
    return `/dashboard?${escapeHtml(query.toString())}`;
  };

  const previous = page.page > 1
    ? `<a href="${linkFor(page.page - 1)}" rel="prev">Previous</a>`
    : '';
  const next = page.page < pageCount
    ? `<a href="${linkFor(page.page + 1)}" rel="next">Next</a>`
    : '';

  return `<nav class="dashboard-pagination" aria-label="Dashboard pages">${previous}<span aria-current="page">Page ${page.page} of ${pageCount}</span>${next}</nav>`;
}

export function renderDashboardPage(options: DashboardViewOptions): string {
  const { page, filters } = options;
  const entries = page.entries;
  const rows = entries.map(entry => {
    const href = entry.kind === 'blog' ? `/blogs/${encodeURIComponent(entry.id)}/edit` : `/pages/${encodeURIComponent(entry.id)}`;
    const categories = entry.metadata.categories.map(escapeHtml).join(', ');
    return `<tr>
      <td>${escapeHtml(entry.kind)}</td>
      <td><a href="${href}">${escapeHtml(entry.metadata.title)}</a></td>
      <td>${escapeHtml(entry.metadata.author)}</td>
      <td><time datetime="${escapeHtml(entry.metadata.date)}">${escapeHtml(entry.metadata.date)}</time></td>
      <td>${categories}</td>
    </tr>`;
  }).join('');
  const results = entries.length > 0
    ? `<table><thead><tr><th scope="col">Type</th><th scope="col">Title</th><th scope="col">Author</th><th scope="col">Date</th><th scope="col">Categories</th></tr></thead><tbody>${rows}</tbody></table>${renderPagination(page, filters)}`
    : '<p class="dashboard-empty" role="status">No content matches these filters.</p>';
  const csrfToken = escapeHtml(options.csrfToken);

  const content = `<form class="dashboard-filters" action="/dashboard" method="get" aria-label="Filter content">
    <label>Type<select name="kind"><option value="all"${filters.kind ? '' : ' selected'}>All</option><option value="blog"${filters.kind === 'blog' ? ' selected' : ''}>Blogs</option><option value="page"${filters.kind === 'page' ? ' selected' : ''}>Pages</option></select></label>
    <label>Title<input name="title" value="${escapeHtml(filters.title ?? '')}" /></label>
    <label>Author<input name="author" value="${escapeHtml(filters.author ?? '')}" /></label>
    <label>Category<input name="category" value="${escapeHtml(filters.category ?? '')}" /></label>
    <label>From<input type="date" name="dateFrom" value="${escapeHtml(filters.dateFrom ?? '')}" /></label>
    <label>To<input type="date" name="dateTo" value="${escapeHtml(filters.dateTo ?? '')}" /></label>
    <button type="submit">Filter</button><a href="/dashboard">Clear filters</a>
  </form>
  <p class="dashboard-count" role="status">${page.total} entries</p>
  ${results}
  <input type="hidden" name="_csrf" value="${csrfToken}" disabled />`;

  return renderCmsLayout({
    title: 'Dashboard',
    content,
    csrfToken: options.csrfToken,
    activeItem: 'dashboard',
  });
}