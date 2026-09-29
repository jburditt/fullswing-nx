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

test('renderMarkdown escapes unknown-language code and Mermaid source', async () => {
  const code = await renderMarkdown('```unknown\n<script>alert(1)</script>\n```');
  const diagram = await renderMarkdown('```mermaid\ngraph TD;\n<script>alert(1)</script>\n```');

  assert.match(code, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(diagram, /<pre class="mermaid">graph TD;\n&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/pre>/);
  assert.doesNotMatch(`${code}${diagram}`, /<script>alert/);
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