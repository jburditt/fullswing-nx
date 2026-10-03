import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncBlogContent } from './sync-blog-content.mjs';

const blobs = [
  { name: 'content/blog/2026/first-post.md', content: '# First post' },
  { name: 'content/blog/2026/first-post.json', content: '{"title":"First post"}' },
];

function fakeAzureCli(sourceBlobs = blobs, failDownload = false) {
  return async args => {
    if (args[0] === 'storage' && args[1] === 'blob' && args[2] === 'list') {
      return JSON.stringify(sourceBlobs.map(({ name }) => ({ name })));
    }
    if (args[0] === 'storage' && args[1] === 'blob' && args[2] === 'download') {
      if (failDownload) throw new Error('download failed');
      const blob = sourceBlobs.find(item => item.name === args[args.indexOf('--name') + 1]);
      await writeFile(args[args.indexOf('--file') + 1], blob.content, 'utf8');
      return '';
    }
    throw new Error(`Unexpected Azure CLI command: ${args.join(' ')}`);
  };
}

async function withTempDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'fullswing-blog-sync-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('sync maps Blob content prefix to the static blog directory and removes stale files', async () => {
  await withTempDirectory(async directory => {
    const destination = join(directory, 'public', 'blog');
    await mkdir(join(destination, '2025'), { recursive: true });
    await writeFile(join(destination, '2025', 'stale.md'), '# Stale', 'utf8');

    const count = await syncBlogContent({
      accountName: 'storageaccount',
      containerName: 'fullswing-cms-state',
      destinationDirectory: destination,
      runCommand: fakeAzureCli(),
    });

    assert.equal(count, 2);
    assert.equal(await readFile(join(destination, '2026', 'first-post.md'), 'utf8'), '# First post');
    assert.equal(await readFile(join(destination, '2026', 'first-post.json'), 'utf8'), '{"title":"First post"}');
    await assert.rejects(readFile(join(destination, '2025', 'stale.md')));
  });
});

test('sync leaves existing published source untouched when a download fails', async () => {
  await withTempDirectory(async directory => {
    const destination = join(directory, 'public', 'blog');
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, 'existing.md'), '# Existing', 'utf8');

    await assert.rejects(syncBlogContent({
      accountName: 'storageaccount',
      containerName: 'fullswing-cms-state',
      destinationDirectory: destination,
      runCommand: fakeAzureCli(blobs, true),
    }), /download failed/);

    assert.equal(await readFile(join(destination, 'existing.md'), 'utf8'), '# Existing');
  });
});

test('sync rejects empty, malformed, and incomplete Blob blog collections', async () => {
  await withTempDirectory(async directory => {
    const destination = join(directory, 'public', 'blog');
    const cases = [
      [],
      [{ name: 'content/blog/2026/invalid name.md' }, { name: 'content/blog/2026/invalid name.json' }],
      [{ name: 'content/blog/2026/orphan.md' }],
    ];

    for (const sourceBlobs of cases) {
      await assert.rejects(syncBlogContent({
        accountName: 'storageaccount',
        containerName: 'fullswing-cms-state',
        destinationDirectory: destination,
        runCommand: fakeAzureCli(sourceBlobs),
      }));
    }
  });
});