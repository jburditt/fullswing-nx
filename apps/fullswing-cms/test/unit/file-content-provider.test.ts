import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContentVersionConflictError } from '../../src/content/domain/content-errors.js';
import { FileContentStorageProvider } from '../../src/content/storage/file-content-provider.js';

const metadata = (date: string, title = 'Local content') => ({
  title,
  author: 'Fullswing Team',
  date,
  categories: ['Local'],
});

async function withProvider(run: (provider: FileContentStorageProvider, publicDirectory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'fullswing-files-'));
  const publicDirectory = join(directory, 'public');
  await mkdir(publicDirectory);
  const provider = new FileContentStorageProvider(publicDirectory, 'config-1');
  try {
    await provider.validateConfiguration({ type: 'file', revision: 'config-1', settings: { publicDirectory } });
    await run(provider, publicDirectory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('file provider saves blog pairs under their metadata year and moves them when the date changes', async () => {
  await withProvider(async (provider, publicDirectory) => {
    const created = await provider.saveBlog({
      configRevision: 'config-1',
      basename: 'new-post',
      markdown: '# First draft',
      metadata: metadata('2026-09-29'),
    });
    const firstMarkdown = join(publicDirectory, 'blog', '2026', 'new-post.md');
    const firstMetadata = join(publicDirectory, 'blog', '2026', 'new-post.json');
    assert.equal(await readFile(firstMarkdown, 'utf8'), '# First draft');
    assert.equal(JSON.parse(await readFile(firstMetadata, 'utf8')).date, '2026-09-29');

    const updated = await provider.saveBlog({
      id: created.id,
      expectedVersion: created.version,
      configRevision: 'config-1',
      basename: 'new-post',
      markdown: '# Updated draft',
      metadata: metadata('2025-12-31', 'Updated post'),
    });
    assert.equal(await readFile(join(publicDirectory, 'blog', '2025', 'new-post.md'), 'utf8'), '# Updated draft');
    await assert.rejects(stat(firstMarkdown), { code: 'ENOENT' });
    await assert.rejects(stat(firstMetadata), { code: 'ENOENT' });
    assert.equal((await provider.readBlog(updated.id))?.metadata.title, 'Updated post');
  });
});

test('file provider saves and reads HTML pages with metadata in the matching year folder', async () => {
  await withProvider(async (provider, publicDirectory) => {
    const page = await provider.savePage({
      configRevision: 'config-1',
      basename: 'about',
      html: '<main>About</main>',
      metadata: metadata('2026-04-01', 'About'),
    });

    assert.equal(await readFile(join(publicDirectory, 'pages', '2026', 'about.html'), 'utf8'), '<main>About</main>');
    assert.equal(JSON.parse(await readFile(join(publicDirectory, 'pages', '2026', 'about.json'), 'utf8')).title, 'About');
    assert.equal((await provider.readPage(page.id))?.html, '<main>About</main>');
    assert.deepEqual((await provider.listEntries()).map(entry => entry.route), ['/page/about']);
  });
});

test('file provider mirrors year-prefixed routes for duplicate blog basenames', async () => {
  await withProvider(async (provider, publicDirectory) => {
    for (const [year, title] of [['2025', 'Older post'], ['2026', 'Newer post']]) {
      const directory = join(publicDirectory, 'blog', year);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, 'doc-template.md'), `# ${title}`, 'utf8');
      await writeFile(join(directory, 'doc-template.json'), JSON.stringify(metadata(`${year}-01-01`, title)), 'utf8');
    }

    const entries = await provider.listEntries();
    assert.deepEqual(entries.map(entry => entry.route).sort(), ['/blog/2025/doc-template', '/blog/doc-template']);
    const older = entries.find(entry => entry.route === '/blog/2025/doc-template');
    assert.equal((await provider.readBlog(older!.id))?.markdown, '# Older post');
  });
});

test('file provider rejects stale versions and malformed basenames', async () => {
  await withProvider(async provider => {
    const created = await provider.saveBlog({
      configRevision: 'config-1',
      basename: 'new-post',
      markdown: '# First draft',
      metadata: metadata('2026-09-29'),
    });
    await assert.rejects(provider.saveBlog({
      id: created.id,
      expectedVersion: 'stale',
      configRevision: 'config-1',
      basename: 'new-post',
      markdown: '# Overwrite',
      metadata: metadata('2026-09-29'),
    }), ContentVersionConflictError);
    await assert.rejects(provider.saveBlog({
      configRevision: 'config-1',
      basename: '../outside',
      markdown: '# Invalid',
      metadata: metadata('2026-09-29'),
    }), /lowercase letters, digits, and hyphens/);
  });
});
