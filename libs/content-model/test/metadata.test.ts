import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMetadata, parseMetadata } from '../src/metadata.js';

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

test('parseMetadata should validate a JSON string without filesystem access', () => {
  const metadata = parseMetadata(JSON.stringify({
    route: '/blog/example',
    title: 'Example',
    author: 'Test Author',
    date: '2026-02-28',
    categories: ['TypeScript'],
  }), '/blog/example', 'onedrive:example.json');

  assert.equal(metadata.title, 'Example');
  assert.equal(metadata.dateValue.toISOString(), '2026-02-28T00:00:00.000Z');
});

test('parseMetadata should reject invalid JSON and non-object JSON values', () => {
  assert.throws(() => parseMetadata('{', '/blog/example', 'remote metadata'), /is not valid JSON/);
  assert.throws(() => parseMetadata('[]', '/blog/example', 'remote metadata'), /must contain a JSON object/);
  assert.throws(() => parseMetadata('null', '/blog/example', 'remote metadata'), /must contain a JSON object/);
});

test('parseMetadata should reject missing fields, empty categories, invalid dates, and route mismatches', () => {
  const base = {
    route: '/blog/example',
    title: 'Example',
    author: 'Test Author',
    date: '2026-02-28',
    categories: ['TypeScript'],
  };

  assert.throws(() => parseMetadata(JSON.stringify({ ...base, title: ' ' }), '/blog/example', 'metadata'), /non-empty string "title"/);
  assert.throws(() => parseMetadata(JSON.stringify({ ...base, categories: [] }), '/blog/example', 'metadata'), /at least one category/);
  assert.throws(() => parseMetadata(JSON.stringify({ ...base, date: '2026-02-30' }), '/blog/example', 'metadata'), /invalid calendar date/);
  assert.throws(() => parseMetadata(JSON.stringify({ ...base, route: '/page/example' }), '/blog/example', 'metadata'), /must use route/);
});
