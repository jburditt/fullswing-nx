import assert from 'node:assert/strict';
import test from 'node:test';
import type { ParsedMetadata } from '@fullswing/content-model';
import { parseDashboardQuery } from '../../src/content/application/content-filters.js';
import { filterContentEntries } from '../../src/content/application/list-content.js';
import type { ContentEntrySummary } from '../../src/content/domain/content-entry.js';

function entry(
  id: string,
  kind: 'blog' | 'page',
  values: Partial<ParsedMetadata> = {},
): ContentEntrySummary {
  const date = values.date ?? '2026-01-01';
  return {
    id,
    kind,
    version: `version-${id}`,
    metadata: {
      route: values.route ?? `/${kind}/${id}`,
      title: values.title ?? id,
      author: values.author ?? 'Alice Example',
      date,
      categories: values.categories ?? ['Engineering'],
      dateValue: values.dateValue ?? new Date(`${date}T00:00:00.000Z`),
    },
  };
}

const entries = [
  entry('cms', 'blog', { title: 'CMS design', author: 'Alice Example', date: '2026-01-10', categories: ['Engineering'] }),
  entry('nx', 'blog', { title: 'Nx migration', author: 'Bob Example', date: '2026-02-12', categories: ['Architecture'] }),
  entry('about', 'page', { title: 'About Fullswing', author: 'Alice Example', date: '2026-01-20', categories: ['Company'] }),
];

test('filterContentEntries applies content type, title, author, category, and inclusive date bounds together', () => {
  const result = filterContentEntries(entries, {
    kind: 'blog',
    title: 'cms',
    author: 'alice example',
    category: 'engineering',
    dateFrom: '2026-01-10',
    dateTo: '2026-01-10',
  });

  assert.deepEqual(result.map(item => item.id), ['cms']);
});

test('title filtering is a case-insensitive substring match', () => {
  assert.deepEqual(filterContentEntries(entries, { title: 'FULLSWING' }).map(item => item.id), ['about']);
});

test('author and category filters use case-insensitive exact matches', () => {
  const result = filterContentEntries(entries, { author: 'BOB EXAMPLE', category: 'architecture' });
  assert.deepEqual(result.map(item => item.id), ['nx']);
});

test('date bounds are inclusive', () => {
  const result = filterContentEntries(entries, { dateFrom: '2026-01-10', dateTo: '2026-01-20' });
  assert.deepEqual(result.map(item => item.id), ['cms', 'about']);
});

test('a filter set with no matches returns an empty list', () => {
  assert.deepEqual(filterContentEntries(entries, { kind: 'page', author: 'Bob Example' }), []);
});

test('an empty filter object returns all entries without mutating the input', () => {
  const result = filterContentEntries(entries, {});
  assert.deepEqual(result.map(item => item.id), ['cms', 'nx', 'about']);
  assert.equal(entries.length, 3);
});

test('parseDashboardQuery accepts valid filters and pagination defaults', () => {
  assert.deepEqual(parseDashboardQuery({ kind: 'all', title: ' cms ', page: '2', pageSize: '10' }), {
    filters: { kind: undefined, title: 'cms', author: undefined, category: undefined, dateFrom: undefined, dateTo: undefined },
    pagination: { page: 2, pageSize: 10 },
  });
  assert.equal(parseDashboardQuery({}).pagination.page, 1);
  assert.equal(parseDashboardQuery({}).pagination.pageSize, 20);
});

test('parseDashboardQuery rejects unsupported content types, malformed dates, and reversed ranges', () => {
  assert.throws(() => parseDashboardQuery({ kind: 'article' }));
  assert.throws(() => parseDashboardQuery({ dateFrom: '2026-02-30' }));
  assert.throws(() => parseDashboardQuery({ dateFrom: '2026-03-01', dateTo: '2026-02-28' }));
});

test('parseDashboardQuery bounds page size and rejects repeated filter values', () => {
  assert.throws(() => parseDashboardQuery({ pageSize: '101' }));
  assert.throws(() => parseDashboardQuery({ title: ['first', 'second'] }));
});