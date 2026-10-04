import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { minifyHtml, optimizeDist } from '../src/lib/optimize.js';

test('minifyHtml shrinks markup but preserves preformatted code and inline spacing', async () => {
  const html = '<p>Hello   <strong>big</strong> <em>world</em></p>\n<!-- note -->\n<pre><code>a\n  b</code></pre>';
  const minified = await minifyHtml(html);

  assert.ok(minified.length < html.length);
  assert.doesNotMatch(minified, /note/);
  assert.match(minified, /<strong>big<\/strong> <em>world<\/em>/);
  assert.match(minified, /<pre><code>a\n {2}b<\/code><\/pre>/);
});

test('optimizeDist minifies site assets and writes brotli and gzip siblings', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'blog-optimize-'));
  try {
    await mkdir(join(dist, 'assets'), { recursive: true });
    const css = `body {\n  color: red;\n}\n${Array.from({ length: 40 }, (_, index) => `.rule-${index} { margin: ${index}px; }`).join('\n')}`;
    await writeFile(join(dist, 'assets', 'site.css'), css);
    await writeFile(join(dist, 'index.html'), `<html><body>\n  <p>${'text '.repeat(100)}</p>\n</body></html>`);

    await optimizeDist(dist);

    const minifiedCss = await readFile(join(dist, 'assets', 'site.css'), 'utf8');
    assert.ok(minifiedCss.length < css.length);
    assert.equal(gunzipSync(await readFile(join(dist, 'assets', 'site.css.gz'))).toString('utf8'), minifiedCss);
    assert.ok((await stat(join(dist, 'index.html.br'))).size > 0);
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});
