import { readdir } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import { BlogEntry, loadMetadata, PageEntry } from '@fullswing/content-model';

function getSortedBasenames(entries: string[], extension: string): string[] {
  return entries
    .filter(entry => entry.endsWith(extension))
    .map(entry => basename(entry, extension))
    .sort();
}

function getOrphans(primary: string[], secondary: string[]): string[] {
  const secondarySet = new Set(secondary);
  return primary.filter(entry => !secondarySet.has(entry));
}

function formatOrphanMessage(kind: 'blog markdown' | 'blog metadata' | 'page renderer' | 'page metadata', orphans: string[]): string {
  return `${kind} files are missing same-basename sidecars: ${orphans.join(', ')}`;
}

interface BlogFile {
  relativePath: string;
  absolutePath: string;
}

async function getBlogFiles(blogDirectory: string, currentDirectory = blogDirectory): Promise<BlogFile[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files: BlogFile[] = [];

  for (const entry of entries) {
    const absolutePath = join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await getBlogFiles(blogDirectory, absolutePath));
      continue;
    }

    if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath: relative(blogDirectory, absolutePath).split(sep).join('/'),
      });
    }
  }

  return files;
}

export async function discoverBlogs(blogDirectory: string): Promise<BlogEntry[]> {
  const files = await getBlogFiles(blogDirectory);
  const filesByRelativePath = new Map(files.map(file => [file.relativePath, file]));
  const markdownPaths = files
    .map(file => file.relativePath)
    .filter(filePath => extname(filePath) === '.md')
    .sort();
  const metadataPaths = files
    .map(file => file.relativePath)
    .filter(filePath => extname(filePath) === '.json')
    .sort();
  const markdownBasenames = markdownPaths.map(filePath => filePath.slice(0, -'.md'.length));
  const metadataBasenames = metadataPaths.map(filePath => filePath.slice(0, -'.json'.length));

  const orphanMarkdown = getOrphans(markdownBasenames, metadataBasenames);
  const orphanMetadata = getOrphans(metadataBasenames, markdownBasenames);

  if (orphanMarkdown.length > 0) {
    throw new Error(formatOrphanMessage('blog markdown', orphanMarkdown));
  }

  if (orphanMetadata.length > 0) {
    throw new Error(formatOrphanMessage('blog metadata', orphanMetadata));
  }

  const blogs = await Promise.all(
    markdownBasenames.map(async relativePath => {
      const markdownPath = filesByRelativePath.get(`${relativePath}.md`)?.absolutePath;
      const metadataPath = filesByRelativePath.get(`${relativePath}.json`)?.absolutePath;

      if (!markdownPath || !metadataPath) {
        throw new Error(`Blog files for ${relativePath} could not be resolved.`);
      }

      const id = basename(relativePath);
      const metadata = await loadMetadata(metadataPath, `/blog/${id}`);
      return {
        ...metadata,
        kind: 'blog' as const,
        id,
        markdownPath,
        metadataPath,
      };
    })
  );

  return blogs;
}

export async function discoverPages(sourcePagesDirectory: string, compiledPagesDirectory: string): Promise<PageEntry[]> {
  const entries = await readdir(sourcePagesDirectory, { withFileTypes: true });
  const fileNames = entries.filter(entry => entry.isFile()).map(entry => entry.name);
  const rendererBasenames = getSortedBasenames(
    fileNames.filter(entry => !entry.endsWith('.d.ts')),
    '.ts'
  );
  const metadataBasenames = getSortedBasenames(fileNames, '.json');

  const orphanRenderers = getOrphans(rendererBasenames, metadataBasenames);
  const orphanMetadata = getOrphans(metadataBasenames, rendererBasenames);

  if (orphanRenderers.length > 0) {
    throw new Error(formatOrphanMessage('page renderer', orphanRenderers));
  }

  if (orphanMetadata.length > 0) {
    throw new Error(formatOrphanMessage('page metadata', orphanMetadata));
  }

  const pages = await Promise.all(
    rendererBasenames.map(async name => {
      const metadataPath = join(sourcePagesDirectory, `${name}.json`);
      const modulePath = join(compiledPagesDirectory, `${name}.js`);
      const metadata = await loadMetadata(metadataPath, `/page/${name}`);
      return {
        ...metadata,
        kind: 'page' as const,
        name,
        metadataPath,
        modulePath,
      };
    })
  );

  return pages;
}
