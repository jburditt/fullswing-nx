import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMetadata } from '../src/metadata.js';

async function writeTempMetadata(content: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'typescript-blog-metadata-'));
  const filePath = join(root, 'entry.json');
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

test('loadMetadata should parse valid metadata', async () => {
  const filePath = await writeTempMetadata(
    JSON.stringify({
      route: '/blog/example',
      title: 'Example',
      categories: ['TypeScript'],
      author: 'Test Author',
      date: '2025-10-31',
    })
  );

  const metadata = await loadMetadata(filePath, '/blog/example');

  assert.equal(metadata.title, 'Example');
  assert.equal(metadata.dateValue.toISOString(), '2025-10-31T00:00:00.000Z');
});

test('loadMetadata should reject empty categories', async () => {
  const filePath = await writeTempMetadata(
    JSON.stringify({
      route: '/blog/example',
      title: 'Example',
      categories: [],
      author: 'Test Author',
      date: '2025-10-31',
    })
  );

  await assert.rejects(
    () => loadMetadata(filePath, '/blog/example'),
    /must contain at least one category/
  );
});

test('loadMetadata should reject non-object json content', async () => {
  const filePath = await writeTempMetadata('[]');

  await assert.rejects(
    () => loadMetadata(filePath, '/blog/example'),
    /must contain a JSON object/
  );
});

test('loadMetadata should reject route mismatches', async () => {
  const filePath = await writeTempMetadata(
    JSON.stringify({
      route: '/blog/wrong-route',
      title: 'Example',
      categories: ['TypeScript'],
      author: 'Test Author',
      date: '2025-10-31',
    })
  );

  await assert.rejects(
    () => loadMetadata(filePath, '/blog/example'),
    /must use route \"\/blog\/example\"/
  );
});
