import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { renderLayout } from '../src/lib/layout.js';
import { renderMarkdown } from '../src/lib/markdown.js';
import { renderHomePage, renderSitemapPage } from '../src/lib/renderers.js';
import { getRelativeHref } from '../src/lib/routes.js';
import { BlogEntry, ContentRepository, PageEntry } from '@fullswing/content-model';

type FixtureHandler = (request: IncomingMessage, response: ServerResponse) => void;

async function withHttpFixture<T>(handler: FixtureHandler, callback: (url: string) => Promise<T>): Promise<T> {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('HTTP fixture did not bind to a port.');
  }

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('renderMarkdown should add line numbers and highlighted lines for fenced code blocks', async () => {
  const html = await renderMarkdown('```typescript line=2 lineOffset=10\nconst one = 1;\nconst two = 2;\n```');
  const defaultNumberedHtml = await renderMarkdown('```typescript\nconst one = 1;\nconst two = 2;\n```');

  assert.match(html, /data-line-number="10"/);
  assert.match(html, /data-line-number="11"/);
  assert.match(html, /code-line is-highlighted/);
  assert.match(defaultNumberedHtml, /class="code-block has-line-numbers"/);
  assert.match(defaultNumberedHtml, /data-line-number="1"/);
  assert.match(defaultNumberedHtml, /data-line-number="2"/);
  assert.doesNotMatch(defaultNumberedHtml, /<\/span>\s+<span class="code-line/);
});

test('renderMarkdown should highlight comma-separated lines and ranges', async () => {
  const html = await renderMarkdown('```typescript line=1,3-4\nconst one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\n```');
  const lineClasses = [...html.matchAll(/class="(code-line(?: is-highlighted)?)"/g)]
    .map((match) => match[1]);

  assert.deepEqual(lineClasses, [
    'code-line is-highlighted',
    'code-line',
    'code-line is-highlighted',
    'code-line is-highlighted',
  ]);
});

test('renderMarkdown should preserve escaped Mermaid source without code controls', async () => {
  const html = await renderMarkdown('```mermaid\ngraph TD;\n<script>alert(1)</script>\n```');

  assert.match(html, /<pre class="mermaid">graph TD;\n&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/pre>/);
  assert.doesNotMatch(html, /data-copy-code/);
});

test('renderMarkdown should render a fetched source with existing code directives', async () => {
  const sourceUrl = 'https://raw.githubusercontent.com/example/project/abc123/app.ts';
  const html = await renderMarkdown(
    `\`\`\`typescript source=${sourceUrl} line=2 lineOffset=10\n\`\`\``,
    { fetchImpl: async url => {
      assert.equal(url, sourceUrl);
      return new Response('const one = 1;\nconst two = 2;\n', {
        headers: { 'content-type': 'text/plain' },
      });
    } },
  );

  assert.match(html, /<span class="token keyword">const<\/span> one/);
  assert.match(html, /data-line-number="10"/);
  assert.match(html, /data-line-number="11"/);
  assert.match(html, /code-line is-highlighted/);
  assert.match(html, new RegExp(`href="${sourceUrl.replaceAll('.', '\\.')}`));
});

test('renderMarkdown should cache fetched sources and escape source attribution', async () => {
  const sourceUrl = 'https://raw.githubusercontent.com/example/project/abc123/app.ts?file=app.ts&mode=raw';
  let fetchCount = 0;
  const html = await renderMarkdown(
    `\`\`\`typescript source=${sourceUrl}\n\`\`\`\n\n\`\`\`typescript source=${sourceUrl}\n\`\`\``,
    { fetchImpl: async () => {
      fetchCount += 1;
      return new Response('<script>alert(1)</script>', {
        headers: { 'content-type': 'text/plain' },
      });
    } },
  );

  assert.equal(fetchCount, 1);
  assert.equal((html.match(/&lt;/g) ?? []).length, 4);
  assert.match(html, /file=app\.ts&amp;mode=raw/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('renderMarkdown should reject malformed and disallowed source URLs before fetching', async () => {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    return new Response('unreachable', {
      headers: { 'content-type': 'text/plain' },
    });
  };

  await assert.rejects(
    renderMarkdown('```typescript source=not-a-url\n```', { fetchImpl }),
    /the URL is malformed/,
  );
  await assert.rejects(
    renderMarkdown('```typescript source=http://example.com/app.ts\n```', { fetchImpl }),
    /the protocol or host is not approved/,
  );
  assert.equal(fetchCount, 0);
});

test('renderMarkdown should report remote fetch failures with the source URL', async () => {
  const sourceUrl = 'https://raw.githubusercontent.com/example/project/abc123/app.ts';

  await assert.rejects(
    renderMarkdown(`\`\`\`typescript source=${sourceUrl}\n\`\`\``, {
      fetchImpl: async () => {
        throw new Error('fixture unavailable');
      },
    }),
    new RegExp(`Unable to load remote code source ${sourceUrl}: fixture unavailable`),
  );
});

test('renderMarkdown should validate HTTP status, content type, and response size', async () => {
  const sourceUrl = 'https://raw.githubusercontent.com/example/project/abc123/app.ts';
  const fence = `\`\`\`typescript source=${sourceUrl}\n\`\`\``;

  await withHttpFixture((_request, response) => {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('missing');
  }, async fixtureUrl => {
    await assert.rejects(
      renderMarkdown(fence, { fetchImpl: () => fetch(fixtureUrl), articleRoute: '/blog/example' }),
      /while rendering \/blog\/example: the server returned HTTP 404/,
    );
  });

  await withHttpFixture((_request, response) => {
    response.writeHead(200, { 'content-type': 'image/png' });
    response.end('not text');
  }, async fixtureUrl => {
    await assert.rejects(
      renderMarkdown(fence, { fetchImpl: () => fetch(fixtureUrl) }),
      /content type image\/png is not text/,
    );
  });

  await withHttpFixture((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('this source is too large');
  }, async fixtureUrl => {
    await assert.rejects(
      renderMarkdown(fence, { fetchImpl: () => fetch(fixtureUrl), maxSourceBytes: 4 }),
      /exceeds the 4-byte limit/,
    );
  });
});

test('renderMarkdown should abort timed-out HTTP source requests', async () => {
  const sourceUrl = 'https://raw.githubusercontent.com/example/project/abc123/app.ts';
  await withHttpFixture(() => {
    // Leave the response open until the resolver aborts the request.
  }, async fixtureUrl => {
    await assert.rejects(
      renderMarkdown(`\`\`\`typescript source=${sourceUrl}\n\`\`\``, {
        fetchImpl: (_url, init) => fetch(fixtureUrl, init),
        sourceTimeoutMs: 10,
      }),
      /timed out after 10ms/,
    );
  });
});

test('renderMarkdown should reuse a shared source cache across renders', async () => {
  const sourceUrl = 'https://raw.githubusercontent.com/example/project/abc123/app.ts';
  const sourceCache = new Map<string, Promise<string>>();
  let fetchCount = 0;
  const options = {
    sourceCache,
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response('const shared = true;', {
        headers: { 'content-type': 'text/plain' },
      });
    },
  };

  await renderMarkdown(`\`\`\`typescript source=${sourceUrl}\n\`\`\``, options);
  await renderMarkdown(`\`\`\`typescript source=${sourceUrl}\n\`\`\``, options);

  assert.equal(fetchCount, 1);
});

test('renderLayout should escape metadata values before injecting them into the page shell', () => {
  const html = renderLayout({
    route: '/blog/example',
    assetPrefix: '../../',
    pageTitle: 'Unsafe <title>',
    title: 'Unsafe <heading>',
    author: 'Author <name>',
    date: new Date('2025-10-31T00:00:00.000Z'),
    categories: ['CSharp'],
    content: '<p>Safe body</p>',
  });

  assert.match(html, /Unsafe &lt;title&gt;/);
  assert.match(html, /Unsafe &lt;heading&gt;/);
  assert.match(html, /Author &lt;name&gt;/);
  assert.match(html, /C#/);
});

test('renderLayout should render an accessible author byline below the title', () => {
  const html = renderLayout({
    route: '/blog/example',
    assetPrefix: '../../',
    pageTitle: 'Nested page',
    title: 'Nested page',
    author: 'Jebb Burditt',
    date: new Date('2025-10-17T00:00:00.000Z'),
    content: '<p>Body</p>',
  });

  assert.match(html, /<h1>Nested page<\/h1>\s+<div class="page-meta post-byline">/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/avatar\.png" alt="Portrait of Jebb Burditt"/);
  assert.match(html, /<time datetime="2025-10-17T00:00:00\.000Z">Oct 17, 2025<\/time>/);
});

test('home and sitemap listings should render compact author metadata with route-relative avatars', () => {
  const blogs: BlogEntry[] = [{
    kind: 'blog',
    id: 'example',
    route: '/blog/example',
    title: 'Example post',
    categories: ['Document'],
    author: 'Jebb Burditt',
    date: '2025-10-17',
    dateValue: new Date('2025-10-17T00:00:00.000Z'),
    markdownPath: '/tmp/example.md',
    metadataPath: '/tmp/example.json',
  }];
  const pages: PageEntry[] = [{
    kind: 'page',
    name: 'about',
    route: '/page/about',
    title: 'About',
    categories: ['Document'],
    author: 'Jebb Burditt',
    date: '2025-10-17',
    dateValue: new Date('2025-10-17T00:00:00.000Z'),
    metadataPath: '/tmp/about.json',
    modulePath: '/tmp/about.js',
  }];
  const repository = new ContentRepository(blogs, pages);
  const homeHtml = renderHomePage(repository);
  const sitemapHtml = renderSitemapPage(repository);

  assert.match(homeHtml, /src="\.\/assets\/avatar\.png" alt="Portrait of Jebb Burditt"/);
  assert.match(sitemapHtml, /src="\.\.\/assets\/avatar\.png" alt="Portrait of Jebb Burditt"/);
  for (const html of [homeHtml, sitemapHtml]) {
    assert.match(html, /class="content-list__avatar"/);
    assert.match(html, /<time datetime="2025-10-17T00:00:00\.000Z">Oct 17, 2025<\/time>/);
  }
});

test('renderLayout should include the external social navigation links', () => {
  const html = renderLayout({
    route: '/blog/example',
    assetPrefix: '../../',
    pageTitle: 'Nested page',
    title: 'Nested page',
    content: '<p>Body</p>',
  });

  assert.match(html, /class=\"social-links\"/);
  assert.match(html, /href=\"https:\/\/github\.com\/jburditt\"[^>]*aria-label=\"GitHub\"/);
  assert.match(html, /href=\"https:\/\/www\.linkedin\.com\/in\/jburditt\"[^>]*aria-label=\"LinkedIn\"/);
  assert.match(html, /<svg width=\"25\" height=\"24\"/g);
});

test('renderLayout should resolve the header logo from the generated asset directory', () => {
  const html = renderLayout({
    route: '/blog/example',
    assetPrefix: '../../',
    pageTitle: 'Nested page',
    title: 'Nested page',
    content: '<p>Body</p>',
  });

  assert.match(html, /src=\"\.\.\/\.\.\/assets\/logo\.jpg\"/);
  assert.match(html, /href=\"\.\.\/\.\.\/favicon\.png\"/);
});

test('renderLayout should load Mermaid for pages containing diagram blocks', () => {
  const html = renderLayout({
    route: '/blog/example',
    assetPrefix: '../../',
    pageTitle: 'Diagram page',
    title: 'Diagram page',
    content: '<pre class="mermaid">graph TD;</pre>',
  });

  assert.match(html, /mermaid@11\.12\.0\/dist\/mermaid\.min\.js/);
  assert.match(html, /mermaid\?\.initialize\(\{\s*startOnLoad: false,\s*securityLevel: 'strict'\s*\}\)/);
});

test('getRelativeHref should resolve nested routes relative to generated output directories', () => {
  assert.equal(getRelativeHref('/blog/example', '/'), '../../');
  assert.equal(getRelativeHref('/blog/example', '/sitemap'), '../../sitemap/');
  assert.equal(getRelativeHref('/sitemap', '/'), '../');
});
