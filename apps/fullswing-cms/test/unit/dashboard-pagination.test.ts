import assert from 'node:assert/strict';
import test from 'node:test';
import type { ParsedMetadata } from '@fullswing/content-model';
import { paginateEntries } from '../../src/content/application/list-content.js';
import type { ContentEntrySummary } from '../../src/content/domain/content-entry.js';

function entries(count: number): ContentEntrySummary[] {
  return Array.from({ length: count }, (_, index) => {
    const date = '2026-01-01';
    const metadata: ParsedMetadata = {
      title: `Item ${index}`,
      author: 'Test Author',
      date,
      dateValue: new Date(`${date}T00:00:00.000Z`),
      categories: ['Testing'],
    };
    return { id: `item-${index}`, kind: 'blog', route: `/blog/item-${index}`, version: `version-${index}`, metadata };
  });
}

test('paginateEntries returns the requested slice and total count', () => {
  const result = paginateEntries(entries(25), { page: 2, pageSize: 10 });
  assert.equal(result.total, 25);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 10);
  assert.deepEqual(result.entries.map(entry => entry.id), Array.from({ length: 10 }, (_, index) => `item-${index + 10}`));
});

test('paginateEntries returns an empty slice beyond the final page', () => {
  const result = paginateEntries(entries(3), { page: 4, pageSize: 2 });
  assert.equal(result.total, 3);
  assert.deepEqual(result.entries, []);
});

test('paginateEntries rejects invalid page numbers and page sizes', () => {
  assert.throws(() => paginateEntries(entries(3), { page: 0, pageSize: 10 }));
  assert.throws(() => paginateEntries(entries(3), { page: 1, pageSize: 0 }));
});