export type CmsNavigationItem = 'dashboard' | 'blog' | 'page' | 'configuration';

export interface CmsLayoutOptions {
  title: string;
  content: string;
  csrfToken: string;
  activeItem?: CmsNavigationItem;
  includeEditorScript?: boolean;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function renderNavigationItem(
  label: string,
  href: string,
  item: CmsNavigationItem,
  activeItem?: CmsNavigationItem,
): string {
  const current = activeItem === item ? ' aria-current="page"' : '';
  return `<a href="${href}"${current}>${label}</a>`;
}

export function renderCmsLayout(options: CmsLayoutOptions): string {
  const title = escapeHtml(options.title);
  const csrfToken = escapeHtml(options.csrfToken);
  const activeItem = options.activeItem;
  const editorScript = options.includeEditorScript ? '<script type="module" src="/assets/cms.js"></script>' : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} | Fullswing CMS</title>
    <link rel="icon" href="/assets/logo.jpg" type="image/jpeg" />
    <link rel="stylesheet" href="/assets/cms.css" />
    ${editorScript}
  </head>
  <body>
    <header class="cms-header">
      <a class="cms-brand" href="/dashboard"><img src="/assets/logo.jpg" alt="Fullswing" /></a>
      <nav class="cms-navigation" aria-label="Main navigation">
        ${renderNavigationItem('Dashboard', '/dashboard', 'dashboard', activeItem)}
        ${renderNavigationItem('Add blog', '/blogs/new', 'blog', activeItem)}
        ${renderNavigationItem('Pages', '/pages', 'page', activeItem)}
        ${renderNavigationItem('Configuration', '/configuration', 'configuration', activeItem)}
      </nav>
      <form action="/auth/logout" method="post" class="cms-logout">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <button type="submit" aria-label="Log out">Log out</button>
      </form>
    </header>
    <main class="cms-main">
      <h1>${title}</h1>
      ${options.content}
    </main>
  </body>
</html>`;
}

export { escapeHtml };