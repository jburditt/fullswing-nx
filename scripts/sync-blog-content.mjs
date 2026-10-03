import { execFile } from 'node:child_process';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const DEFAULT_PREFIX = 'content/blog/';

async function runAzureCli(args) {
  const { stdout } = await execFileAsync('az', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

export async function syncBlogContent({
  accountName,
  containerName,
  destinationDirectory,
  prefix = DEFAULT_PREFIX,
  runCommand = runAzureCli,
}) {
  if (!accountName?.trim() || !containerName?.trim()) {
    throw new Error('BLOG_STORAGE_ACCOUNT_NAME and BLOG_STORAGE_CONTAINER_NAME are required.');
  }
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const destination = resolve(destinationDirectory);
  const staging = `${destination}.sync-${randomUUID()}`;
  const backup = `${destination}.previous-${randomUUID()}`;

  try {
    const listOutput = await runCommand([
      'storage', 'blob', 'list',
      '--account-name', accountName.trim(),
      '--container-name', containerName.trim(),
      '--prefix', normalizedPrefix,
      '--auth-mode', 'login',
      '--output', 'json',
      '--only-show-errors',
    ]);
    const listedBlobs = JSON.parse(listOutput);
    if (!Array.isArray(listedBlobs)) throw new Error('Azure returned an invalid blog blob listing.');

    const files = listedBlobs.map(blob => {
      const relativeName = typeof blob.name === 'string' && blob.name.startsWith(normalizedPrefix)
        ? blob.name.slice(normalizedPrefix.length)
        : '';
      if (!/^\d{4}\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:md|json)$/.test(relativeName)) {
        throw new Error('Blob storage contains an invalid blog content path.');
      }
      return { name: blob.name, relativeName };
    });

    const pairs = new Map();
    for (const file of files) {
      const pairKey = file.relativeName.slice(0, file.relativeName.lastIndexOf('.'));
      const extension = file.relativeName.slice(file.relativeName.lastIndexOf('.') + 1);
      const extensions = pairs.get(pairKey) ?? new Set();
      if (extensions.has(extension)) throw new Error('Blob storage contains a duplicate blog sidecar.');
      extensions.add(extension);
      pairs.set(pairKey, extensions);
    }
    if (pairs.size === 0 || [...pairs.values()].some(extensions => extensions.size !== 2
      || !extensions.has('md') || !extensions.has('json'))) {
      throw new Error('Blob storage must contain at least one complete Markdown/JSON blog pair.');
    }

    await mkdir(staging, { recursive: true });
    for (const file of files) {
      const target = resolve(staging, ...file.relativeName.split('/'));
      if (!target.startsWith(`${staging}${sep}`)) throw new Error('Blob content path escapes the staging directory.');
      await mkdir(dirname(target), { recursive: true });
      await runCommand([
        'storage', 'blob', 'download',
        '--account-name', accountName.trim(),
        '--container-name', containerName.trim(),
        '--name', file.name,
        '--file', target,
        '--auth-mode', 'login',
        '--overwrite', 'true',
        '--no-progress',
        '--only-show-errors',
      ]);
    }

    let movedPrevious = false;
    try {
      await rename(destination, backup);
      movedPrevious = true;
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    try {
      await rename(staging, destination);
    } catch (error) {
      if (movedPrevious) await rename(backup, destination);
      throw error;
    }
    if (movedPrevious) await rm(backup, { recursive: true, force: true });
    return files.length;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

function isMissing(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (entryPoint === import.meta.url) {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  syncBlogContent({
    accountName: process.env.BLOG_STORAGE_ACCOUNT_NAME,
    containerName: process.env.BLOG_STORAGE_CONTAINER_NAME,
    destinationDirectory: join(workspaceRoot, 'apps/fullswing-blog/public/blog'),
    prefix: process.env.BLOG_STORAGE_CONTENT_PREFIX ?? DEFAULT_PREFIX,
  }).then(count => {
    process.stdout.write(`Synced ${count} blog blobs from Azure Storage.\n`);
  }).catch(error => {
    process.stderr.write(`Blog content sync failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  });
}