import { getCategoryDisplayName, slugify } from '@fullswing/content-model';
import { escapeHtml, formatDate, getCategoryColors } from './html.js';
import { getRelativeHref } from './routes.js';

export interface LayoutOptions {
  route: string;
  assetPrefix: string;
  pageTitle: string;
  title: string;
  content: string;
  author?: string;
  date?: Date;
  categories?: string[];
}

function renderCategoryPills(categories: string[]): string {
  if (categories.length === 0) {
    return '';
  }

  return `
    <ul class="category-pills" aria-label="Categories">
      ${categories.map(category => {
        const { background, text } = getCategoryColors(category);
        return `
        <li class="category-pill category-pill--${slugify(category)}" style="--category-bg: ${background}; --category-text: ${text}">${escapeHtml(getCategoryDisplayName(category))}</li>
      `;
      }).join('')}
    </ul>
  `;
}

export function renderLayout(options: LayoutOptions): string {
  const { route, assetPrefix, pageTitle, title, content, author, date, categories = [] } = options;
  const escapedAssetPrefix = escapeHtml(assetPrefix);
  const mermaidRuntime = content.includes('class="mermaid"') ? `
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.min.js"></script>
    <script>window.mermaid?.initialize({ startOnLoad: false, securityLevel: 'strict' });</script>` : '';
  const headingMeta = author || date ? `
    <div class="page-meta post-byline">
      ${author ? `<img class="post-byline__avatar" src="${escapedAssetPrefix}assets/avatar.png" alt="Portrait of ${escapeHtml(author)}" />` : ''}
      <div class="post-byline__identity">
        ${author ? `<span class="post-byline__author">${escapeHtml(author)}</span>` : ''}
        ${date ? `<time datetime="${date.toISOString()}">${escapeHtml(formatDate(date))}</time>` : ''}
      </div>
    </div>
  ` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="icon" href="${escapedAssetPrefix}favicon.png" type="image/png" />
    <link rel="stylesheet" href="${escapedAssetPrefix}assets/site.css" />
  </head>
  <body>
    <div class="shell">
      <header class="site-header">
        <a class="brand" href="${escapeHtml(getRelativeHref(route, '/'))}">
          <img src="${escapedAssetPrefix}assets/logo.jpg" alt="Fullswing" />
        </a>
        <nav class="social-links" aria-label="Social links">
          <a href="https://github.com/jburditt" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
            <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12.3047 0C5.50634 0 0 5.50942 0 12.3047C0 17.7423 3.52529 22.3535 8.41332 23.9787C9.02856 24.0946 9.25414 23.7142 9.25414 23.3871C9.25414 23.0949 9.24389 22.3207 9.23876 21.2953C5.81601 22.0377 5.09414 19.6444 5.09414 19.6444C4.53427 18.2243 3.72524 17.8449 3.72524 17.8449C2.61064 17.082 3.81137 17.0973 3.81137 17.0973C5.04697 17.1835 5.69604 18.3647 5.69604 18.3647C6.79321 20.2463 8.57636 19.7029 9.27978 19.3881C9.39052 18.5924 9.70736 18.0499 10.0591 17.7423C7.32641 17.4347 4.45429 16.3765 4.45429 11.6618C4.45429 10.3185 4.9311 9.22133 5.72065 8.36C5.58222 8.04931 5.16694 6.79833 5.82831 5.10337C5.82831 5.10337 6.85883 4.77319 9.2121 6.36459C10.1965 6.09082 11.2424 5.95546 12.2883 5.94931C13.3342 5.95546 14.3801 6.09082 15.3644 6.36459C17.7023 4.77319 18.7328 5.10337 18.7328 5.10337C19.3942 6.79833 18.9789 8.04931 18.8559 8.36C19.6403 9.22133 20.1171 10.3185 20.1171 11.6618C20.1171 16.3888 17.2409 17.4296 14.5031 17.7321C14.9338 18.1012 15.3337 18.8559 15.3337 20.0084C15.3337 21.6552 15.3183 22.978 15.3183 23.3779C15.3183 23.7009 15.5336 24.0854 16.1642 23.9623C21.0871 22.3484 24.6094 17.7341 24.6094 12.3047C24.6094 5.50942 19.0999 0 12.3047 0Z" />
            </svg>
          </a>
          <a href="https://www.linkedin.com/in/jburditt" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
            <svg width="25" height="24" viewBox="0 0 382 382" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M347.445,0H34.555C15.471,0,0,15.471,0,34.555v312.889C0,366.529,15.471,382,34.555,382h312.889C366.529,382,382,366.529,382,347.444V34.555C382,15.471,366.529,0,347.445,0z M118.207,329.844c0,5.554-4.502,10.056-10.056,10.056H65.345c-5.554,0-10.056-4.502-10.056-10.056V150.403c0-5.554,4.502-10.056,10.056-10.056h42.806c5.554,0,10.056,4.502,10.056,10.056V329.844z M86.748,123.432c-22.459,0-40.666-18.207-40.666-40.666S64.289,42.1,86.748,42.1s40.666,18.207,40.666,40.666S109.208,123.432,86.748,123.432z M341.91,330.654c0,5.106-4.14,9.246-9.246,9.246H286.73c-5.106,0-9.246-4.14-9.246-9.246v-84.168c0-12.556,3.683-55.021-32.813-55.021c-28.309,0-34.051,29.066-35.204,42.11v97.079c0,5.106-4.139,9.246-9.246,9.246h-44.426c-5.106,0-9.246-4.14-9.246-9.246V149.593c0-5.106,4.14-9.246,9.246-9.246h44.426c5.106,0,9.246,4.14,9.246,9.246v15.655c10.497-15.753,26.097-27.912,59.312-27.912c73.552,0,73.131,68.716,73.131,106.472L341.91,330.654L341.91,330.654z" />
            </svg>
          </a>
        </nav>
      </header>
      <main>
        <article class="page-card">
          ${renderCategoryPills(categories)}
          <h1>${escapeHtml(title)}</h1>
          ${headingMeta}
          <div class="page-content">
            ${content}
          </div>
        </article>
      </main>
      <p id="copy-status" class="visually-hidden" role="status" aria-live="polite"></p>
    </div>
    ${mermaidRuntime}
    <script type="module" src="${escapedAssetPrefix}assets/site.js"></script>
  </body>
</html>`;
}
