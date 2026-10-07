import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown } from '../src/index.js';

test('renderMarkdown preserves highlighted line numbers and ranges', async () => {
  const html = await renderMarkdown('```typescript line=2,4-5 lineOffset=10\nconst one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\nconst five = 5;\n```');
  const lineNumbers = [...html.matchAll(/data-line-number="(\d+)"/g)].map(match => match[1]);
  const highlighted = [...html.matchAll(/class="(code-line(?: is-highlighted)?)"/g)].map(match => match[1]);

  assert.deepEqual(lineNumbers, ['10', '11', '12', '13', '14']);
  assert.deepEqual(highlighted, [
    'code-line',
    'code-line is-highlighted',
    'code-line',
    'code-line is-highlighted',
    'code-line is-highlighted',
  ]);
});

test('renderMarkdown renders interactive task list checkboxes', async () => {
  const html = await renderMarkdown('- [ ] open\n- [x] done');

  assert.match(html, /<input type="checkbox"> open/);
  assert.match(html, /<input type="checkbox" checked> done/);
  assert.doesNotMatch(html, /disabled/);
});

test('renderMarkdown renders GitHub-style alert blockquotes', async () => {
  const source = [
    '> [!NOTE]',
    '> Note body.',
    '>',
    '> ```shell copy',
    '> npm install -g @github/copilot',
    '> ```',
    '',
    '> [!TIP] Tip body.',
    '',
    '> [!IMPORTANT]',
    '> Important body.',
    '',
    '> [!WARNING]',
    '> Warning body.',
    '',
    '> [!CAUTION]',
    '> Caution body.',
    '',
    '> Ordinary quote.',
    '',
    '> [!UNKNOWN]',
    '> Unknown alert.',
  ].join('\n');
  const html = await renderMarkdown(source);

  for (const [type, title] of [
    ['note', 'Note'],
    ['tip', 'Tip'],
    ['important', 'Important'],
    ['warning', 'Warning'],
    ['caution', 'Caution'],
  ]) {
    assert.match(html, new RegExp(`<blockquote class="markdown-alert markdown-alert-${type}">`));
    assert.match(html, new RegExp(`<p class="markdown-alert__title">${title}<\\/p>`));
  }

  assert.match(html, /<p>Note body\.<\/p>/);
  assert.match(html, /class="code-block(?:\s|")/);
  assert.match(html, /data-language="shell"/);
  assert.match(html, /@github\/copilot/);
  assert.doesNotMatch(html, /\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
  assert.match(html, /<blockquote>\n<p>Ordinary quote\.<\/p>\n<\/blockquote>/);
  assert.match(html, /<blockquote>\n<p>\[!UNKNOWN\]\nUnknown alert\.<\/p>/);
});

test('renderMarkdown escapes unknown-language code and Mermaid source', async () => {
  const code = await renderMarkdown('```unknown\n<script>alert(1)</script>\n```');
  const diagram = await renderMarkdown('```mermaid\ngraph TD;\n<script>alert(1)</script>\n```');

  assert.match(code, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(diagram, /<pre class="mermaid">graph TD;\n&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/pre>/);
  assert.doesNotMatch(`${code}${diagram}`, /<script>alert/);
});

test('renderMarkdown embeds prerendered Mermaid output from the renderMermaid hook', async () => {
  const sources: string[] = [];
  const html = await renderMarkdown('```mermaid\ngraph TD;\nA-->B;\n```\n\n```ts\nconst a = 1;\n```', {
    renderMermaid: async source => {
      sources.push(source);
      return '<figure class="mermaid-diagram"><svg></svg></figure>';
    },
  });

  assert.deepEqual(sources, ['graph TD;\nA-->B;']);
  assert.match(html, /<figure class="mermaid-diagram"><svg><\/svg><\/figure>/);
  assert.doesNotMatch(html, /class="mermaid"/);
  assert.match(html, /code-block/);
});

test('renderMarkdown propagates Mermaid prerender failures', async () => {
  await assert.rejects(
    renderMarkdown('```mermaid\nnot a diagram\n```', { renderMermaid: async () => { throw new Error('bad diagram'); } }),
    /bad diagram/
  );
});

test('renderMarkdown fetches bounded text from the default approved source host', async () => {
  const sourceUrl = 'https://raw.githubusercontent.com/example/project/abc123/app.ts';
  let fetchCount = 0;
  const html = await renderMarkdown(`\`\`\`typescript source=${sourceUrl} line=2 lineOffset=10\n\`\`\``, {
    fetchImpl: async (url: string | URL | Request) => {
      fetchCount += 1;
      assert.equal(url, sourceUrl);
      return new Response('const one = 1;\nconst two = 2;\n', {
        headers: { 'content-type': 'text/plain' },
      });
    },
  });

  assert.equal(fetchCount, 1);
  assert.match(html, /data-line-number="10"/);
  assert.match(html, /data-line-number="11"/);
  assert.match(html, /href="https:\/\/raw\.githubusercontent\.com\/example\/project\/abc123\/app\.ts"/);
});

test('renderMarkdown rejects malformed and unapproved source hosts before fetching', async () => {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    return new Response('not reached', { headers: { 'content-type': 'text/plain' } });
  };

  await assert.rejects(
    renderMarkdown('```typescript source=not-a-url\n```', { fetchImpl }),
    /the URL is malformed/,
  );
  await assert.rejects(
    renderMarkdown('```typescript source=http://example.com/code.ts\n```', { fetchImpl }),
    /the protocol or host is not approved/,
  );
  assert.equal(fetchCount, 0);
});