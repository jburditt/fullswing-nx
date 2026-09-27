import test from 'node:test';
import assert from 'node:assert/strict';
import { BlogEntry, ContentRepository, PageEntry } from '../src/index.js';

const blogEntries: BlogEntry[] = [
  {
    kind: 'blog',
    id: 'older-post',
    route: '/blog/older-post',
    title: 'Older Post',
    categories: ['Document'],
    author: 'A',
    date: '2025-10-17',
    dateValue: new Date('2025-10-17T00:00:00.000Z'),
    markdownPath: '/tmp/older-post.md',
    metadataPath: '/tmp/older-post.json',
  },
  {
    kind: 'blog',
    id: 'newer-post',
    route: '/blog/newer-post',
    title: 'Newer Post',
    categories: ['TypeScript', 'Document'],
    author: 'B',
    date: '2025-10-31',
    dateValue: new Date('2025-10-31T00:00:00.000Z'),
    markdownPath: '/tmp/newer-post.md',
    metadataPath: '/tmp/newer-post.json',
  },
];

const pageEntries: PageEntry[] = [
  {
    kind: 'page',
    name: 'angular-blog',
    route: '/page/angular-blog',
    title: 'Angular Blog',
    categories: ['Angular'],
    author: 'C',
    date: '2025-10-14',
    dateValue: new Date('2025-10-14T00:00:00.000Z'),
    metadataPath: '/tmp/angular-blog.json',
    modulePath: '/tmp/angular-blog.js',
  },
];

test('ContentRepository should sort discovered content by parsed date descending', () => {
  const repository = new ContentRepository(blogEntries, pageEntries);

  assert.deepEqual(repository.getAll().map(entry => entry.route), [
    '/blog/newer-post',
    '/blog/older-post',
    '/page/angular-blog',
  ]);
});

test('ContentRepository should aggregate categories with display names and counts', () => {
  const repository = new ContentRepository(blogEntries, pageEntries);

  assert.deepEqual(repository.getCategories(), [
    { name: 'Angular', displayName: 'Angular', slug: 'angular', count: 1 },
    { name: 'Document', displayName: 'Document', slug: 'document', count: 2 },
    { name: 'TypeScript', displayName: 'TypeScript', slug: 'typescript', count: 1 },
  ]);
});