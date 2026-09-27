import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyProjectAssets } from './lib/assets.js';
import { discoverBlogs, discoverPages } from './lib/discovery.js';
import { escapeHtml } from './lib/html.js';
import { renderLayout } from './lib/layout.js';
import { renderMarkdown } from './lib/markdown.js';
import { ContentRepository } from '@fullswing/content-model';
import { renderHomePage, renderSitemapPage } from './lib/renderers.js';
import { getAssetPrefix, getOutputPath } from './lib/routes.js';
import { PageRenderFunction } from './lib/types.js';

async function writeRoute(route: string, distDirectory: string, html: string): Promise<void> {
  const outputPath = getOutputPath(route, distDirectory);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf8');
}

async function loadPageRenderer(modulePath: string): Promise<PageRenderFunction> {
  const pageModule = await import(pathToFileURL(modulePath).href);
  if (typeof pageModule.renderPage !== 'function') {
    throw new Error(`Page renderer ${modulePath} must export a renderPage(context) function.`);
  }

  return pageModule.renderPage as PageRenderFunction;
}

async function build(): Promise<void> {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(currentDirectory, '..', '..');
  const publicDirectory = join(projectRoot, 'public');
  const blogDirectory = join(publicDirectory, 'blog');
  const sourcePagesDirectory = join(projectRoot, 'src', 'pages');
  const compiledPagesDirectory = join(projectRoot, '.build', 'src', 'pages');
  const sourceAssetsDirectory = join(projectRoot, 'src', 'assets');
  const distDirectory = join(projectRoot, 'dist');

  const blogs = await discoverBlogs(blogDirectory);
  const pages = await discoverPages(sourcePagesDirectory, compiledPagesDirectory);
  const repository = new ContentRepository(blogs, pages);
  const sourceCache = new Map<string, Promise<string>>();

  await copyProjectAssets(publicDirectory, sourceAssetsDirectory, distDirectory);

  for (const blog of repository.getBlogs()) {
    const markdown = await readFile(blog.markdownPath, 'utf8');
    const content = await renderMarkdown(markdown, { sourceCache, articleRoute: blog.route });
    await writeRoute(
      blog.route,
      distDirectory,
      renderLayout({
        route: blog.route,
        assetPrefix: getAssetPrefix(blog.route),
        pageTitle: `${blog.title} | Blog`,
        title: blog.title,
        author: blog.author,
        date: blog.dateValue,
        categories: blog.categories,
        content,
      })
    );
  }

  for (const page of repository.getPages()) {
    const renderPage = await loadPageRenderer(page.modulePath);
    await writeRoute(
      page.route,
      distDirectory,
      renderLayout({
        route: page.route,
        assetPrefix: getAssetPrefix(page.route),
        pageTitle: `${page.title} | Blog`,
        title: page.title,
        author: page.author,
        date: page.dateValue,
        categories: page.categories,
        content: renderPage({ metadata: page, repository, escapeHtml }),
      })
    );
  }

  await writeRoute(
    '/',
    distDirectory,
    renderLayout({
      route: '/',
      assetPrefix: getAssetPrefix('/'),
      pageTitle: 'Blog',
      title: 'Blog',
      content: renderHomePage(repository),
    })
  );

  await writeRoute(
    '/sitemap',
    distDirectory,
    renderLayout({
      route: '/sitemap',
      assetPrefix: getAssetPrefix('/sitemap'),
      pageTitle: 'Sitemap | Blog',
      title: 'Sitemap',
      content: renderSitemapPage(repository),
    })
  );
}

build().catch(error => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
