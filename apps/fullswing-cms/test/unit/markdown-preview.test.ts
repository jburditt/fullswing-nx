import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSafeMarkdownPreview } from '../../src/content/application/preview-markdown.js';

test('preview removes scripts, event handlers, and unsafe URL schemes', async () => {
  const html = await renderSafeMarkdownPreview(
    '<script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">unsafe</a>',
  );

  assert.doesNotMatch(html, /<script|onerror\s*=|javascript:/i);
  assert.match(html, /unsafe/);
});

test('preview retains formatted Markdown, safe links, and escaped fenced code', async () => {
  const html = await renderSafeMarkdownPreview(
    '# Heading\n\n[Safe link](https://example.test/docs)\n\n```html\n<script>alert(1)</script>\n```',
  );

  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /href="https:\/\/example\.test\/docs"/);
  assert.match(html, /&lt;<\/span>script/);
  assert.match(html, /&lt;\//);
  assert.doesNotMatch(html, /<script>alert/);
});