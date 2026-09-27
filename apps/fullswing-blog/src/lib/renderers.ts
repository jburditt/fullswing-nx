import { ContentEntry, RepositoryView, slugify } from '@fullswing/content-model';
import { escapeHtml, formatDate, getCategoryColors } from './html.js';
import { getAssetPrefix, getRelativeHref } from './routes.js';

function renderCategoryFilter(repository: RepositoryView): string {
  const categories = repository.getCategories();
  if (categories.length === 0) {
    return '';
  }

  return `
    <section class="filter-panel" aria-label="Category filters">
      <h2>Filter by category</h2>
      <div class="filter-list">
        ${categories.map(category => {
          const { background, text } = getCategoryColors(category.name);
          return `
          <button
            type="button"
            class="filter-chip"
            data-category-toggle="${escapeHtml(category.slug)}"
            aria-pressed="true"
            style="--category-bg: ${background}; --category-text: ${text}"
          >
            ${escapeHtml(category.displayName)} <span class="filter-count">${category.count}</span>
          </button>
        `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderContentList(entries: ContentEntry[], currentRoute: string): string {
  return `
    <ul class="content-list">
      ${entries.map(entry => `
        <li data-categories="${escapeHtml(entry.categories.map(category => slugify(category)).join(' '))}">
          <a href="${escapeHtml(getRelativeHref(currentRoute, entry.route))}">${escapeHtml(entry.title)}</a>
          <div class="content-list__meta">
            <img class="content-list__avatar" src="${escapeHtml(getAssetPrefix(currentRoute))}assets/avatar.png" alt="Portrait of ${escapeHtml(entry.author)}" />
            <span>${escapeHtml(entry.author)}</span>
            <span aria-hidden="true">•</span>
            <time datetime="${entry.dateValue.toISOString()}">${escapeHtml(formatDate(entry.dateValue))}</time>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

export function renderHomePage(repository: RepositoryView): string {
  return `
    <p class="lede">A minimal static export of the Fullswing blog, generated with Node.js and TypeScript from discovered Markdown posts and page renderers.</p>
    ${renderCategoryFilter(repository)}
    <section>
      <h2>Latest content</h2>
      ${renderContentList(repository.getAll(), '/')}
    </section>
  `;
}

export function renderSitemapPage(repository: RepositoryView): string {
  return `
    <p class="lede">Every discovered blog post and page route, generated without a hard-coded prerender list.</p>
    ${renderCategoryFilter(repository)}
    <section>
      <h2>Discovered routes</h2>
      ${renderContentList(repository.getAll(), '/sitemap')}
    </section>
  `;
}
