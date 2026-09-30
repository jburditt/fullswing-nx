import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverBlogs, discoverPages } from '../src/lib/discovery.js';

const VALID_METADATA = {
  title: 'Example',
  categories: ['TypeScript'],
  author: 'Test Author',
  date: '2025-10-31',
};

test('discoverBlogs should reject orphan markdown files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fullswing-blog-discovery-'));
  const blogDirectory = join(root, 'blog');
  await mkdir(blogDirectory, { recursive: true });
  await writeFile(join(blogDirectory, 'example.md'), '# Example\n', 'utf8');

  await assert.rejects(
    () => discoverBlogs(blogDirectory),
    /blog markdown files are missing same-basename sidecars: example/
  );
});

test('discoverBlogs should discover posts in year folders', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fullswing-blog-discovery-'));
  const blogDirectory = join(root, 'blog');
  const yearDirectory = join(blogDirectory, '2025');
  await mkdir(yearDirectory, { recursive: true });
  await writeFile(join(yearDirectory, 'example.md'), '# Example\n', 'utf8');
  await writeFile(
    join(yearDirectory, 'example.json'),
    JSON.stringify(VALID_METADATA),
    'utf8'
  );

  const blogs = await discoverBlogs(blogDirectory);

  assert.equal(blogs.length, 1);
  assert.equal(blogs[0]?.id, 'example');
  assert.equal(blogs[0]?.route, '/blog/example');
  assert.equal(blogs[0]?.markdownPath, join(yearDirectory, 'example.md'));
  assert.equal(blogs[0]?.metadataPath, join(yearDirectory, 'example.json'));
});

test('discoverBlogs should year-prefix the route for the older post when basenames collide across years', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fullswing-blog-discovery-'));
  const blogDirectory = join(root, 'blog');
  const olderYearDirectory = join(blogDirectory, '2025');
  const newerYearDirectory = join(blogDirectory, '2026');
  await mkdir(olderYearDirectory, { recursive: true });
  await mkdir(newerYearDirectory, { recursive: true });
  await writeFile(join(olderYearDirectory, 'example.md'), '# Example 2025\n', 'utf8');
  await writeFile(join(olderYearDirectory, 'example.json'), JSON.stringify(VALID_METADATA), 'utf8');
  await writeFile(join(newerYearDirectory, 'example.md'), '# Example 2026\n', 'utf8');
  await writeFile(join(newerYearDirectory, 'example.json'), JSON.stringify(VALID_METADATA), 'utf8');

  const blogs = await discoverBlogs(blogDirectory);
  const routesById = new Map(blogs.map(blog => [blog.markdownPath, blog.route]));

  assert.equal(routesById.get(join(newerYearDirectory, 'example.md')), '/blog/example');
  assert.equal(routesById.get(join(olderYearDirectory, 'example.md')), '/blog/2025/example');
});

test('discoverBlogs should reject non-ISO dates in metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fullswing-blog-discovery-'));
  const blogDirectory = join(root, 'blog');
  await mkdir(blogDirectory, { recursive: true });
  await writeFile(join(blogDirectory, 'example.md'), '# Example\n', 'utf8');
  await writeFile(
    join(blogDirectory, 'example.json'),
    JSON.stringify({ ...VALID_METADATA, date: 'Oct 31, 2025' }),
    'utf8'
  );

  await assert.rejects(
    () => discoverBlogs(blogDirectory),
    /Use ISO date format YYYY-MM-DD/
  );
});

test('discoverPages should reject orphan renderer files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fullswing-blog-pages-'));
  const sourcePagesDirectory = join(root, 'src', 'pages');
  const compiledPagesDirectory = join(root, '.build', 'src', 'pages');
  await mkdir(sourcePagesDirectory, { recursive: true });
  await mkdir(compiledPagesDirectory, { recursive: true });
  await writeFile(join(sourcePagesDirectory, 'example.ts'), 'export const renderPage = () => \"\";', 'utf8');

  await assert.rejects(
    () => discoverPages(sourcePagesDirectory, compiledPagesDirectory),
    /page renderer files are missing same-basename sidecars: example/
  );
});

test('discoverPages should ignore declaration files and load matching page metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fullswing-blog-pages-'));
  const sourcePagesDirectory = join(root, 'src', 'pages');
  const compiledPagesDirectory = join(root, '.build', 'src', 'pages');
  await mkdir(sourcePagesDirectory, { recursive: true });
  await mkdir(compiledPagesDirectory, { recursive: true });
  await writeFile(join(sourcePagesDirectory, 'example.ts'), 'export const renderPage = () => \"\";', 'utf8');
  await writeFile(join(sourcePagesDirectory, 'example.d.ts'), 'export {};', 'utf8');
  await writeFile(
    join(sourcePagesDirectory, 'example.json'),
    JSON.stringify({
      title: 'Example Page',
      categories: ['TypeScript'],
      author: 'Test Author',
      date: '2025-10-31',
    }),
    'utf8'
  );

  const pages = await discoverPages(sourcePagesDirectory, compiledPagesDirectory);

  assert.equal(pages.length, 1);
  assert.equal(pages[0]?.route, '/page/example');
  assert.equal(pages[0]?.modulePath, join(compiledPagesDirectory, 'example.js'));
});
